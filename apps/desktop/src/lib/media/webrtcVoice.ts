import { useEchoApi } from "@/lib/api/echoApi";

export interface WebRtcCallbacks {
  onParticipantsUpdate?: (participants: any[]) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onParticipantSpeaking?: (userId: string, isSpeaking: boolean) => void;
  onError?: (err: Error) => void;
}

class WebRtcVoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: any = null;
  private heartbeatInterval: any = null;

  private currentGuildId: string | null = null;
  private currentChannelId: string | null = null;
  private myUserId: string = "";
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private isSpeaking: boolean = false;

  private peers: Map<string, RTCPeerConnection> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAnalysers: Map<string, { analyser: AnalyserNode; interval: any }> = new Map();
  private callbacks: WebRtcCallbacks = {};

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.services.mozilla.com" },
    ],
  };

  public getCurrentGuildId() {
    return this.currentGuildId;
  }

  public getCurrentChannelId() {
    return this.currentChannelId;
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
    } else {
      await this.leave();
    }

    this.currentGuildId = guildId;
    this.currentChannelId = channelId;
    this.myUserId = myUserId;
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
          void api.leaveVoiceChannel(this.currentChannelId).catch(() => {});
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
  }

  public async leave() {
    this.stopVad();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Notifica backend de forma não-bloqueante para troca instantânea de canais
    if (this.currentChannelId) {
      try {
        const api = useEchoApi();
        if (typeof api?.leaveVoiceChannel === "function") {
          void api.leaveVoiceChannel(this.currentChannelId).catch(() => {});
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

  private startHeartbeatAndSignalingLoop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    const tick = async () => {
      if (!this.currentChannelId) return;
      const api = useEchoApi();
      if (typeof api?.voiceHeartbeat !== "function") return;

      try {
        // 1. Heartbeat
        const hbRes = await api.voiceHeartbeat(this.currentChannelId, {
          isSpeaking: this.isSpeaking,
          isMuted: this.isMuted,
          isDeafened: this.isDeafened,
        });

        if (hbRes.participants) {
          this.callbacks.onParticipantsUpdate?.(hbRes.participants);
          this.syncPeers(hbRes.participants);
        }

        // 2. Poll de sinais WebRTC recebidos
        if (typeof api?.getVoiceSignals === "function") {
          const sigRes = await api.getVoiceSignals(this.currentChannelId);
          if (sigRes.signals && sigRes.signals.length > 0) {
            for (const item of sigRes.signals) {
              await this.handleIncomingSignal(item.fromUserId, item.signal);
            }
          }
        }
      } catch (err) {
        // Falha transitória
      }
    };

    // Primeiro tick imediato
    void tick();
    // A cada 2.5s
    this.heartbeatInterval = setInterval(tick, 2500);
  }

  private syncPeers(participants: Array<{ userId: string }>) {
    const activePeerIds = new Set(
      participants
        .map((p) => p.userId)
        .filter((id) => id && id !== this.myUserId && id !== "me"),
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

    // Adiciona faixa de áudio local
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
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

    // Recepção da faixa de áudio remota
    pc.ontrack = (event) => {
      let stream = event.streams?.[0];
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      if (!stream) return;

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
    };

    // Se formos o iniciador da conexão, cria a oferta SDP
    if (isInitiator) {
      void (async () => {
        try {
          const offer = await pc!.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
          });
          await pc!.setLocalDescription(offer);

          if (this.currentChannelId) {
            const api = useEchoApi();
            if (typeof api?.sendVoiceSignal === "function") {
              await api.sendVoiceSignal(this.currentChannelId, peerId, {
                type: "offer",
                sdp: offer,
              });
            }
          }
        } catch (err) {
          console.warn("[WebRtcVoice] Erro ao criar oferta:", err);
        }
      })();
    }

    return pc;
  }

  private async handleIncomingSignal(fromUserId: string, signal: any) {
    if (!signal || !this.currentChannelId) return;

    if (signal.type === "offer") {
      let pc = this.peers.get(fromUserId);
      if (!pc) {
        pc = this.createPeerConnection(fromUserId, false);
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

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const api = useEchoApi();
      if (typeof api?.sendVoiceSignal === "function") {
        await api.sendVoiceSignal(this.currentChannelId, fromUserId, {
          type: "answer",
          sdp: answer,
        });
      }
    } else if (signal.type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        const queued = this.candidateQueues.get(fromUserId) || [];
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        this.candidateQueues.delete(fromUserId);
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
