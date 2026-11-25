import { useEchoApi } from "@/lib/api/echoApi";
import { webrtcVoice, type WebRtcCallbacks } from "./webrtcVoice";
import { livekitVoice } from "./livekitVoice";

/**
 * Roteador Unificado de Transporte de Voz e Live (SFU LiveKit vs WebRTC Mesh).
 * Quando o servidor echo-api retorna um token LiveKit válido em /voice/token,
 * utiliza o LiveKit SFU automaticamente (upload 1x, Simulcast, TURN embutido).
 * Caso contrário, faz fallback transparente para WebRTC P2P Mesh.
 */
class VoiceTransportRouter {
  private mode: "livekit" | "webrtc" = "webrtc";

  public getMode(): "livekit" | "webrtc" {
    return this.mode;
  }

  public async join(
    guildId: string,
    channelId: string,
    userId: string,
    username: string,
    avatarUrl: string | null,
    isMuted: boolean,
    isDeafened: boolean,
    callbacks: WebRtcCallbacks,
  ): Promise<void> {
    let useLiveKit = false;
    let serverUrl: string | null = null;
    let token: string | null = null;

    try {
      const api = useEchoApi();
      if (typeof api?.getVoiceToken === "function") {
        const res = await api.getVoiceToken(channelId, { username, avatarUrl });
        if (res?.enabled && res.serverUrl && res.token) {
          useLiveKit = true;
          serverUrl = res.serverUrl;
          token = res.token;
        }
      }
    } catch {}

    if (useLiveKit && serverUrl && token) {
      this.mode = "livekit";
      await livekitVoice.join(
        guildId,
        channelId,
        userId,
        username,
        avatarUrl,
        isMuted,
        isDeafened,
        callbacks,
        { serverUrl, token },
      );
    } else {
      this.mode = "webrtc";
      await webrtcVoice.join(
        guildId,
        channelId,
        userId,
        username,
        avatarUrl,
        isMuted,
        isDeafened,
        callbacks,
      );
    }
  }

  public async leave(): Promise<void> {
    if (this.mode === "livekit") {
      await livekitVoice.leave();
    } else {
      await webrtcVoice.leave();
    }
    this.mode = "webrtc";
  }

  public setMicrophoneMuted(muted: boolean) {
    if (this.mode === "livekit") livekitVoice.setMicrophoneMuted(muted);
    else webrtcVoice.setMicrophoneMuted(muted);
  }

  public setDeafened(deafened: boolean) {
    if (this.mode === "livekit") livekitVoice.setDeafened(deafened);
    else webrtcVoice.setDeafened(deafened);
  }

  public setParticipantVolume(userId: string, volume: number) {
    if (this.mode === "livekit") livekitVoice.setParticipantVolume(userId, volume);
    else webrtcVoice.setParticipantVolume(userId, volume);
  }

  public setMasterOutputVolume(volume: number) {
    if (this.mode === "livekit") livekitVoice.setMasterOutputVolume(volume);
    else webrtcVoice.setMasterOutputVolume(volume);
  }

  public async setOutputDevice(deviceId: string | null): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.setOutputDevice(deviceId);
    else await webrtcVoice.setOutputDevice(deviceId);
  }

  public async switchMicrophone(deviceId: string | null): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.switchMicrophone(deviceId);
    else await webrtcVoice.switchMicrophone(deviceId);
  }

  public async updateAudioConstraints(overrides?: Partial<MediaTrackConstraints>): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.updateAudioConstraints(overrides);
    else await webrtcVoice.updateAudioConstraints(overrides);
  }

  public async setLocalScreenShare(
    stream: MediaStream | null,
    options?: {
      contentHint?: "auto" | "detail" | "motion" | "text";
      qualityPreset?: "auto" | "low" | "medium" | "high";
    },
  ): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.setLocalScreenShare(stream, options);
    else await webrtcVoice.setLocalScreenShare(stream, options);
  }

  public async setLocalCamera(stream: MediaStream | null): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.setLocalCamera(stream);
    else await webrtcVoice.setLocalCamera(stream);
  }

  public async sendSoundboardEffect(soundId: string): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.sendSoundboardEffect(soundId);
    else await webrtcVoice.sendSoundboardEffect(soundId);
  }

  public getRemoteScreenStream(peerId: string): MediaStream | null {
    return this.mode === "livekit"
      ? livekitVoice.getRemoteScreenStream(peerId)
      : webrtcVoice.getRemoteScreenStream(peerId);
  }

  public getRemoteCameraStream(peerId: string): MediaStream | null {
    return this.mode === "livekit"
      ? livekitVoice.getRemoteCameraStream(peerId)
      : webrtcVoice.getRemoteCameraStream(peerId);
  }

  public getRemoteVideoStream(peerId: string): MediaStream | null {
    return this.mode === "livekit"
      ? livekitVoice.getRemoteVideoStream(peerId)
      : webrtcVoice.getRemoteVideoStream(peerId);
  }

  public getLocalStream(): MediaStream | null {
    return webrtcVoice.getLocalStream();
  }

  public setPrewarmedStream(stream: MediaStream | null) {
    webrtcVoice.setPrewarmedStream(stream);
  }

  public setSpatialAudioEnabled(enabled: boolean) {
    webrtcVoice.setSpatialAudioEnabled(enabled);
  }

  public async tickHeartbeat(): Promise<void> {
    if (this.mode === "livekit") await livekitVoice.tickHeartbeat();
    else await webrtcVoice.tickHeartbeat();
  }
}

export const voiceTransport = new VoiceTransportRouter();
