import { useEchoApi } from "@/lib/api/echoApi";
import { ECHO_API_CONFIG } from "@/lib/api/config";

export interface WebRtcCallbacks {
  onParticipantsUpdate?: (participants: any[]) => void;
  onParticipantUpdated?: (userId: string, data: Partial<any>) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onParticipantSpeaking?: (userId: string, isSpeaking: boolean) => void;
  onRemoteVideoStream?: (userId: string, stream: MediaStream | null, kind: "screen" | "camera") => void;
  onRttUpdate?: (rttMs: number) => void;
  onPeerConnected?: (userId: string) => void;
  onPeerDisconnected?: (userId: string) => void;
  onError?: (err: Error) => void;
}

class WebRtcVoiceManager {
  private localStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private localCameraStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
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
  private screenSenders: Map<string, RTCRtpSender> = new Map();
  private screenAudioSenders: Map<string, RTCRtpSender> = new Map();
  private cameraSenders: Map<string, RTCRtpSender> = new Map();
  private remoteVideoStreams: Map<string, MediaStream> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAnalysers: Map<string, { analyser: AnalyserNode; interval: any }> = new Map();
  private callbacks: WebRtcCallbacks = {};
  private sseSource: EventSource | null = null;
  private peerVolumes: Map<string, number> = new Map();
  private peerAudioNodes: Map<string, { gain: GainNode; source: MediaStreamAudioSourceNode }> = new Map();

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

  public getCurrentGuildId() {
    return this.currentGuildId;
  }

  public getCurrentChannelId() {
    return this.currentChannelId;
  }

  public getMyUserId() {
    return this.myUserId;
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
      await this.leave();
    }

    this.currentGuildId = guildId;
    this.currentChannelId = channelId;
    this.myUserId = myUserId;
    this.myUsername = username;
    this.myAvatarUrl = avatarUrl;
    this.isMuted = isMuted;
    this.isDeafened = isDeafened;
    this.callbacks = callbacks;

    // 1. Captura de microfone local (reutiliza stream existente para troca instantânea)
    try {
      const streamLive =
        this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === "live");
      if (!streamLive && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
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
              this.remoteVideoStreams.delete(data.userId);
              this.callbacks.onRemoteVideoStream?.(data.userId, null, "screen");
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

  public async leave() {
    this.disconnectSse();
    this.stopVad();
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

    // Para faixas locais de áudio
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
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

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
      this.analyser = null;
    }

    this.peerVolumes.clear();
    this.currentGuildId = null;
    this.currentChannelId = null;
  }

  /**
   * Envia sinal síncrono/keepalive de saída ao fechar janela/processo
   * garantindo que o servidor remova o usuário mesmo se o runtime fechar antes.
   */
  public leaveSyncOrKeepalive() {
    this.disconnectSse();
    if (!this.currentChannelId) return;
    const chId = this.currentChannelId;
    this.currentChannelId = null;
    this.currentGuildId = null;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

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
    for (const [peerId, node] of this.peerAudioNodes.entries()) {
      const userVol = this.peerVolumes.get(peerId) ?? 100;
      node.gain.gain.value = deafened ? 0 : userVol / 100;
    }
    if (deafened) {
      this.setMicrophoneMuted(true);
    }
  }

