import { useEchoApi } from "@/lib/api/echoApi";
import { ECHO_API_CONFIG } from "@/lib/api/config";
import { computeSpatialPosition, applySpatialPanner } from "./spatialAudio";
import { useSettingsStore } from "@/stores/settingsStore";

export interface WebRtcCallbacks {
  onParticipantsUpdate?: (participants: any[]) => void;
  onParticipantUpdated?: (userId: string, data: Partial<any>) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onParticipantSpeaking?: (userId: string, isSpeaking: boolean) => void;
  onRemoteVideoStream?: (userId: string, stream: MediaStream | null, kind: "screen" | "camera") => void;
  onRttUpdate?: (rttMs: number) => void;
  onPeerConnected?: (userId: string) => void;
  onPeerDisconnected?: (userId: string) => void;
  onConnectionStateChange?: (state: "disconnected" | "connecting" | "connected") => void;
  onSoundboardEffect?: (fromUserId: string, soundId: string) => void;
  onError?: (err: Error) => void;
}

class WebRtcVoiceManager {
  private localStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private localCameraStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private vadInterval: any = null;
  private heartbeatInterval: any = null;
  private burstInterval: any = null;
  private fastPollTimeout: any = null;

  private currentGuildId: string | null = null;
  private currentChannelId: string | null = null;
  private myUserId: string = "";
  private myUsername: string = "";
  private myAvatarUrl: string | null = null;
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private isSpeaking: boolean = false;
  private isScreenSharing: boolean = false;
  private isCameraOn: boolean = false;

  private peers: Map<string, RTCPeerConnection> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private screenAudioElements: Map<string, HTMLAudioElement> = new Map();
  private screenSenders: Map<string, RTCRtpSender> = new Map();
  private screenAudioSenders: Map<string, RTCRtpSender> = new Map();
  private cameraSenders: Map<string, RTCRtpSender> = new Map();
  private screenShareBitrate: number = 4_500_000;
  private remoteVideoStreams: Map<string, MediaStream> = new Map();
  private remoteScreenStreams: Map<string, MediaStream> = new Map();
  private remoteCameraStreams: Map<string, MediaStream> = new Map();
  private remoteVideoMeta: Map<string, "screen" | "camera"> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAnalysers: Map<string, { analyser: AnalyserNode; source?: MediaStreamAudioSourceNode; interval: any; hangTimer?: any }> = new Map();
  private peerMutedStates: Map<string, boolean> = new Map();
  private peerHasCamera: Map<string, boolean> = new Map();
  private peerIsScreenSharing: Map<string, boolean> = new Map();
  private hasNotifiedConnected: boolean = false;
  private callbacks: WebRtcCallbacks = {};
  private sseSource: EventSource | null = null;
  private peerVolumes: Map<string, number> = new Map();
  private peerAudioNodes: Map<string, { gain: GainNode; source: MediaStreamAudioSourceNode }> = new Map();
  private screenAudioNodes: Map<string, { gain: GainNode; source: MediaStreamAudioSourceNode }> = new Map();
  private peerPanners: Map<string, StereoPannerNode | PannerNode> = new Map();
  private spatialAudioEnabled: boolean = false;
  private masterOutputVolume: number = 100;

  private rtcConfig: RTCConfiguration = {
    iceServers: this.getIceServers(),
  };


  /** Retorna ICE servers configurados ou defaults. Suporta STUN/TURN customizados via localStorage/config. */
  private getIceServers(): RTCIceServer[] {
    try {
      const raw = localStorage.getItem("echo:iceServers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.services.mozilla.com" },
    ];
  }

  /**
   * Aplica setSinkId em um elemento de áudio HTML para rotear saída ao dispositivo selecionado.
   * Lê o deviceId do settingsStore se disponível, ou usa o parâmetro fornecido.
   */
  private async applyOutputDeviceToElement(audio: HTMLAudioElement, deviceId?: string | null): Promise<void> {
    const sinkId = deviceId ?? (() => {
      try {
        const raw = localStorage.getItem("echo:audioConfig");
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.headphonesDevice || parsed.outputDeviceId || null;
        }
      } catch {}
      return null;
    })();

    if (!sinkId || sinkId === "default") return;

