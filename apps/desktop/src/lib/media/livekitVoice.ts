import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEchoApi } from "@/lib/api/echoApi";
import type { WebRtcCallbacks } from "./webrtcVoice";

export interface LiveKitConnectOptions {
  serverUrl: string;
  token: string;
}

/**
 * Motor de Áudio, Webcam e Live via LiveKit SFU (Self-Hosted).
 * Mantém a mesma interface de callbacks do WebRtcVoiceManager para integração
 * transparente com voiceStore e VoiceStage.
 */
class LiveKitVoiceManager {
  private room: Room | null = null;
  private callbacks: WebRtcCallbacks = {};
  private currentGuildId: string | null = null;
  private currentChannelId: string | null = null;
  private myUserId: string = "";
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private isScreenSharing: boolean = false;
  private isCameraOn: boolean = false;
  private masterOutputVolume: number = 100;

  private audioContext: AudioContext | null = null;
  private peerVolumes: Map<string, number> = new Map();
  private screenVolumes: Map<string, number> = new Map();
  private peerAudioNodes: Map<string, { gain: GainNode; source: MediaStreamAudioSourceNode; stream: MediaStream }> =
    new Map();
  private screenAudioNodes: Map<string, { gain: GainNode; source: MediaStreamAudioSourceNode; stream: MediaStream }> =
    new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private remoteScreenStreams: Map<string, MediaStream> = new Map();
  private remoteCameraStreams: Map<string, MediaStream> = new Map();
  private publishedScreenTracks: MediaStreamTrack[] = [];
  private publishedCameraTracks: MediaStreamTrack[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  public async join(
    guildId: string,
    channelId: string,
    userId: string,
    username: string,
    avatarUrl: string | null,
    isMuted: boolean,
    isDeafened: boolean,
    callbacks: WebRtcCallbacks,
    lkConfig: LiveKitConnectOptions,
  ): Promise<void> {
    await this.leave();

    this.currentGuildId = guildId;
    this.currentChannelId = channelId;
    this.myUserId = userId;
    this.isMuted = isMuted;
    this.isDeafened = isDeafened;
    this.callbacks = callbacks;

    const settings = useSettingsStore.getState();
    this.masterOutputVolume = settings.outputVolume ?? 100;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        deviceId:
          settings.microphoneDevice && settings.microphoneDevice !== "default"
            ? { ideal: settings.microphoneDevice }
            : undefined,
        echoCancellation: settings.echoCancellation ?? true,
        noiseSuppression: settings.noiseSuppression ?? true,
        autoGainControl: settings.autoGainControl ?? true,
      },
      videoCaptureDefaults: {
        deviceId:
          settings.cameraDevice && settings.cameraDevice !== "default"
            ? { ideal: settings.cameraDevice }
            : undefined,
      },
    });

    this.room = room;
    this.bindRoomEvents(room);

    this.callbacks.onConnectionStateChange?.("connecting");

    try {
      await room.connect(lkConfig.serverUrl, lkConfig.token);
      this.callbacks.onConnectionStateChange?.("connected");

      // Publica microfone inicial respeitando estado de mudo
      await room.localParticipant.setMicrophoneEnabled(!isMuted, {
        deviceId:
          settings.microphoneDevice && settings.microphoneDevice !== "default"
            ? { ideal: settings.microphoneDevice }
            : undefined,
        echoCancellation: settings.echoCancellation ?? true,
        noiseSuppression: settings.noiseSuppression ?? true,
        autoGainControl: settings.autoGainControl ?? true,
      });

      if (settings.headphonesDevice && settings.headphonesDevice !== "default") {
        await this.setOutputDevice(settings.headphonesDevice);
      }

      this.syncParticipantsFromRoom();

      // Mantém presença sincronizada no echo-api para a barra lateral da guilda
      const api = useEchoApi();
      if (typeof api?.joinVoiceChannel === "function") {
        void api
          .joinVoiceChannel(channelId, {
            guildId,
            username,
            avatarUrl,
            isMuted,
            isDeafened,
            isScreenSharing: false,
            hasCamera: false,
          })
          .catch(() => {});
      }

      this.heartbeatInterval = setInterval(() => {
        void this.tickHeartbeat(username, avatarUrl);
      }, 3000);
    } catch (err) {
      this.callbacks.onConnectionStateChange?.("disconnected");
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private bindRoomEvents(room: Room) {
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.syncParticipantsFromRoom();
      this.callbacks.onPeerConnected?.(participant.identity);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      const pid = participant.identity;
      this.cleanupRemoteAudio(pid);
      this.remoteScreenStreams.delete(pid);
      this.remoteCameraStreams.delete(pid);
      this.callbacks.onRemoteVideoStream?.(pid, null, "screen");
      this.callbacks.onRemoteVideoStream?.(pid, null, "camera");
      this.callbacks.onPeerDisconnected?.(pid);
      this.syncParticipantsFromRoom();
    });

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        const pid = participant.identity;
        const stream = new MediaStream([track.mediaStreamTrack]);

        if (track.kind === Track.Kind.Audio) {
          const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
          this.attachRemoteAudio(pid, stream, isScreenAudio);
        } else if (track.kind === Track.Kind.Video) {
          const kind: "screen" | "camera" =
            pub.source === Track.Source.ScreenShare ? "screen" : "camera";
          if (kind === "screen") {
            this.remoteScreenStreams.set(pid, stream);
          } else {
            this.remoteCameraStreams.set(pid, stream);
          }
          this.callbacks.onRemoteVideoStream?.(pid, stream, kind);
          this.syncParticipantsFromRoom();
        }
      },
    );

    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        const pid = participant.identity;
        if (track.kind === Track.Kind.Audio) {
          const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
          this.cleanupRemoteAudio(pid, isScreenAudio);
        } else if (track.kind === Track.Kind.Video) {
          const kind: "screen" | "camera" =
            pub.source === Track.Source.ScreenShare ? "screen" : "camera";
          if (kind === "screen") {
            this.remoteScreenStreams.delete(pid);
          } else {
            this.remoteCameraStreams.delete(pid);
          }
          this.callbacks.onRemoteVideoStream?.(pid, null, kind);
          this.syncParticipantsFromRoom();
        }
      },
    );

    room.on(RoomEvent.TrackMuted, () => this.syncParticipantsFromRoom());
    room.on(RoomEvent.TrackUnmuted, () => this.syncParticipantsFromRoom());

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakingIds = new Set(speakers.map((s) => s.identity));
      const localSpeaking = !this.isMuted && !this.isDeafened && speakingIds.has(this.myUserId);
      this.callbacks.onSpeakingChange?.(localSpeaking);

      for (const p of room.remoteParticipants.values()) {
        this.callbacks.onParticipantSpeaking?.(p.identity, speakingIds.has(p.identity));
      }
    });

    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const decoded = JSON.parse(new TextDecoder().decode(payload));
        if (decoded?.type === "soundboard" && typeof decoded.soundId === "string" && !this.isDeafened) {
          const fromUserId = participant?.identity || "";
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("echo:soundboard-play", {
                detail: { fromUserId, soundId: decoded.soundId },
              }),
            );
          }
          this.callbacks.onSoundboardEffect?.(fromUserId, decoded.soundId);
        }
      } catch {}
    });

    room.on(RoomEvent.Disconnected, () => {
      this.callbacks.onConnectionStateChange?.("disconnected");
    });
  }

  private syncParticipantsFromRoom() {
    if (!this.room) return;
    const list: any[] = [];

    const mapParticipant = (p: any, isLocal: boolean) => {
      let avatarUrl: string | null = null;
      try {
        if (p.metadata) {
          avatarUrl = JSON.parse(p.metadata)?.avatarUrl ?? null;
        }
      } catch {}

      const hasScreen = Array.from(p.trackPublications?.values?.() ?? []).some(
        (pub: any) => pub.source === Track.Source.ScreenShare && !pub.isMuted,
      );
      const hasCam = Array.from(p.trackPublications?.values?.() ?? []).some(
        (pub: any) => pub.source === Track.Source.Camera && !pub.isMuted,
      );

      return {
        userId: p.identity,
        username: p.name || p.identity.replace(/^@/, "").split(":")[0],
        avatarUrl,
        isMuted: isLocal ? this.isMuted : !p.isMicrophoneEnabled,
        isDeafened: isLocal ? this.isDeafened : false,
        isSpeaking: Boolean(p.isSpeaking),
        isScreenSharing: isLocal ? this.isScreenSharing : hasScreen,
        hasCamera: isLocal ? this.isCameraOn : hasCam,
      };
    };

    list.push(mapParticipant(this.room.localParticipant, true));
    for (const remote of this.room.remoteParticipants.values()) {
      list.push(mapParticipant(remote, false));
    }
    this.callbacks.onParticipantsUpdate?.(list);
  }

  private getEffectiveGain(peerId: string, isScreenAudio = false): number {
    if (this.isDeafened) return 0;
    const settings = useSettingsStore.getState();
    const userVol = isScreenAudio
      ? (this.screenVolumes.get(peerId) ?? settings.screenShareVolumes[peerId] ?? 100)
      : (this.peerVolumes.get(peerId) ?? settings.participantVolumes[peerId] ?? 100);
    return Math.max(0, (userVol / 100) * (this.masterOutputVolume / 100));
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream, isScreenAudio: boolean) {
    this.cleanupRemoteAudio(peerId, isScreenAudio);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === "closed") {
        this.audioContext = new AudioCtx();
        const devId = useSettingsStore.getState().headphonesDevice;
        if (devId && devId !== "default" && typeof (this.audioContext as any).setSinkId === "function") {
          void (this.audioContext as any).setSinkId(devId).catch(() => {});
        }
      }
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const gain = this.audioContext.createGain();
      gain.gain.value = this.getEffectiveGain(peerId);
      gain.connect(this.audioContext.destination);

      const targetMap = isScreenAudio ? this.screenAudioNodes : this.peerAudioNodes;
      targetMap.set(peerId, { gain, source, stream });
    } catch {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.srcObject = stream;
      audio.muted = this.isDeafened;
      audio.volume = Math.max(0, Math.min(1, this.getEffectiveGain(peerId)));
      this.audioElements.set(`${peerId}:${isScreenAudio ? "screen" : "mic"}`, audio);
      void audio.play().catch(() => {});
    }
  }

  private cleanupRemoteAudio(peerId: string, onlyScreen = false) {
    if (!onlyScreen) {
      const micNode = this.peerAudioNodes.get(peerId);
      if (micNode) {
        try {
          micNode.gain.disconnect();
          micNode.source.disconnect();
        } catch {}
        this.peerAudioNodes.delete(peerId);
      }
      const el = this.audioElements.get(`${peerId}:mic`);
      if (el) {
        try { el.pause(); el.srcObject = null; } catch {}
        this.audioElements.delete(`${peerId}:mic`);
      }
    }
    const scrNode = this.screenAudioNodes.get(peerId);
    if (scrNode) {
      try {
        scrNode.gain.disconnect();
        scrNode.source.disconnect();
      } catch {}
      this.screenAudioNodes.delete(peerId);
    }
    const scrEl = this.audioElements.get(`${peerId}:screen`);
    if (scrEl) {
      try { scrEl.pause(); scrEl.srcObject = null; } catch {}
      this.audioElements.delete(`${peerId}:screen`);
    }
  }

  public setMicrophoneMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.room) {
      void this.room.localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
    }
    if (muted) {
      this.callbacks.onSpeakingChange?.(false);
    }
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    for (const [pid, node] of this.peerAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(pid, false);
    }
    for (const [pid, node] of this.screenAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(pid, true);
    }
    for (const el of this.audioElements.values()) {
      el.muted = deafened;
    }
    if (deafened) {
      this.setMicrophoneMuted(true);
    }
  }

  public setParticipantVolume(userId: string, volume: number) {
    this.peerVolumes.set(userId, volume);
    const eff = this.getEffectiveGain(userId, false);
    const micNode = this.peerAudioNodes.get(userId);
    if (micNode) micNode.gain.gain.value = eff;
  }

  public setScreenShareVolume(userId: string, volume: number) {
    this.screenVolumes.set(userId, volume);
    const eff = this.getEffectiveGain(userId, true);
    const scrNode = this.screenAudioNodes.get(userId);
    if (scrNode) scrNode.gain.gain.value = eff;
  }

  public setMasterOutputVolume(volume: number) {
    this.masterOutputVolume = volume;
    for (const [pid, node] of this.peerAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(pid, false);
    }
    for (const [pid, node] of this.screenAudioNodes.entries()) {
      node.gain.gain.value = this.getEffectiveGain(pid, true);
    }
  }

  public async setOutputDevice(deviceId: string | null): Promise<void> {
    if (this.room) {
      try {
        await this.room.switchActiveDevice("audiooutput", deviceId || "default");
      } catch {}
    }
    if (this.audioContext && typeof (this.audioContext as any).setSinkId === "function") {
      try {
        await (this.audioContext as any).setSinkId(deviceId && deviceId !== "default" ? deviceId : "");
      } catch {}
    }
  }

  public async switchMicrophone(deviceId: string | null): Promise<void> {
    if (this.room) {
      try {
        await this.room.switchActiveDevice("audioinput", deviceId || "default");
      } catch {}
    }
  }

  public async updateAudioConstraints(overrides?: Partial<MediaTrackConstraints>): Promise<void> {
    if (!this.room) return;
    const s = useSettingsStore.getState();
    try {
      await this.room.localParticipant.setMicrophoneEnabled(!this.isMuted, {
        deviceId: s.microphoneDevice ? { exact: s.microphoneDevice } : undefined,
        echoCancellation:
          typeof overrides?.echoCancellation === "boolean"
            ? overrides.echoCancellation
            : s.echoCancellation,
        noiseSuppression:
          typeof overrides?.noiseSuppression === "boolean"
            ? overrides.noiseSuppression
            : s.noiseSuppression,
        autoGainControl:
          typeof overrides?.autoGainControl === "boolean"
            ? overrides.autoGainControl
            : s.autoGainControl,
      });
    } catch {}
  }

  public async setLocalScreenShare(
    stream: MediaStream | null,
    options?: {
      contentHint?: "auto" | "detail" | "motion" | "text";
      qualityPreset?: "auto" | "low" | "medium" | "high";
    },
  ): Promise<void> {
    if (!this.room) return;

    // Despublica faixas antigas de screen share
    for (const oldTrack of this.publishedScreenTracks) {
      try {
        await this.room.localParticipant.unpublishTrack(oldTrack, false);
      } catch {}
    }
    this.publishedScreenTracks = [];

    if (!stream) {
      this.isScreenSharing = false;
      return;
    }

    this.isScreenSharing = true;
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    const bitrates: Record<string, number> = {
      low: 1_500_000,
      medium: 3_000_000,
      high: 4_500_000,
      auto: 4_500_000,
    };
    const maxBitrate = bitrates[options?.qualityPreset ?? "auto"] ?? 4_500_000;

    if (videoTrack) {
      if ("contentHint" in videoTrack) {
        videoTrack.contentHint = options?.contentHint && options.contentHint !== "auto" ? options.contentHint : "detail";
      }
      await this.room.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.ScreenShare,
        simulcast: true,
        videoEncoding: { maxBitrate, maxFramerate: 60 },
      });
      this.publishedScreenTracks.push(videoTrack);
    }

    if (audioTrack) {
      await this.room.localParticipant.publishTrack(audioTrack, {
        source: Track.Source.ScreenShareAudio,
      });
      this.publishedScreenTracks.push(audioTrack);
    }
  }

  public async setLocalCamera(stream: MediaStream | null): Promise<void> {
    if (!this.room) return;

    for (const oldTrack of this.publishedCameraTracks) {
      try {
        await this.room.localParticipant.unpublishTrack(oldTrack, false);
      } catch {}
    }
    this.publishedCameraTracks = [];

    if (!stream) {
      this.isCameraOn = false;
      return;
    }

    this.isCameraOn = true;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      await this.room.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.Camera,
        simulcast: true,
      });
      this.publishedCameraTracks.push(videoTrack);
    }
  }

  public async sendSoundboardEffect(soundId: string): Promise<void> {
    if (!this.room) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "soundboard", soundId }));
      await this.room.localParticipant.publishData(payload, { reliable: true });
    } catch {}
  }

  public getRemoteScreenStream(peerId: string): MediaStream | null {
    return this.remoteScreenStreams.get(peerId) ?? null;
  }

  public getRemoteCameraStream(peerId: string): MediaStream | null {
    return this.remoteCameraStreams.get(peerId) ?? null;
  }

  public getRemoteVideoStream(peerId: string): MediaStream | null {
    return this.remoteScreenStreams.get(peerId) ?? this.remoteCameraStreams.get(peerId) ?? null;
  }

  public isConnected(): boolean {
    return Boolean(this.room);
  }

  public async tickHeartbeat(username?: string, avatarUrl?: string | null): Promise<void> {
    if (!this.currentChannelId || !this.currentGuildId) return;
    try {
      const api = useEchoApi();
      if (typeof api?.voiceHeartbeat === "function") {
        await api.voiceHeartbeat(this.currentChannelId, {
          guildId: this.currentGuildId,
          username: username || this.myUserId,
          avatarUrl: avatarUrl ?? null,
          isSpeaking: false,
          isMuted: this.isMuted,
          isDeafened: this.isDeafened,
          isScreenSharing: this.isScreenSharing,
          hasCamera: this.isCameraOn,
        });
      }
    } catch {}
  }

  public async leave(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const chId = this.currentChannelId;
    if (chId) {
      try {
        const api = useEchoApi();
        if (typeof api?.leaveVoiceChannel === "function") {
          void api.leaveVoiceChannel(chId).catch(() => {});
        }
      } catch {}
    }

    for (const pid of Array.from(this.peerAudioNodes.keys())) {
      this.cleanupRemoteAudio(pid);
    }
    this.remoteScreenStreams.clear();
    this.remoteCameraStreams.clear();
    this.publishedScreenTracks = [];
    this.publishedCameraTracks = [];

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {}
      this.room = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.isScreenSharing = false;
    this.isCameraOn = false;
    this.currentGuildId = null;
    this.currentChannelId = null;
  }
}

export const livekitVoice = new LiveKitVoiceManager();