  public setParticipantVolume(userId: string, volume: number) {
    this.peerVolumes.set(userId, volume);
    const audio = this.audioElements.get(userId);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume / 100));
    }
    const node = this.peerAudioNodes.get(userId);
    if (node) {
      node.gain.gain.value = this.isDeafened ? 0 : Math.max(0, volume / 100);
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

    if (this.remoteAnalysers.has(peerId)) {
      const a = this.remoteAnalysers.get(peerId)!;
      clearInterval(a.interval);
      this.remoteAnalysers.delete(peerId);
    }

    this.cleanupRemoteAudioNodes(peerId);

    this.screenSenders.delete(peerId);
    this.screenAudioSenders.delete(peerId);
    this.cameraSenders.delete(peerId);
    this.candidateQueues.delete(peerId);
    this.remoteVideoStreams.delete(peerId);
    this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");

    if (this.remoteVideoStreams.has(peerId)) {
      this.remoteVideoStreams.delete(peerId);
      this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
    }

    this.callbacks.onPeerDisconnected?.(peerId);
  }

  private cleanupRemoteAudioNodes(peerId: string) {
    if (this.peerAudioNodes.has(peerId)) {
      const node = this.peerAudioNodes.get(peerId)!;
      try {
        node.gain.disconnect();
        node.source.disconnect();
      } catch {}
      this.peerAudioNodes.delete(peerId);
    }
  }

  private attachRemoteAudioPipeline(peerId: string, stream: MediaStream) {
    this.cleanupRemoteAudioNodes(peerId);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === "closed") {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === "suspended") {
          void this.audioContext.resume().catch(() => {});
        }

        const source = this.audioContext.createMediaStreamSource(stream);
        const gain = this.audioContext.createGain();
        const userVol = this.peerVolumes.get(peerId) ?? 100;
        gain.gain.value = this.isDeafened ? 0 : userVol / 100;

        source.connect(gain);
        gain.connect(this.audioContext.destination);

        this.peerAudioNodes.set(peerId, { gain, source });

        // Muta o HTMLAudioElement para evitar reprodução duplicada
        const audio = this.audioElements.get(peerId);
        if (audio) {
          audio.muted = true;
        }
      }
    } catch (e) {
      console.warn("[WebRtcVoice] Web Audio GainNode fallback:", e);
      const audio = this.audioElements.get(peerId);
      if (audio) {
        audio.muted = this.isDeafened;
        audio.volume = Math.max(0, Math.min(1, (this.peerVolumes.get(peerId) ?? 100) / 100));
      }
    }

    this.attachRemoteVad(peerId, stream);
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

  private startVad() {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.vadInterval = setInterval(() => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.callbacks.onSpeakingChange?.(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const speakingNow = average > 14; // Limiar de sensibilidade do microfone

        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.callbacks.onSpeakingChange?.(speakingNow);
        }
      }, 120);
    } catch (e) {
      console.warn("[WebRtcVoice] Não foi possível iniciar VAD:", e);
    }
  }

  private stopVad() {
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

    // Heartbeat a cada 4 segundos (server tem timeout defensivo de 10s)
    this.heartbeatInterval = setInterval(tick, 4000);
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

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const isSpeaking = avg > 12;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.callbacks.onParticipantSpeaking?.(peerId, isSpeaking);
        }
      }, 100);

      this.remoteAnalysers.set(peerId, { analyser, interval });
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
        this.callbacks.onPeerConnected?.(peerId);
      } else if (state === "failed") {
        this.callbacks.onPeerDisconnected?.(peerId);
        void this.restartIce(peerId);
      } else if (state === "disconnected") {
        this.callbacks.onPeerDisconnected?.(peerId);
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
            this.tuneSender(sender, 4_500_000);
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
        void audio.play().catch(() => {});

        // Pipeline Web Audio com GainNode (0-200% volume boost) e VAD em tempo real
        this.attachRemoteAudioPipeline(peerId, stream);
      } else if (track.kind === "video") {
        // Transmissão remota de tela ou webcam
        const videoStream = stream;
        this.remoteVideoStreams.set(peerId, videoStream);
        this.callbacks.onRemoteVideoStream?.(peerId, videoStream, "screen");

        track.onended = () => {
          this.remoteVideoStreams.delete(peerId);
          this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
        };

        track.onunmute = () => {
          this.remoteVideoStreams.set(peerId, videoStream);
          this.callbacks.onRemoteVideoStream?.(peerId, videoStream, "screen");
        };

        track.onmute = () => {
          setTimeout(() => {
            if (track.muted || track.readyState === "ended") {
              this.remoteVideoStreams.delete(peerId);
              this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
            }
          }, 800);
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

  public async setLocalScreenShare(stream: MediaStream | null) {
    this.localScreenStream = stream;
    this.isScreenSharing = Boolean(
      stream && stream.getVideoTracks().some((t) => t.readyState === "live"),
    );
    const videoTrack = stream ? stream.getVideoTracks()[0] : null;
    const audioTrack = stream ? stream.getAudioTracks()[0] : null;

    if (videoTrack && "contentHint" in videoTrack) {
      videoTrack.contentHint = "detail";
    }

    for (const [peerId, pc] of this.peers.entries()) {
      try {
        let needsRenegotiate = false;

        // 1. Trata faixa de vídeo da transmissão de tela (1080p 60fps)
        const existingVideoSender = this.screenSenders.get(peerId);
        if (videoTrack) {
          if (existingVideoSender) {
            await existingVideoSender.replaceTrack(videoTrack);
            const tr = pc.getTransceivers().find((t) => t.sender === existingVideoSender);
            if (tr) tr.direction = "sendrecv";
            needsRenegotiate = true;
          } else {
            // Reutiliza transceiver de vídeo existente se houver, ou associa a nova faixa
            const tr = pc.getTransceivers().find((t) => t.receiver.track?.kind === "video" || t.sender.track === null);
            if (tr) {
              tr.direction = "sendrecv";
              await tr.sender.replaceTrack(videoTrack);
              this.screenSenders.set(peerId, tr.sender);
            } else {
              const sender = pc.addTrack(videoTrack, stream!);
              this.screenSenders.set(peerId, sender);
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
        if (track) {
          if (existingSender) {
            await existingSender.replaceTrack(track);
          } else {
            const sender = pc.addTrack(track, stream!);
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

  public getRemoteVideoStream(peerId: string): MediaStream | null {
    return this.remoteVideoStreams.get(peerId) ?? null;
  }

  private async renegotiateWithPeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || !this.currentChannelId) return;

    try {
      const sender = this.screenSenders.get(peerId);
      if (sender) {
        this.tuneSender(sender, 4_500_000);
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
        this.tuneSender(scrSender, 4_500_000);
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
          this.tuneSender(scrSender, 4_500_000);
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
    }
  }
}

export const webrtcVoice = new WebRtcVoiceManager();
