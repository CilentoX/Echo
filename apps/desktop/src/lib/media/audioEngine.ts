/**
 * Motor de Áudio Web & Hardware do Echo (audioEngine)
 *
 * Gerencia medição de nível de entrada (VU Meter) em tempo real,
 * teste de loopback do microfone, reprodução de áudio de teste (chime Echo)
 * e integração com setSinkId para seleção de dispositivos de saída.
 */

export interface AudioMeterOptions {
  deviceId?: string | null;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private meterStream: MediaStream | null = null;
  private meterSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meterAnimFrame: number | null = null;

  private micTestAudio: HTMLAudioElement | null = null;
  private isTestingMic: boolean = false;

  /**
   * Inicia o monitor de nível de entrada (VU Meter) com requestAnimationFrame.
   * Chama `onLevel(volume: number)` onde volume varia de 0 a 100%.
   */
  async startMeter(
    onLevel: (volume: number) => void,
    options: AudioMeterOptions = {},
  ): Promise<void> {
    this.stopMeter();

    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
          echoCancellation: options.echoCancellation ?? true,
          noiseSuppression: options.noiseSuppression ?? true,
          autoGainControl: options.autoGainControl ?? true,
        },
        video: false,
      };

      const stream = await md.getUserMedia(constraints);
      this.meterStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.meterSource = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      this.meterSource.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        // Média das frequências de fala humana
        let sum = 0;
        let count = 0;
        const maxBin = Math.min(dataArray.length, 64);
        for (let i = 0; i < maxBin; i++) {
          sum += dataArray[i];
          count++;
        }
        const average = count > 0 ? sum / count : 0;
        // Normaliza de 0..255 para 0..100 com escala confortável
        const normalized = Math.min(100, Math.round((average / 170) * 100));

        onLevel(normalized);

        this.meterAnimFrame = requestAnimationFrame(checkVolume);
      };

      this.meterAnimFrame = requestAnimationFrame(checkVolume);
    } catch (err) {
      this.stopMeter();
      throw err;
    }
  }

  /** Interrompe o medidor e libera os tracks do microfone */
  stopMeter(): void {
    if (this.meterAnimFrame) {
      cancelAnimationFrame(this.meterAnimFrame);
      this.meterAnimFrame = null;
    }
    if (this.meterStream) {
      this.meterStream.getTracks().forEach((t) => t.stop());
      this.meterStream = null;
    }
    if (this.meterSource) {
      try {
        this.meterSource.disconnect();
      } catch {}
      this.meterSource = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /**
   * Inicia o teste de microfone (loopback local): o áudio captado é reproduzido
   * no dispositivo de saída selecionado para o usuário escutar a própria voz.
   */
  async startMicTest(inputDeviceId?: string | null, outputDeviceId?: string | null): Promise<void> {
    this.stopMicTest();
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) return;

    const stream = await md.getUserMedia({
      audio: {
        deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });

    const audio = new Audio();
    audio.srcObject = stream;
    if (outputDeviceId && typeof (audio as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
      try {
        await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(outputDeviceId);
      } catch {}
    }
    await audio.play();
    this.micTestAudio = audio;
    this.isTestingMic = true;
  }

  /** Para o teste de microfone */
  stopMicTest(): void {
    if (this.micTestAudio) {
      this.micTestAudio.pause();
      const stream = this.micTestAudio.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      this.micTestAudio.srcObject = null;
      this.micTestAudio = null;
    }
    this.isTestingMic = false;
  }

  getIsTestingMic(): boolean {
    return this.isTestingMic;
  }

  /**
   * Toca o chime sonoro de teste do Echo no dispositivo de saída selecionado.
   * Cria um acorde ascendente harmonioso cyberpunk/synth (C5 -> E5 -> G5 -> C6).
   */
  async playTestChime(outputDeviceId?: string | null, volume: number = 100): Promise<void> {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (outputDeviceId && typeof (ctx as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
      try {
        await (ctx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(outputDeviceId);
      } catch {}
    }

    const masterGain = ctx.createGain();
    const vol = Math.max(0, Math.min(1, volume / 100));
    masterGain.gain.setValueAtTime(vol * 0.35, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Arpeggio: 4 notas elegantes do Echo
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.22 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.22 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.24 }, // G5
      { freq: 1046.50, time: 0.24, dur: 0.40 }, // C6
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      const start = ctx.currentTime + note.time;
      noteGain.gain.setValueAtTime(0.001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.8, start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(start);
      osc.stop(start + note.dur + 0.05);
    }

    // Fecha o contexto após o chime terminar
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 900);
  }

  /**
   * Toca o som agradável e sutil de conexão de voz estabelecida (chime ascendente).
   * Notifica audivelmente que o usuário já pode falar e ouvir os participantes.
   */
  async playVoiceConnected(volume: number = 75): Promise<void> {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();

      const masterGain = ctx.createGain();
      const vol = Math.max(0, Math.min(1, volume / 100));
      masterGain.gain.setValueAtTime(vol * 0.28, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const notes = [
        { freq: 440.00, time: 0.00, dur: 0.12 }, // A4
        { freq: 659.25, time: 0.07, dur: 0.25 }, // E5
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

        const start = ctx.currentTime + note.time;
        noteGain.gain.setValueAtTime(0.001, start);
        noteGain.gain.exponentialRampToValueAtTime(0.7, start + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(start);
        osc.stop(start + note.dur + 0.03);
      }

      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 500);
    } catch {}
  }

  /**
   * Toca o som sutil de desconexão de voz (chime descendente).
   */
  async playVoiceDisconnected(volume: number = 75): Promise<void> {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();

      const masterGain = ctx.createGain();
      const vol = Math.max(0, Math.min(1, volume / 100));
      masterGain.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const notes = [
        { freq: 587.33, time: 0.00, dur: 0.10 }, // D5
        { freq: 392.00, time: 0.06, dur: 0.22 }, // G4
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

        const start = ctx.currentTime + note.time;
        noteGain.gain.setValueAtTime(0.001, start);
        noteGain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(start);
        osc.stop(start + note.dur + 0.03);
      }

      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 500);
    } catch {}
  }
}

export const audioEngine = new AudioEngine();

