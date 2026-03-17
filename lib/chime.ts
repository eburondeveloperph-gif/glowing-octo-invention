/**
 * Premium audio chimes for turn changes and language confirmation.
 */

function createChime(
  frequencies: number[],
  durations: number[],
  gain = 0.18,
  type: OscillatorType = 'sine',
): void {
  try {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);

    let t = ctx.currentTime;
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequencies[i], t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * (1 - i * 0.15), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t);
      osc.stop(t + durations[i]);
      t += durations[i] * 0.6;
    }

    masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // ignore
  }
}

/** Premium turn-change chime (staff/guest/AI switch) */
export function playTurnChime(): void {
  createChime([880, 1318, 1760], [0.35, 0.25, 0.2], 0.14, 'sine');
}

/** Premium language-confirmed chime (guest language locked) */
export function playLanguageConfirmedChime(): void {
  try {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1047, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(1319, ctx.currentTime + 0.15);
    osc1.connect(masterGain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1319, ctx.currentTime + 0.12);
    osc2.frequency.linearRampToValueAtTime(2093, ctx.currentTime + 0.3);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, ctx.currentTime);
    g2.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.connect(g2);
    g2.connect(masterGain);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.65);

    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    // ignore
  }
}
