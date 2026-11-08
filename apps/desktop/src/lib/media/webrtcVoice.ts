import { useEchoApi } from "@/lib/api/echoApi";
import { ECHO_API_CONFIG } from "@/lib/api/config";

export interface WebRtcCallbacks {
  onParticipantsUpdate?: (participants: any[]) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onParticipantSpeaking?: (userId: string, isSpeaking: boolean) => void;
  onRemoteVideoStream?: (userId: string, stream: MediaStream | null, kind: "screen" | "camera") => void;
  onRttUpdate?: (rttMs: number) => void;
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
  private cameraSenders: Map<string, RTCRtpSender> = new Map();
  private remoteVideoStreams: Map<string, MediaStream> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAnalysers: Map<string, { analyser: AnalyserNode; interval: any }> = new Map();
  private callbacks: WebRtcCallbacks = {};

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

    // 3. Inicia loop de Heartbeat e Sinalização
    this.startHeartbeatAndSignalingLoop();
  }

  public async leaveOldChannelOnly() {
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

    for (const item of this.remoteAnalysers.values()) {
      clearInterval(item.interval);
    }
    this.remoteAnalysers.clear();

    for (const pc of this.peers.values()) {
      try {
        pc.close();
      } catch {}
    }
    this.peers.clear();

    for (const audio of this.audioElements.values()) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
    }
    this.audioElements.clear();
    this.candidateQueues.clear();
    this.screenSenders.clear();
    this.cameraSenders.clear();
    for (const peerId of this.remoteVideoStreams.keys()) {
      this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
    }
    this.remoteVideoStreams.clear();
    this.localScreenStream = null;
    this.localCameraStream = null;
    this.isScreenSharing = false;
    this.isCameraOn = false;
    this.screenSenders.clear();
    this.cameraSenders.clear();
    for (const peerId of this.remoteVideoStreams.keys()) {
      this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
    }
    this.remoteVideoStreams.clear();
  }

  public async leave() {
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

    // Para analisadores remotos de fala
    for (const item of this.remoteAnalysers.values()) {
      clearInterval(item.interval);
    }
    this.remoteAnalysers.clear();

    // Fecha conexões peer
    for (const pc of this.peers.values()) {
      try {
        pc.close();
      } catch {}
    }
    this.peers.clear();

    // Remove elementos de áudio
    for (const audio of this.audioElements.values()) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
    }
    this.audioElements.clear();
    this.candidateQueues.clear();
    this.screenSenders.clear();
    this.cameraSenders.clear();
    for (const peerId of this.remoteVideoStreams.keys()) {
      this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
    }
    this.remoteVideoStreams.clear();
    this.localScreenStream = null;
    this.localCameraStream = null;
    this.isScreenSharing = false;
    this.isCameraOn = false;

    // Para faixas locais
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
      this.analyser = null;
    }

    this.currentGuildId = null;
    this.currentChannelId = null;
  }

  /**
   * Envia sinal síncrono/keepalive de saída ao fechar janela/processo
   * garantindo que o servidor remova o usuário mesmo se o runtime fechar antes.
   */
  public leaveSyncOrKeepalive() {
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
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    for (const audio of this.audioElements.values()) {
      audio.muted = deafened;
    }
  }

  public setParticipantVolume(userId: string, volume: number) {
    const audio = this.audioElements.get(userId);
    if (audio) {
      // volume 0..200 normalizado para 0..1 (acima de 1 usa Web Audio se necessário, ou max 1.0)
      audio.volume = Math.max(0, Math.min(1, volume / 100));
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

        // 2. Poll de sinais WebRTC recebidos
        await this.pollSignalsOnly();
      } catch (err) {
        // Falha transitória
      }
    };

    // Primeiro tick imediato
    void tick();

    // Fast-path burst: nos primeiros 4 segundos, consulta sinais a cada 400ms para conectar WebRTC instantaneamente
    let burstCount = 10;
    this.burstInterval = setInterval(() => {
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

    // A cada 2.5s para manutenção contínua
    this.heartbeatInterval = setInterval(tick, 2500);
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
    for (const [peerId, pc] of this.peers.entries()) {
      if (!activePeerIds.has(peerId)) {
        try {
          pc.close();
        } catch {}
        this.peers.delete(peerId);

        const audio = this.audioElements.get(peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
          this.audioElements.delete(peerId);
        }

        if (this.remoteAnalysers.has(peerId)) {
          const a = this.remoteAnalysers.get(peerId)!;
          clearInterval(a.interval);
          this.remoteAnalysers.delete(peerId);
        }

        if (this.remoteVideoStreams.has(peerId)) {
          this.remoteVideoStreams.delete(peerId);
          this.callbacks.onRemoteVideoStream?.(peerId, null, "screen");
        }
      }
    }

    // Cria conexão para novos participantes (inicia offer se for o peer com ID maior para evitar colisão)
    for (const peerId of activePeerIds) {
      if (!this.peers.has(peerId)) {
        const isInitiator = this.myUserId > peerId;
        if (isInitiator) {
          void this.createPeerConnection(peerId, true);
        }
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

    // Se já estiver transmitindo tela, anexa a faixa ao novo peer
    if (this.localScreenStream) {
      for (const track of this.localScreenStream.getVideoTracks()) {
        if (track.readyState === "live") {
          try {
            const sender = pc.addTrack(track, this.localScreenStream);
            this.screenSenders.set(peerId, sender);
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

        // Detecção de fala remota em tempo real
        this.attachRemoteVad(peerId, stream);
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
      }
    };

    // Se formos o iniciador da conexão, cria a oferta SDP completa (áudio + vídeo)
    if (isInitiator) {
      void (async () => {
        try {
          const offer = await pc!.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc!.setLocalDescription(offer);

          if (this.currentChannelId) {
            const api = useEchoApi();
            if (typeof api?.sendVoiceSignal === "function") {
              await api.sendVoiceSignal(this.currentChannelId, peerId, {
                type: "offer",
                sdp: offer,
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
    const track = stream ? stream.getVideoTracks()[0] : null;

    for (const [peerId, pc] of this.peers.entries()) {
      try {
        const existingSender = this.screenSenders.get(peerId);
        if (track) {
          if (existingSender) {
            await existingSender.replaceTrack(track);
          } else {
            const sender = pc.addTrack(track, stream!);
            this.screenSenders.set(peerId, sender);
            await this.renegotiateWithPeer(peerId);
          }
        } else {
          if (existingSender) {
            pc.removeTrack(existingSender);
            this.screenSenders.delete(peerId);
            await this.renegotiateWithPeer(peerId);
          }
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
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      const api = useEchoApi();
      if (typeof api?.sendVoiceSignal === "function") {
        await api.sendVoiceSignal(this.currentChannelId, peerId, {
          type: "offer",
          sdp: offer,
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

      // Drena candidatos ICE enfileirados
      const queued = this.candidateQueues.get(fromUserId) || [];
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {}
      }
      this.candidateQueues.delete(fromUserId);
      // Libera memória se todas as filas foram processadas
      if (this.candidateQueues.size === 0) {
        this.candidateQueues.clear();
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const api = useEchoApi();
      if (typeof api?.sendVoiceSignal === "function") {
        await api.sendVoiceSignal(this.currentChannelId, fromUserId, {
          type: "answer",
          sdp: answer,
        });
        this.pulseSignalingFast();
      }
    } else if (signal.type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        const queued = this.candidateQueues.get(fromUserId) || [];
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        this.candidateQueues.delete(fromUserId);
        // Libera memória se todas as filas foram processadas
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