    const el = audio as unknown as { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId === "function") {
      try {
        await el.setSinkId(sinkId);
      } catch (err) {
        console.warn("[webrtcVoice] setSinkId falhou:", err);
      }
    }
  }

  /**
   * Altera o dispositivo de saída de áudio para todos os peers remotos ativos.
   * Chamado quando o usuário muda a seleção de alto-falante/fone nas configurações.
   */
  public async setOutputDevice(deviceId: string | null): Promise<void> {
    for (const [, audio] of this.audioElements) {
      await this.applyOutputDeviceToElement(audio, deviceId);
    }
    for (const [, audio] of this.screenAudioElements) {
      await this.applyOutputDeviceToElement(audio, deviceId);
    }
    if (this.audioContext && typeof (this.audioContext as any).setSinkId === "function") {
      try {
        await (this.audioContext as any).setSinkId(deviceId && deviceId !== "default" ? deviceId : "");
      } catch (e) {
        console.warn("[WebRtcVoice] audioContext.setSinkId falhou:", e);
      }
    }
  }

  private getEffectiveGain(peerId: string): number {
    if (this.isDeafened) return 0;
    const userVol = this.peerVolumes.get(peerId) ?? 100;
    let masterVol = this.masterOutputVolume;
    try {
      const storeVol = (useSettingsStore as any)?.getState?.()?.outputVolume;
      if (typeof storeVol === "number") masterVol = storeVol;
    } catch {}
    return Math.max(0, (userVol / 100) * (masterVol / 100));
  }

  public setMasterOutputVolume(volume: number) {
    this.masterOutputVolume = volume;
    for (const [peerId, node] of this.peerAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(peerId);
    }
    for (const [peerId, node] of this.screenAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(peerId);
    }
  }

  /**
   * Lê as restrições de áudio do settingsStore ou fallback padrão
   */
  public getAudioConstraints(overrides?: Partial<MediaTrackConstraints>): MediaTrackConstraints {
    try {
      const state = (useSettingsStore as any)?.getState?.();
      if (state) {
        return {
          deviceId: state.microphoneDevice ? { exact: state.microphoneDevice } : undefined,
          echoCancellation: state.echoCancellation ?? true,
          noiseSuppression: state.noiseSuppression ?? true,
          autoGainControl: state.autoGainControl ?? true,
          ...overrides,
        };
      }
    } catch {}
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...overrides,
    };
  }

  /**
   * Atualiza as configurações de captura de áudio (microfone, supressão de ruído, cancelamento de eco)
   * e faz hot-swap via replaceTrack() nos peers WebRTC em tempo real sem reconexão.
   */
  public async updateAudioConstraints(overrides?: Partial<MediaTrackConstraints>): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    const constraints = this.getAudioConstraints(overrides);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;

      newTrack.enabled = !this.isMuted;

      // Substitui o track de áudio em cada peer connection ativo
      for (const [peerId, pc] of this.peers) {
        try {
          const senders = pc.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === "audio");
          if (audioSender) {
            await audioSender.replaceTrack(newTrack);
          }
        } catch (err) {
          console.warn(`[WebRtcVoice] Falha ao substituir track de áudio no peer ${peerId}:`, err);
        }
      }

      // Interrompe faixas antigas para evitar vazamento de hardware
      if (this.localStream) {
        for (const track of this.localStream.getAudioTracks()) {
          try {
            track.stop();
          } catch {}
        }
      }

      this.localStream = newStream;
      this.setPrewarmedStream(newStream);
    } catch (err) {
      console.warn("[WebRtcVoice] updateAudioConstraints falhou:", err);
    }
  }

  /**
   * Altera o microfone em uso imediatamente com hot-swap dos peers
   */
  public async switchMicrophone(deviceId: string | null): Promise<void> {
    await this.updateAudioConstraints(
      deviceId ? { deviceId: { exact: deviceId } } : { deviceId: undefined }
    );
  }

  public getCurrentGuildId() {
    return this.currentGuildId;
  }

  public getCurrentChannelId() {
    return this.currentChannelId;
  }

  public getMyUserId() {
    return this.myUserId;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private prewarmedStream: MediaStream | null = null;

  public setPrewarmedStream(stream: MediaStream | null) {
    this.prewarmedStream = stream;
  }

  public async join(
    guildId: string,
    channelId: string,
    myUserId: string,
    username: string,
    avatarUrl: string | null,
    isMuted: boolean,
    isDeafened: boolean,
    callbacks: WebRtcCallbacks = {},
  ) {
    const isSwitching = Boolean(this.currentChannelId && this.currentChannelId !== channelId);
    const hasLiveStream = Boolean(
      this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === "live"),
    );

    if (isSwitching && hasLiveStream) {
      await this.leaveOldChannelOnly();
    } else if (this.currentChannelId !== channelId) {
      await this.leave(false);
    }

    this.currentGuildId = guildId;
    this.currentChannelId = channelId;
    this.myUserId = myUserId;
    this.myUsername = username;
    this.myAvatarUrl = avatarUrl;
    this.isMuted = isMuted;
    this.isDeafened = isDeafened;
    this.callbacks = callbacks;
    this.hasNotifiedConnected = false;
    this.peerMutedStates.clear();

    // 1. Captura de microfone local (reutiliza stream existente ou pré-aquecido para evitar abertura concorrente dupla)
    try {
      const streamLive =
        this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === "live");
      const prewarmedLive =
        !streamLive &&
        this.prewarmedStream &&
        this.prewarmedStream.getAudioTracks().some((t) => t.readyState === "live");

      if (prewarmedLive && this.prewarmedStream) {
        this.localStream = this.prewarmedStream;
        this.setMicrophoneMuted(isMuted);
        if (!this.vadInterval) {
          this.startVad();
        }
      } else if (!streamLive && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const audioConstraints = this.getAudioConstraints();
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        this.setMicrophoneMuted(isMuted);
        this.startVad();
      } else if (streamLive) {
        this.setMicrophoneMuted(isMuted);
        if (!this.vadInterval) {
          this.startVad();
        }
      }
    } catch (err: any) {
      console.warn("[WebRtcVoice] Erro ao obter microfone:", err);
      // Continua mesmo sem microfone para poder ouvir
    }

    // 2. Registra presença no echo-api
    try {
      const api = useEchoApi();
      if (typeof api?.joinVoiceChannel === "function") {
        const res = await api.joinVoiceChannel(channelId, {
          guildId,
          username,
          avatarUrl,
          isMuted,
          isDeafened,
          isScreenSharing: this.isScreenSharing,
          hasCamera: this.isCameraOn,
        });

        if ((res as any)?.myUserId) {
          this.myUserId = (res as any).myUserId;
        }

        if (res.participants) {
          for (const p of res.participants) {
            if (p?.userId) {
              this.peerMutedStates.set(p.userId, Boolean(p.isMuted || p.isDeafened));
            }
          }
          this.callbacks.onParticipantsUpdate?.(res.participants);
          this.syncPeers(res.participants);
        }
      }
    } catch (err: any) {
      console.warn("[WebRtcVoice] Erro ao registrar presença no backend:", err);
    }

    // 3. Conexão SSE instantânea (<20ms) para entrega imediata de sinais WebRTC e eventos
    this.connectSse(channelId);

    // 4. Inicia loop de Heartbeat e Sinalização (fallback HTTP)
    this.startHeartbeatAndSignalingLoop();

    // 5. Se o usuário estiver sozinho na sala (0 peers remotos), estabelece conexão com sucesso
    if (this.peers.size === 0) {
      this.hasNotifiedConnected = true;
      this.callbacks.onConnectionStateChange?.("connected");
    }
  }

  private notifyConnected(peerId: string) {
    this.callbacks.onPeerConnected?.(peerId);
    if (!this.hasNotifiedConnected) {
      this.hasNotifiedConnected = true;
      this.callbacks.onConnectionStateChange?.("connected");
    }
  }

  private connectSse(channelId: string) {
    this.disconnectSse();

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    try {
      const api = useEchoApi();
      const token = typeof api?.getAccessToken === "function" ? api.getAccessToken() : "";
      const baseUrl = typeof api?.getBaseUrl === "function" ? api.getBaseUrl() : ECHO_API_CONFIG.baseUrl;
      const url = `${baseUrl}/api/channels/${encodeURIComponent(channelId)}/voice/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;

      const sse = new EventSource(url);
      this.sseSource = sse;

      sse.addEventListener("signal", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.fromUserId && data.signal) {
            if (data.fromUserId !== this.myUserId) {
              void this.handleIncomingSignal(data.fromUserId, data.signal);
            }
          }
        } catch (err) {
          console.warn("[WebRtcVoice] Erro ao processar sinal SSE:", err);
        }
      });

      sse.addEventListener("participants", (event: MessageEvent) => {
        try {
          const participants = JSON.parse(event.data);
          if (Array.isArray(participants)) {
            for (const p of participants) {
              if (p?.userId) {
                this.peerMutedStates.set(p.userId, Boolean(p.isMuted || p.isDeafened));
              }
            }
            this.callbacks.onParticipantsUpdate?.(participants);
            this.syncPeers(participants);
          }
        } catch (err) {
          console.warn("[WebRtcVoice] Erro ao processar participantes SSE:", err);
        }
      });

      sse.addEventListener("participant_updated", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.userId) {
            if (typeof data.isMuted === "boolean" || typeof data.isDeafened === "boolean") {
              const muted = Boolean(data.isMuted || data.isDeafened);
              this.peerMutedStates.set(data.userId, muted);
              if (muted) {
                this.callbacks.onParticipantSpeaking?.(data.userId, false);
              }
            }
            // Rastreia estado de câmera e screen share remotos para distinguir câmera vs screen share no ontrack
            if (typeof data.hasCamera === "boolean") {
              this.peerHasCamera.set(data.userId, data.hasCamera);
            }
            if (typeof data.isScreenSharing === "boolean") {
              this.peerIsScreenSharing.set(data.userId, data.isScreenSharing);
            }
            this.callbacks.onParticipantUpdated?.(data.userId, {
              isSpeaking: data.isSpeaking,
              isMuted: data.isMuted,
              isDeafened: data.isDeafened,
              isScreenSharing: data.isScreenSharing,
              hasCamera: data.hasCamera,
            });
            if (typeof data.isSpeaking === "boolean") {
              const speaking = (data.isMuted || data.isDeafened) ? false : data.isSpeaking;
              this.callbacks.onParticipantSpeaking?.(data.userId, speaking);
            }
            if (data.isScreenSharing === false) {
              this.remoteScreenStreams.delete(data.userId);
              const fallbackCam = this.remoteCameraStreams.get(data.userId);
              if (fallbackCam) this.remoteVideoStreams.set(data.userId, fallbackCam);
              else this.remoteVideoStreams.delete(data.userId);
              this.callbacks.onRemoteVideoStream?.(data.userId, null, "screen");
            }
            if (data.hasCamera === false) {
              this.remoteCameraStreams.delete(data.userId);
              const fallbackScreen = this.remoteScreenStreams.get(data.userId);
              if (fallbackScreen) this.remoteVideoStreams.set(data.userId, fallbackScreen);
              else this.remoteVideoStreams.delete(data.userId);
              this.callbacks.onRemoteVideoStream?.(data.userId, null, "camera");
            }
          }
        } catch {}
      });

      sse.addEventListener("participant_left", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.userId) {
            this.cleanupPeer(data.userId);
          }
        } catch {}
      });

      sse.onerror = () => {
        // EventSource nativo reconecta automaticamente com backoff
      };
    } catch (e) {
      console.warn("[WebRtcVoice] Falha ao iniciar SSE:", e);
    }
  }

  private disconnectSse() {
    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch {}
      this.sseSource = null;
    }
  }

  public async leaveOldChannelOnly() {
    this.disconnectSse();
    this.stopVad();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.currentChannelId) {
      try {
        const api = useEchoApi();
        if (typeof api?.leaveVoiceChannel === "function") {
          await api.leaveVoiceChannel(this.currentChannelId).catch(() => {});
        }
      } catch {}
    }

    for (const peerId of Array.from(this.peers.keys())) {
      this.cleanupPeer(peerId);
    }

    this.localScreenStream = null;
    this.localCameraStream = null;
    this.isScreenSharing = false;
    this.isCameraOn = false;
  }

  public async leave(notify = true) {
    this.disconnectSse();
    this.stopVad();
    this.hasNotifiedConnected = false;
    this.peerMutedStates.clear();
    if (notify) {
      this.callbacks.onConnectionStateChange?.("disconnected");
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.burstInterval) {
      clearInterval(this.burstInterval);
      this.burstInterval = null;
    }
    if (this.fastPollTimeout) {
      clearTimeout(this.fastPollTimeout);
      this.fastPollTimeout = null;
    }

    // Notifica backend e aguarda conclusão para evitar race condition
    if (this.currentChannelId) {
      try {
        const api = useEchoApi();
        if (typeof api?.leaveVoiceChannel === "function") {
          await api.leaveVoiceChannel(this.currentChannelId).catch(() => {});
        }
      } catch {}
    }

    for (const peerId of Array.from(this.peers.keys())) {
      this.cleanupPeer(peerId);
    }

    // Para faixas locais de áudio (se não for stream compartilhado gerido por useVoiceActivity)
    if (this.localStream) {
      if (this.localStream !== this.prewarmedStream) {
        for (const track of this.localStream.getTracks()) {
          track.stop();
        }
      }
      this.localStream = null;
    }

    // Para faixas locais de transmissão de tela
    if (this.localScreenStream) {
      for (const track of this.localScreenStream.getTracks()) {
        track.stop();
      }
      this.localScreenStream = null;
    }

    // Para faixas locais de câmera
    if (this.localCameraStream) {
      for (const track of this.localCameraStream.getTracks()) {
        track.stop();
      }
      this.localCameraStream = null;
    }

    this.isScreenSharing = false;
    this.isCameraOn = false;
    this.isSpeaking = false;
    this.screenSenders.clear();
    this.screenAudioSenders.clear();
    this.cameraSenders.clear();
    this.remoteVideoStreams.clear();
    this.remoteScreenStreams.clear();
    this.remoteCameraStreams.clear();
    this.remoteVideoMeta.clear();
    this.peerHasCamera.clear();
    this.peerIsScreenSharing.clear();

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.peerVolumes.clear();
    this.currentGuildId = null;
    this.currentChannelId = null;
  }

  /**
   * Envia sinal síncrono/keepalive de saída ao fechar janela/processo,
   * parando tracks locais e AudioContext imediatamente de forma síncrona
   * e garantindo que o servidor remova o usuário mesmo se o runtime fechar antes.
   */
  public leaveSyncOrKeepalive() {
    this.disconnectSse();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.burstInterval) {
      clearInterval(this.burstInterval);
      this.burstInterval = null;
    }
    if (this.fastPollTimeout) {
      clearTimeout(this.fastPollTimeout);
      this.fastPollTimeout = null;
    }
    this.stopVad();

    // Limpeza síncrona imediata de faixas locais de áudio, tela e câmera
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try { track.stop(); } catch {}
      }
      this.localStream = null;
    }
    if (this.localScreenStream) {
      for (const track of this.localScreenStream.getTracks()) {
        try { track.stop(); } catch {}
      }
      this.localScreenStream = null;
    }
    if (this.localCameraStream) {
      for (const track of this.localCameraStream.getTracks()) {
        try { track.stop(); } catch {}
      }
      this.localCameraStream = null;
    }

    for (const peerId of Array.from(this.peers.keys())) {
      try { this.cleanupPeer(peerId); } catch {}
    }

    if (this.audioContext) {
      try { void this.audioContext.close(); } catch {}
      this.audioContext = null;
    }

    if (!this.currentChannelId) return;
    const chId = this.currentChannelId;
    this.currentChannelId = null;
    this.currentGuildId = null;

    try {
      const api = useEchoApi();
      const token = typeof api?.getAccessToken === "function" ? api.getAccessToken() : "";
      const baseUrl = typeof api?.getBaseUrl === "function" ? api.getBaseUrl() : ECHO_API_CONFIG.baseUrl;
      const url = `${baseUrl}/api/channels/${encodeURIComponent(chId)}/voice/leave${token ? `?token=${encodeURIComponent(token)}` : ""}`;

      // 1. sendBeacon se disponível (garantido durante unload do browser)
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([JSON.stringify({ token })], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      }

      // 2. Fetch com keepalive: true (sobrevive ao encerramento da página/webview)
      if (typeof fetch === "function") {
        void fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }

  public setMicrophoneMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    if (muted) {
      this.isSpeaking = false;
      this.callbacks.onSpeakingChange?.(false);
    }
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    for (const audio of this.audioElements.values()) {
      audio.muted = deafened;
    }
    for (const audio of this.screenAudioElements.values()) {
      audio.muted = deafened;
    }
    for (const [peerId, node] of this.peerAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(peerId);
    }
    for (const [peerId, node] of this.screenAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(peerId);
    }
    if (deafened) {
      this.setMicrophoneMuted(true);
    }
  }

  public setParticipantVolume(userId: string, volume: number) {
    this.peerVolumes.set(userId, volume);
    const effective = this.getEffectiveGain(userId);
    const audio = this.audioElements.get(userId);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, effective));
    }
    const screenAudio = this.screenAudioElements.get(userId);
    if (screenAudio) {
      screenAudio.volume = Math.max(0, Math.min(1, effective));
    }
    const node = this.peerAudioNodes.get(userId);
    if (node) {
      node.gain.gain.value = effective;
    }
    const screenNode = this.screenAudioNodes.get(userId);
    if (screenNode) {
      screenNode.gain.gain.value = effective;
    }
  }

  private cleanupPeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peers.delete(peerId);
    }

    const audio = this.audioElements.get(peerId);
    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
      this.audioElements.delete(peerId);
    }

    const screenAudio = this.screenAudioElements.get(peerId);
    if (screenAudio) {
      try {
        screenAudio.pause();
        screenAudio.srcObject = null;
        screenAudio.remove();
      } catch {}
      this.screenAudioElements.delete(peerId);
    }

    if (this.remoteAnalysers.has(peerId)) {
      const a = this.remoteAnalysers.get(peerId)!;
      clearInterval(a.interval);
      if (a.hangTimer) {
        clearTimeout(a.hangTimer);
      }
      // Desconecta source + analyser nodes para evitar leak de Web Audio resources
      try { (a as any).source?.disconnect(); } catch {}
      try { a.analyser?.disconnect(); } catch {}
      this.remoteAnalysers.delete(peerId);
    }

    this.cleanupRemoteAudioNodes(peerId);

    this.screenSenders.delete(peerId);
    this.screenAudioSenders.delete(peerId);
    this.cameraSenders.delete(peerId);
    this.candidateQueues.delete(peerId);
    this.remoteVideoStreams.delete(peerId);
    this.remoteScreenStreams.delete(peerId);
    this.remoteCameraStreams.delete(peerId);
    this.peerMutedStates.delete(peerId);
    this.peerHasCamera.delete(peerId);
    this.peerIsScreenSharing.delete(peerId);

    // Ao desconectar um peer, invocar onParticipantSpeaking(peerId, false) para remover do estado de fala
    this.callbacks.onParticipantSpeaking?.(peerId, false);
    this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
    this.callbacks.onRemoteVideoStream?.(peerId, null, "camera");

    this.callbacks.onPeerDisconnected?.(peerId);
  }

  /** Habilita ou desabilita spatial audio para todos os peers remotos. */
  public setSpatialAudioEnabled(enabled: boolean) {
    this.spatialAudioEnabled = enabled;
    // Reconecta pipelines existentes com/sem panner
    for (const [peerId, nodes] of this.peerAudioNodes.entries()) {
      try {
        nodes.gain.disconnect();
      } catch {}
      const existingPanner = this.peerPanners.get(peerId);
      if (existingPanner) {
        try { existingPanner.disconnect(); } catch {}
        this.peerPanners.delete(peerId);
      }
      if (enabled && this.audioContext) {
        const peerIndex = Array.from(this.peers.keys()).indexOf(peerId);
        const totalPeers = Math.max(this.peers.size, 1);
        const position = computeSpatialPosition(peerIndex >= 0 ? peerIndex : 0, totalPeers);
        const panner = applySpatialPanner(this.audioContext, nodes.gain, this.audioContext.destination, position);
        this.peerPanners.set(peerId, panner);
      } else if (this.audioContext) {
        nodes.gain.connect(this.audioContext.destination);
      }
    }
  }

  private cleanupRemoteAudioNodes(peerId: string, onlyScreen = false) {
    if (!onlyScreen && this.peerAudioNodes.has(peerId)) {
      const node = this.peerAudioNodes.get(peerId)!;
      try {
        node.gain.disconnect();
        node.source.disconnect();
      } catch {}
      this.peerAudioNodes.delete(peerId);
    }
    if (this.screenAudioNodes.has(peerId)) {
      const sNode = this.screenAudioNodes.get(peerId)!;
      try {
        sNode.gain.disconnect();
        sNode.source.disconnect();
      } catch {}
      this.screenAudioNodes.delete(peerId);
    }
    if (!onlyScreen) {
      const panner = this.peerPanners.get(peerId);
      if (panner) {
        try { panner.disconnect(); } catch {}
        this.peerPanners.delete(peerId);
      }
    }
  }

  private attachRemoteAudioPipeline(peerId: string, stream: MediaStream, isScreenAudio = false) {
    this.cleanupRemoteAudioNodes(peerId, isScreenAudio);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === "closed") {
          this.audioContext = new AudioCtx();
          try {
            const devId = (useSettingsStore as any)?.getState?.()?.headphonesDevice;
            if (devId && devId !== "default" && typeof (this.audioContext as any).setSinkId === "function") {
              void (this.audioContext as any).setSinkId(devId).catch(() => {});
            }
          } catch {}
        }
        if (this.audioContext.state === "suspended") {
          void this.audioContext.resume().catch(() => {});
        }

        const source = this.audioContext.createMediaStreamSource(stream);
        const gain = this.audioContext.createGain();
        gain.gain.value = this.getEffectiveGain(peerId);

        if (!isScreenAudio && this.spatialAudioEnabled) {
          const peerIndex = Array.from(this.peers.keys()).indexOf(peerId);
          const totalPeers = Math.max(this.peers.size, 1);
          const position = computeSpatialPosition(peerIndex >= 0 ? peerIndex : 0, totalPeers);
          const panner = applySpatialPanner(this.audioContext, gain, this.audioContext.destination, position);
          this.peerPanners.set(peerId, panner);
        } else {
          gain.connect(this.audioContext.destination);
        }

        if (isScreenAudio) {
          this.screenAudioNodes.set(peerId, { gain, source });
          const screenAudio = this.screenAudioElements.get(peerId);
          if (screenAudio) screenAudio.muted = true;
        } else {
          this.peerAudioNodes.set(peerId, { gain, source });
          // Muta o HTMLAudioElement para evitar reprodução duplicada
          const audio = this.audioElements.get(peerId);
          if (audio) {
            audio.muted = true;
          }
        }
      }
    } catch (e) {
      console.warn("[WebRtcVoice] Web Audio GainNode fallback:", e);
      const targetMap = isScreenAudio ? this.screenAudioElements : this.audioElements;
      const audio = targetMap.get(peerId);
      if (audio) {
        audio.muted = this.isDeafened;
        audio.volume = Math.max(0, Math.min(1, this.getEffectiveGain(peerId)));
      }
    }

    if (!isScreenAudio) {
      this.attachRemoteVad(peerId, stream);
    }
  }

  private optimizeSdp(sdp: string): string {
    if (!sdp) return sdp;
    let modified = sdp;

    // 1. Otimiza áudio Opus para 128 kbps, estéreo e correção de erros (FEC)
    modified = modified.replace(
      /(a=fmtp:\d+ .*?maxaveragebitrate=)(\d+)/g,
      `$1128000;stereo=1;sprop-stereo=1;useinbandfec=1`
    );
    if (!modified.includes("useinbandfec=1") && modified.includes("opus/48000")) {
      modified = modified.replace(
        /(a=rtpmap:(\d+) opus\/48000\/2[\r\n]+)/g,
        `$1a=fmtp:$2 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000\r\n`
      );
    }

    // 2. Aloca largura de banda para vídeo (4.5 Mbps para nitidez 1080p60)
    if (modified.includes("m=video") && !modified.includes("b=AS:")) {
      modified = modified.replace(
        /(m=video[^\r\n]*[\r\n]+(?:c=[^\r\n]*[\r\n]+)?)/g,
        `$1b=AS:4500\r\nb=TIAS:4500000\r\n`
      );
    }

    return modified;
  }

  private tuneSender(sender: RTCRtpSender, maxBitrateBps: number = 4_500_000, degradationPreference: string = "maintain-resolution") {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      for (const enc of params.encodings) {
        enc.maxBitrate = maxBitrateBps;
      }
      if ("degradationPreference" in sender) {
        (sender as any).degradationPreference = degradationPreference;
      }
      void sender.setParameters(params).catch(() => {});
    } catch {}
  }

  private async restartIce(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || pc.connectionState === "closed") return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      const optimizedSdp = this.optimizeSdp(offer.sdp || "");
      await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });
      if (this.currentChannelId) {
        const api = useEchoApi();
        if (typeof api?.sendVoiceSignal === "function") {
          await api.sendVoiceSignal(this.currentChannelId, peerId, {
            type: "offer",
            sdp: { type: offer.type, sdp: optimizedSdp },
          });
        }
      }
    } catch (err) {
      console.warn(`[WebRtcVoice] Erro ao reiniciar ICE com ${peerId}:`, err);
    }
  }

  private vadHangTimer: any = null;

  /**
   * Local VAD is handled exclusively by the useVoiceActivity singleton hook
   * (adaptive noise floor, RMS/dB analysis, hysteresis, formant detection).
   * This stub exists only to maintain the interface contract — it does nothing.
   */
  private startVad() {
    // No-op: local VAD delegated to useVoiceActivity singleton to avoid
    // duplicate AudioContext, AnalyserNode, and setInterval overhead.
  }

  private stopVad() {
    if (this.vadHangTimer) {
      clearTimeout(this.vadHangTimer);
      this.vadHangTimer = null;
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.isSpeaking = false;
  }


  /** Mede RTT real via getStats() de todos os peers conectados. Retorna média em ms ou null se sem peers. */
  private async measureRtt(): Promise<number | null> {
    if (this.peers.size === 0) return null;
    const rtts: number[] = [];
    for (const pc of this.peers.values()) {
      try {
        const stats = await pc.getStats();
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') {
            rtts.push(Math.round(report.currentRoundTripTime * 1000));
          }
        });
      } catch {}
    }
    if (rtts.length === 0) return null;
    return Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);
  }

  private pulseSignalingFast() {
    if (this.sseSource && this.sseSource.readyState === EventSource.OPEN) {
      // SSE ativo: entrega de sinal é instantânea (<20ms), dispensa polling HTTP!
      return;
    }
    if (this.fastPollTimeout) clearTimeout(this.fastPollTimeout);
    this.fastPollTimeout = setTimeout(() => {
      void this.pollSignalsOnly();
    }, 200);
  }

  private async pollSignalsOnly() {
    if (!this.currentChannelId) return;
    const api = useEchoApi();
    if (typeof api?.getVoiceSignals !== "function") return;
    try {
      const sigRes = await api.getVoiceSignals(this.currentChannelId);
      if (sigRes?.signals && sigRes.signals.length > 0) {
        for (const item of sigRes.signals) {
          await this.handleIncomingSignal(item.fromUserId, item.signal);
        }
      }
    } catch {}
  }

  public async tickHeartbeat() {
    if (!this.currentChannelId) return;
    const api = useEchoApi();
    if (typeof api?.voiceHeartbeat !== "function") return;
    try {
      const hbRes = await api.voiceHeartbeat(this.currentChannelId, {
        guildId: this.currentGuildId ?? undefined,
        username: this.myUsername || undefined,
        avatarUrl: this.myAvatarUrl,
        isSpeaking: this.isSpeaking,
        isMuted: this.isMuted,
        isDeafened: this.isDeafened,
        isScreenSharing: this.isScreenSharing,
        hasCamera: this.isCameraOn,
      });

      if (hbRes) {
        if ((hbRes as any).myUserId) {
          this.myUserId = (hbRes as any).myUserId;
        }

        if (hbRes.participants) {
          this.callbacks.onParticipantsUpdate?.(hbRes.participants);
          this.syncPeers(hbRes.participants);
        }
      }
    } catch {}
  }

  private startHeartbeatAndSignalingLoop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.burstInterval) clearInterval(this.burstInterval);
    if (this.fastPollTimeout) clearTimeout(this.fastPollTimeout);

    const tick = async () => {
      if (!this.currentChannelId) return;
      const api = useEchoApi();
      if (typeof api?.voiceHeartbeat !== "function") return;

      try {
        // 1. Heartbeat com identificação e status atualizados
        const hbRes = await api.voiceHeartbeat(this.currentChannelId, {
          guildId: this.currentGuildId ?? undefined,
          username: this.myUsername || undefined,
          avatarUrl: this.myAvatarUrl,
          isSpeaking: this.isSpeaking,
          isMuted: this.isMuted,
          isDeafened: this.isDeafened,
          isScreenSharing: this.isScreenSharing,
          hasCamera: this.isCameraOn,
        });

        if (hbRes) {
          if ((hbRes as any).myUserId) {
            this.myUserId = (hbRes as any).myUserId;
          }

          if (hbRes.participants) {
            this.callbacks.onParticipantsUpdate?.(hbRes.participants);
            this.syncPeers(hbRes.participants);
          }
        }

        // 1.5. Medir RTT real e notificar store
        try {
          const rtt = await this.measureRtt();
          if (rtt !== null && typeof this.callbacks.onRttUpdate === 'function') {
            this.callbacks.onRttUpdate(rtt);
          }
        } catch {}

        // 2. Poll de sinais WebRTC recebidos: apenas como fallback se SSE estiver desconectado
        if (!this.sseSource || this.sseSource.readyState !== EventSource.OPEN) {
          await this.pollSignalsOnly();
        }
      } catch (err) {
        // Falha transitória
      }
    };

    // Primeiro tick imediato
    void tick();

    // Fast-path burst: apenas se SSE NÃO estiver conectado
    if (!this.sseSource || this.sseSource.readyState !== EventSource.OPEN) {
      let burstCount = 10;
      this.burstInterval = setInterval(() => {
        if (this.sseSource && this.sseSource.readyState === EventSource.OPEN) {
          if (this.burstInterval) {
            clearInterval(this.burstInterval);
            this.burstInterval = null;
          }
          return;
        }
        if (!this.currentChannelId || burstCount <= 0) {
          if (this.burstInterval) {
            clearInterval(this.burstInterval);
            this.burstInterval = null;
          }
          return;
        }
        burstCount--;
        void this.pollSignalsOnly();
      }, 400);
    }

    // Heartbeat adaptativo: 2s quando falando/tela, 4s em silencio (server timeout 10s)
    let currentHeartbeatMs = 4000;
    const setHeartbeatRate = (ms: number) => {
      if (currentHeartbeatMs !== ms) {
        currentHeartbeatMs = ms;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(adaptiveTick, ms);
      }
    };
    const adaptiveTick = () => {
      tick();
      const isActive = this.isSpeaking || this.isScreenSharing;
      setHeartbeatRate(isActive ? 2000 : 4000);
    };
    this.heartbeatInterval = setInterval(adaptiveTick, 4000);
  }

  private syncPeers(participants: Array<{ userId: string }>) {
    const myNorm = (this.myUserId || "").toLowerCase();
    const activePeerIds = new Set(
      participants
        .map((p) => p.userId)
        .filter((id) => {
          if (!id || id === "me") return false;
          return id.toLowerCase() !== myNorm && id.toLowerCase() !== "me";
        }),
    );

    // Remove desconectados
    for (const peerId of Array.from(this.peers.keys())) {
      if (!activePeerIds.has(peerId)) {
        this.cleanupPeer(peerId);
      }
    }

    // Cria conexão para novos participantes (inicia offer se for o peer com ID maior para evitar colisão; senão pré-inicializa)
    for (const peerId of activePeerIds) {
      if (!this.peers.has(peerId)) {
        const isInitiator = this.myUserId > peerId;
        void this.createPeerConnection(peerId, isInitiator);
      }
    }
  }

  private attachRemoteVad(peerId: string, stream: MediaStream) {
    if (this.remoteAnalysers.has(peerId)) {
      const existing = this.remoteAnalysers.get(peerId)!;
      clearInterval(existing.interval);
      if (existing.hangTimer) {
        clearTimeout(existing.hangTimer);
      }
      this.remoteAnalysers.delete(peerId);
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = this.audioContext || new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let wasSpeaking = false;
      let hangTimer: any = null;

      const interval = setInterval(() => {
        // If peer is muted or disconnected, NEVER activate speaking status
        if (this.peerMutedStates.get(peerId)) {
          if (wasSpeaking) {
            wasSpeaking = false;
            if (hangTimer) {
              clearTimeout(hangTimer);
              hangTimer = null;
            }
            this.callbacks.onParticipantSpeaking?.(peerId, false);
          }
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Optimized thresholds: attack=10 (was 14), release=6 (was 9)
        const attackThreshold = 10;
        const releaseThreshold = 6;

        if (avg > attackThreshold) {
          if (hangTimer) {
            clearTimeout(hangTimer);
            hangTimer = null;
          }
          if (!wasSpeaking) {
            wasSpeaking = true;
            this.callbacks.onParticipantSpeaking?.(peerId, true);
          }
        } else if (avg < releaseThreshold && wasSpeaking) {
          if (!hangTimer) {
            hangTimer = setTimeout(() => {
              wasSpeaking = false;
              hangTimer = null;
              this.callbacks.onParticipantSpeaking?.(peerId, false);
            }, 180); // 180ms hang time (reduced from 250ms)
          }
        }
      }, 50); // 50ms sample rate (~20fps, reduced from 70ms)

      this.remoteAnalysers.set(peerId, { analyser, source, interval, hangTimer });
    } catch {}
  }

  private createPeerConnection(peerId: string, isInitiator: boolean): RTCPeerConnection {
    let pc = this.peers.get(peerId);
    if (pc) return pc;
    if (typeof RTCPeerConnection === "undefined") return {} as any;

    pc = new RTCPeerConnection(this.rtcConfig);
    this.peers.set(peerId, pc);

    // Monitoramento do estado da conexão e auto ICE restart em caso de queda
    pc.onconnectionstatechange = () => {
      const state = pc!.connectionState;
      if (state === "connected") {
        this.notifyConnected(peerId);
      } else if (state === "failed") {
        this.callbacks.onPeerDisconnected?.(peerId);
        this.callbacks.onParticipantSpeaking?.(peerId, false);
        void this.restartIce(peerId);
      } else if (state === "disconnected") {
        this.callbacks.onPeerDisconnected?.(peerId);
        this.callbacks.onParticipantSpeaking?.(peerId, false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc!.iceConnectionState === "connected") {
        this.notifyConnected(peerId);
      }
    };

    // Garante transceiver de vídeo para permitir enviar e receber transmissões de tela/câmera
    try {
      pc.addTransceiver("video", { direction: "sendrecv" });
    } catch {}

    // Adiciona faixa de áudio local
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        try {
          pc.addTrack(track, this.localStream);
        } catch {}
      }
    }

    // Se já estiver transmitindo tela, anexa a faixa de vídeo e áudio ao novo peer
    if (this.localScreenStream) {
      for (const track of this.localScreenStream.getVideoTracks()) {
        if (track.readyState === "live") {
          try {
            const sender = pc.addTrack(track, this.localScreenStream);
            this.screenSenders.set(peerId, sender);
            this.tuneSender(sender, this.screenShareBitrate);
            void this.sendVideoMeta(peerId, this.localScreenStream.id, track.id, "screen");
          } catch {}
        }
      }
      for (const audioTrack of this.localScreenStream.getAudioTracks()) {
        if (audioTrack.readyState === "live") {
          try {
            const sender = pc.addTrack(audioTrack, this.localScreenStream);
            this.screenAudioSenders.set(peerId, sender);
          } catch {}
        }
      }
    }

    // Se já estiver com câmera ativa, anexa a faixa ao novo peer
    if (this.localCameraStream) {
      for (const track of this.localCameraStream.getVideoTracks()) {
        if (track.readyState === "live") {
          try {
            const sender = pc.addTrack(track, this.localCameraStream);
            this.cameraSenders.set(peerId, sender);
            void this.sendVideoMeta(peerId, this.localCameraStream.id, track.id, "camera");
          } catch {}
        }
      }
    }

    // Envio de ICE Candidate gerado localmente
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentChannelId) {
        const api = useEchoApi();
        if (typeof api?.sendVoiceSignal === "function") {
          void api.sendVoiceSignal(this.currentChannelId, peerId, {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          });
        }
      }
    };

    // Recepção de faixas remotas (áudio ou vídeo/tela)
    pc.ontrack = (event) => {
      const track = event.track;
      let stream = event.streams?.[0];
      if (!stream && track) {
        stream = new MediaStream([track]);
      }
      if (!stream) return;

      if (track.kind === "audio") {
        const primaryAudio = this.audioElements.get(peerId);
        const isPrimaryLive =
          primaryAudio &&
          primaryAudio.srcObject instanceof MediaStream &&
          primaryAudio.srcObject.getAudioTracks().some((t) => t.readyState === "live" && t.id !== track.id);

        if (isPrimaryLive) {
          // Faixa de áudio secundária (ex: áudio de compartilhamento de tela / sistema)
          let screenAudio = this.screenAudioElements.get(peerId);
          if (!screenAudio) {
            screenAudio = document.createElement("audio");
            screenAudio.autoplay = true;
            screenAudio.muted = this.isDeafened;
            screenAudio.volume = 1.0;
            document.body.appendChild(screenAudio);
            this.screenAudioElements.set(peerId, screenAudio);
          }
          screenAudio.srcObject = stream;
          screenAudio.muted = this.isDeafened;
          screenAudio.volume = 1.0;

          void this.applyOutputDeviceToElement(screenAudio);
          void screenAudio.play().catch(() => {});
          this.attachRemoteAudioPipeline(peerId, stream, true);

          track.onended = () => {
            this.cleanupRemoteAudioNodes(peerId, true);
            const el = this.screenAudioElements.get(peerId);
            if (el) {
              try {
                el.pause();
                el.srcObject = null;
                el.remove();
              } catch {}
              this.screenAudioElements.delete(peerId);
            }
          };
        } else {
          let audio = this.audioElements.get(peerId);
          if (!audio) {
            audio = document.createElement("audio");
            audio.autoplay = true;
            audio.muted = this.isDeafened;
            audio.volume = 1.0;
            document.body.appendChild(audio);
            this.audioElements.set(peerId, audio);
          }
          audio.srcObject = stream;
          audio.muted = this.isDeafened;
          audio.volume = 1.0;

          // Aplica setSinkId para rotear áudio ao dispositivo de saída selecionado
          void this.applyOutputDeviceToElement(audio);

          void audio.play().catch(() => {});

          // Pipeline Web Audio com GainNode (0-200% volume boost) e VAD em tempo real
          this.attachRemoteAudioPipeline(peerId, stream, false);
        }
      } else if (track.kind === "video") {
        // Transmissão remota de tela ou webcam — classifica via video-meta ou estado SSE
        const videoStream = stream;
        const resolveVideoKind = (): "camera" | "screen" => {
          const fromMeta =
            this.remoteVideoMeta.get(track.id) ?? this.remoteVideoMeta.get(videoStream.id);
          if (fromMeta) return fromMeta;

          const hasCam = Boolean(this.peerHasCamera.get(peerId));
          const isSharing = Boolean(this.peerIsScreenSharing.get(peerId));

          if (isSharing && !hasCam) return "screen";
          if (hasCam && !isSharing) return "camera";

          const existingScreen = this.remoteScreenStreams.get(peerId);
          const existingCam = this.remoteCameraStreams.get(peerId);
          if (existingScreen && existingScreen.id !== videoStream.id) return "camera";
          if (existingCam && existingCam.id !== videoStream.id) return "screen";

          return hasCam ? "camera" : "screen";
        };

        const videoKind = resolveVideoKind();
        const storeRemoteVideo = (kind: "camera" | "screen") => {
          if (kind === "camera") {
            this.remoteCameraStreams.set(peerId, videoStream);
          } else {
            this.remoteScreenStreams.set(peerId, videoStream);
          }
          this.remoteVideoStreams.set(
            peerId,
            this.remoteScreenStreams.get(peerId) ?? videoStream,
          );
          this.callbacks.onRemoteVideoStream?.(peerId, videoStream, kind);
        };

        storeRemoteVideo(videoKind);

        track.onended = () => {
          const kindNow = resolveVideoKind();
          if (kindNow === "camera") {
            this.remoteCameraStreams.delete(peerId);
          } else {
            this.remoteScreenStreams.delete(peerId);
          }
          const remaining =
            this.remoteScreenStreams.get(peerId) ?? this.remoteCameraStreams.get(peerId);
          if (remaining) {
            this.remoteVideoStreams.set(peerId, remaining);
          } else {
            this.remoteVideoStreams.delete(peerId);
          }
          this.callbacks.onRemoteVideoStream?.(peerId, null, kindNow);
        };

        track.onunmute = () => {
          storeRemoteVideo(resolveVideoKind());
        };

        track.onmute = () => {
          // Não descarta o stream prematuramente em oscilações transitórias de rede (bug dos 800ms).
          // O encerramento real do stream é tratado por track.onended ou evento participant_updated via SSE.
        };
      }
    };

    // Se formos o iniciador da conexão, cria a oferta SDP completa com otimização
    if (isInitiator) {
      void (async () => {
        try {
          const offer = await pc!.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          const optimizedSdp = this.optimizeSdp(offer.sdp || "");
          await pc!.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

          if (this.currentChannelId) {
            const api = useEchoApi();
            if (typeof api?.sendVoiceSignal === "function") {
              await api.sendVoiceSignal(this.currentChannelId, peerId, {
                type: "offer",
                sdp: { type: offer.type, sdp: optimizedSdp },
              });
              this.pulseSignalingFast();
            }
          }
        } catch (err) {
          console.warn("[WebRtcVoice] Erro ao criar oferta:", err);
        }
      })();
    }

    return pc;
  }

  /**
   * Configura ou remove o stream de compartilhamento de tela local.
   * @param stream - MediaStream da captura de tela (ou null para parar)
   * @param options - Opções de qualidade e otimização de conteúdo
   */
  public async setLocalScreenShare(
    stream: MediaStream | null,
    options?: {
      contentHint?: "auto" | "detail" | "motion" | "text";
      qualityPreset?: "auto" | "low" | "medium" | "high";
    },
  ) {
    this.localScreenStream = stream;
    this.isScreenSharing = Boolean(
      stream && stream.getVideoTracks().some((t) => t.readyState === "live"),
    );
    const videoTrack = stream ? stream.getVideoTracks()[0] : null;
    const audioTrack = stream ? stream.getAudioTracks()[0] : null;

    // Content hint adaptativo baseado na preferência do usuário
    if (videoTrack && "contentHint" in videoTrack) {
      const hint = options?.contentHint ?? "auto";
      if (hint === "auto") {
        // Auto: usa "detail" como padrão seguro para screen share
        videoTrack.contentHint = "detail";
      } else {
        videoTrack.contentHint = hint;
      }
    }

    // Bitrate dinâmico baseado no preset de qualidade
    const qualityBitrates: Record<string, number> = {
      low: 1_500_000,     // ~1.5 Mbps
      medium: 3_000_000,  // ~3 Mbps
      high: 4_500_000,    // ~4.5 Mbps
      auto: 4_500_000,    // Auto usa máximo, WebRTC ajusta conforme rede
    };
    this.screenShareBitrate = qualityBitrates[options?.qualityPreset ?? "auto"] ?? 4_500_000;

    for (const [peerId, pc] of this.peers.entries()) {
      try {
        let needsRenegotiate = false;

        // 1. Trata faixa de vídeo da transmissão de tela (1080p 60fps)
        const existingVideoSender = this.screenSenders.get(peerId);
        if (videoTrack) {
          if (existingVideoSender) {
            await existingVideoSender.replaceTrack(videoTrack);
            this.tuneSender(existingVideoSender, this.screenShareBitrate);
            const tr = pc.getTransceivers().find((t) => t.sender === existingVideoSender);
            if (tr) tr.direction = "sendrecv";
            needsRenegotiate = true;
          } else {
            // Reutiliza transceiver de vídeo existente (nunca áudio), ou associa a nova faixa
            const tr = pc.getTransceivers().find(
              (t) =>
                t.receiver.track?.kind === "video" &&
                (!t.sender.track || t.sender === this.screenSenders.get(peerId)),
            );
            if (tr) {
              tr.direction = "sendrecv";
              await tr.sender.replaceTrack(videoTrack);
              this.screenSenders.set(peerId, tr.sender);
              this.tuneSender(tr.sender, this.screenShareBitrate);
            } else {
              const sender = pc.addTrack(videoTrack, stream!);
              this.screenSenders.set(peerId, sender);
              this.tuneSender(sender, this.screenShareBitrate);
            }
            needsRenegotiate = true;
          }
        } else if (existingVideoSender) {
          const tr = pc.getTransceivers().find((t) => t.sender === existingVideoSender);
          if (tr) {
            tr.direction = "recvonly";
            try {
              await tr.sender.replaceTrack(null);
            } catch {}
          } else {
            try {
              pc.removeTrack(existingVideoSender);
            } catch {}
          }
          this.screenSenders.delete(peerId);
          needsRenegotiate = true;
        }

        // 2. Trata áudio compartilhado do sistema/aba
        const existingAudioSender = this.screenAudioSenders.get(peerId);
        if (audioTrack) {
          if (existingAudioSender) {
            await existingAudioSender.replaceTrack(audioTrack);
          } else {
            const sender = pc.addTrack(audioTrack, stream!);
            this.screenAudioSenders.set(peerId, sender);
            needsRenegotiate = true;
          }
        } else if (existingAudioSender) {
          pc.removeTrack(existingAudioSender);
          this.screenAudioSenders.delete(peerId);
          needsRenegotiate = true;
        }

        if (videoTrack && stream) {
          void this.sendVideoMeta(peerId, stream.id, videoTrack.id, "screen");
        }

        if (needsRenegotiate) {
          await this.renegotiateWithPeer(peerId);
        }
      } catch (err) {
        console.warn(`[WebRtcVoice] Erro ao sincronizar tela com peer ${peerId}:`, err);
      }
    }

    void this.tickHeartbeat();
  }

  public async setLocalCamera(stream: MediaStream | null) {
    this.localCameraStream = stream;
    this.isCameraOn = Boolean(
      stream && stream.getVideoTracks().some((t) => t.readyState === "live"),
    );
    const track = stream ? stream.getVideoTracks()[0] : null;

    for (const [peerId, pc] of this.peers.entries()) {
      try {
        const existingSender = this.cameraSenders.get(peerId);
        if (track && stream) {
          void this.sendVideoMeta(peerId, stream.id, track.id, "camera");
          if (existingSender) {
            await existingSender.replaceTrack(track);
          } else {
            const sender = pc.addTrack(track, stream);
            this.cameraSenders.set(peerId, sender);
            await this.renegotiateWithPeer(peerId);
          }
        } else {
          if (existingSender) {
            pc.removeTrack(existingSender);
            this.cameraSenders.delete(peerId);
            await this.renegotiateWithPeer(peerId);
          }
        }
      } catch (err) {
        console.warn(`[WebRtcVoice] Erro ao sincronizar câmera com peer ${peerId}:`, err);
      }
    }

    void this.tickHeartbeat();
  }

  private async sendVideoMeta(
    peerId: string,
    streamId: string,
    trackId: string,
    kind: "screen" | "camera",
  ) {
    if (!this.currentChannelId) return;
    const api = useEchoApi();
    if (typeof api?.sendVoiceSignal !== "function") return;
    try {
      await api.sendVoiceSignal(this.currentChannelId, peerId, {
        type: "video-meta",
        streamId,
        trackId,
        kind,
      });
    } catch {}
  }

  public getRemoteVideoStream(peerId: string): MediaStream | null {
    return this.remoteScreenStreams.get(peerId) ?? this.remoteCameraStreams.get(peerId) ?? this.remoteVideoStreams.get(peerId) ?? null;
  }

  public getRemoteScreenStream(peerId: string): MediaStream | null {
    return this.remoteScreenStreams.get(peerId) ?? null;
  }

  public getRemoteCameraStream(peerId: string): MediaStream | null {
    return this.remoteCameraStreams.get(peerId) ?? null;
  }

  private async renegotiateWithPeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || !this.currentChannelId) return;

    try {
      const sender = this.screenSenders.get(peerId);
      if (sender) {
        this.tuneSender(sender, this.screenShareBitrate);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      const optimizedSdp = this.optimizeSdp(offer.sdp || "");
      await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

      const api = useEchoApi();
      if (typeof api?.sendVoiceSignal === "function") {
        await api.sendVoiceSignal(this.currentChannelId, peerId, {
          type: "offer",
          sdp: { type: offer.type, sdp: optimizedSdp },
        });
        this.pulseSignalingFast();
      }
    } catch (err) {
      console.warn(`[WebRtcVoice] Erro ao renegociar com ${peerId}:`, err);
    }
  }

  private async handleIncomingSignal(fromUserId: string, signal: any) {
    if (!signal || !this.currentChannelId) return;

    if (signal.type === "offer") {
      let pc = this.peers.get(fromUserId);
      if (!pc) {
        pc = this.createPeerConnection(fromUserId, false);
      }

      // Trata colisão/glare de ofertas durante renegociação
      if (pc.signalingState !== "stable") {
        if (this.myUserId < fromUserId) {
          try {
            await pc.setLocalDescription({ type: "rollback" } as any);
          } catch {}
        } else {
          return;
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

      // Assegura que transceivers de vídeo estejam prontos para recepção
      for (const tr of pc.getTransceivers()) {
        if (tr.receiver.track?.kind === "video" && tr.direction === "inactive") {
          tr.direction = "recvonly";
        }
      }

      // Drena candidatos ICE enfileirados
      const queued = this.candidateQueues.get(fromUserId) || [];
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {}
      }
      this.candidateQueues.delete(fromUserId);
      if (this.candidateQueues.size === 0) {
        this.candidateQueues.clear();
      }

      const answer = await pc.createAnswer();
      const optimizedAnswer = this.optimizeSdp(answer.sdp || "");
      await pc.setLocalDescription({ type: answer.type, sdp: optimizedAnswer });

      const scrSender = this.screenSenders.get(fromUserId);
      if (scrSender) {
        this.tuneSender(scrSender, this.screenShareBitrate);
      }

      const api = useEchoApi();
      if (typeof api?.sendVoiceSignal === "function") {
        await api.sendVoiceSignal(this.currentChannelId, fromUserId, {
          type: "answer",
          sdp: { type: answer.type, sdp: optimizedAnswer },
        });
        this.pulseSignalingFast();
      }
    } else if (signal.type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        const scrSender = this.screenSenders.get(fromUserId);
        if (scrSender) {
          this.tuneSender(scrSender, this.screenShareBitrate);
        }

        const queued = this.candidateQueues.get(fromUserId) || [];
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        this.candidateQueues.delete(fromUserId);
        if (this.candidateQueues.size === 0) {
          this.candidateQueues.clear();
        }
        this.pulseSignalingFast();
      }
    } else if (signal.type === "candidate") {
      const pc = this.peers.get(fromUserId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn("[WebRtcVoice] Erro ao adicionar ICE candidate:", e);
        }
      } else {
        if (!this.candidateQueues.has(fromUserId)) {
          this.candidateQueues.set(fromUserId, []);
        }
        this.candidateQueues.get(fromUserId)!.push(signal.candidate);
      }
    } else if (signal.type === "video-meta" && (signal.kind === "screen" || signal.kind === "camera")) {
      if (signal.trackId) this.remoteVideoMeta.set(signal.trackId, signal.kind);
      if (signal.streamId) this.remoteVideoMeta.set(signal.streamId, signal.kind);
      // Se o stream já chegou antes do sinal video-meta, reclassifica imediatamente
      const wrongMap = signal.kind === "camera" ? this.remoteScreenStreams : this.remoteCameraStreams;
      const rightMap = signal.kind === "camera" ? this.remoteCameraStreams : this.remoteScreenStreams;
      const existing = wrongMap.get(fromUserId);
      if (
        existing &&
        (existing.id === signal.streamId ||
          existing.getVideoTracks().some((t) => t.id === signal.trackId))
      ) {
        wrongMap.delete(fromUserId);
        rightMap.set(fromUserId, existing);
        this.callbacks.onRemoteVideoStream?.(fromUserId, null, signal.kind === "camera" ? "screen" : "camera");
        this.callbacks.onRemoteVideoStream?.(fromUserId, existing, signal.kind);
      }
    } else if (signal.type === "soundboard" && typeof signal.soundId === "string") {
      if (!this.isDeafened) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("echo:soundboard-play", {
              detail: { fromUserId, soundId: signal.soundId },
            })
          );
        }
        this.callbacks.onSoundboardEffect?.(fromUserId, signal.soundId);
      }
    }
  }

  /**
   * Envia um efeito sonoro do Soundboard para todos os pares conectados na sala atual.
   */
  public async sendSoundboardEffect(soundId: string): Promise<void> {
    if (!this.currentChannelId) return;
    const api = useEchoApi();
    if (typeof api?.sendVoiceSignal !== "function") return;
    for (const peerId of this.peers.keys()) {
      void api.sendVoiceSignal(this.currentChannelId, peerId, {
        type: "soundboard",
        soundId,
      }).catch(() => {});
    }
  }
}

export const webrtcVoice = new WebRtcVoiceManager();
