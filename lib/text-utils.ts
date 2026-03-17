/**
 * Shared text utilities for transcription and translation filtering.
 */

/** Match exact noise markers or very short fragments. */
export function isNoiseMarker(text: string): boolean {
  const t = text.trim();
  return /^<noise>$/i.test(t) || /^\[noise\]$/i.test(t) || /^\(noise\)$/i.test(t) || t.length < 2;
}

/** Broader noise check: markers, very short, or punctuation-only. */
export function isNoise(text: string): boolean {
  const t = text.trim();
  if (isNoiseMarker(t)) return true;
  if (t.replace(/[.\s,!?;:'"()\-–—…]/g, '').length < 2) return true;
  return false;
}

/** Empty, whitespace-only, or ellipsis-only. */
export function isEmptyOrEllipsis(text: string): boolean {
  const t = text.trim();
  return !t || /^[.…\s]+$/i.test(t);
}

/** Regex for thinking-only phrases (no translation content). */
export const THINKING_ONLY_PATTERN = /^(Thinking|Let me think|I'm thinking|Hmm\.?|Hmm,|Hmm…)\s*$/i;

/** Regex for thinking/commentary prefix (start of string). */
export const THINKING_PREFIX_PATTERN = /^(Thinking|Let me think|I'm thinking|Hmm|Let me see|One moment|Just a moment|Processing)/i;

/** Remove Gemini thinking blocks from text. */
export function stripThinkingBlocks(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')
    .replace(/\(thinking\)[\s\S]*?\(\/thinking\)/gi, '')
    .trim();
}
