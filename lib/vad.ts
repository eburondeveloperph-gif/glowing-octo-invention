/**
 * Simple Voice Activity Detection (VAD) using volume threshold.
 * Detects speech start/end for gating audio and signaling end-of-utterance.
 */

const DEFAULT_SPEECH_THRESHOLD = 0.018;
const DEFAULT_SILENCE_MS = 550;
const DEFAULT_PRE_SPEECH_MS = 80;
const DEFAULT_POST_SPEECH_MS = 200;

export type VADState = 'silent' | 'speaking' | 'ended';

export interface VADOptions {
  speechThreshold?: number;
  silenceMs?: number;
  preSpeechMs?: number;
  postSpeechMs?: number;
  onStateChange?: (state: VADState) => void;
}

export class SimpleVAD {
  private speechThreshold: number;
  private silenceMs: number;
  private postSpeechMs: number;
  private onStateChange?: (state: VADState) => void;

  private state: VADState = 'silent';
  private lastSpeechTime = 0;
  private silenceStartTime = 0;
  private wasSpeaking = false;

  constructor(options: VADOptions = {}) {
    this.speechThreshold = options.speechThreshold ?? DEFAULT_SPEECH_THRESHOLD;
    this.silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
    this.postSpeechMs = options.postSpeechMs ?? DEFAULT_POST_SPEECH_MS;
    this.onStateChange = options.onStateChange;
  }

  /** Process volume sample; returns true if we're in speech (including post-speech tail). */
  process(volume: number): boolean {
    const now = Date.now();
    const isAboveThreshold = volume >= this.speechThreshold;

    if (isAboveThreshold) {
      this.lastSpeechTime = now;
      this.silenceStartTime = 0;
      if (this.state !== 'speaking') {
        this.state = 'speaking';
        this.wasSpeaking = true;
        this.onStateChange?.('speaking');
      }
      return true;
    }

    if (this.state === 'speaking') {
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = now;
      }
      const silenceDuration = now - this.silenceStartTime;
      if (silenceDuration >= this.silenceMs) {
        this.state = 'ended';
        this.onStateChange?.('ended');
        return now - this.lastSpeechTime < this.postSpeechMs;
      }
      return true;
    }

    if (this.state === 'ended') {
      const timeSinceSpeech = now - this.lastSpeechTime;
      if (timeSinceSpeech < this.postSpeechMs) return true;
      this.state = 'silent';
      this.wasSpeaking = false;
      this.onStateChange?.('silent');
      return false;
    }

    return false;
  }

  /** Whether we should send audio (in speech or post-speech tail). */
  shouldSend(volume: number): boolean {
    return this.process(volume);
  }

  /** Whether speech has just ended (for signaling end-of-turn). */
  getState(): VADState {
    return this.state;
  }

  /** Reset VAD state. */
  reset(): void {
    this.state = 'silent';
    this.lastSpeechTime = 0;
    this.silenceStartTime = 0;
    this.wasSpeaking = false;
  }
}
