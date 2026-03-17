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

/** Premium turn-change chime (staff/guest/AI switch) - subtle to avoid overlapping with translation audio */
export function playTurnChime(): void {
  createChime([880, 1318, 1760], [0.25, 0.18, 0.15], 0.09, 'sine');
}

/** Announce guest language aloud via speech synthesis */
export function announceGuestLanguage(languageName: string): void {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Guest language set to ${languageName}`);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
}

/** Play select-language.mp3 when Start is tapped (fallback to play.mp3 if missing) */
export function playSelectLanguageAudio(): void {
  try {
    const audio = new Audio('/select-language.mp3');
    audio.onerror = () => {
      const fallback = new Audio('/play.mp3');
      fallback.play().catch(() => {});
    };
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

/** Success chime when guest confirms language (two-note) */
export function playLanguageSelectedChime(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // ignore
  }
}

/** Subtle chime when microphone is activated */
export function playMicOnChime(): void {
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    // ignore
  }
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
