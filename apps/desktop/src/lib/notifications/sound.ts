/**
 * Sintetizador Web Audio API para alertas sonoros do Echo:
 * Gera tons melódicos suaves e modernos no cliente sem necessidade de arquivos externos,
 * garantindo compatibilidade total offline e latência zero.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca o som suave de nova mensagem (chime harmônico de 2 notas).
 */
export function playMessageChime(volume = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    // Nota 1: 587.33 Hz (D5) -> Nota 2: 880 Hz (A5)
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.setValueAtTime(880, now + 0.08);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(587.33, now);
    osc2.frequency.setValueAtTime(880, now + 0.08);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Toca o som caloroso de novo pedido de amizade (tríade ascendente: C5 -> E5 -> G5).
 */
export function playFriendRequestChime(volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, index) => {
      const noteTime = now + index * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.exponentialRampToValueAtTime(volume, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  } catch {
    // Falha silenciosa
  }
}

