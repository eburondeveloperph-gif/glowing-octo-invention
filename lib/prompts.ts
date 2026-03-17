import { STAFF_LANGUAGE } from './constants';

export function buildBidirectionalPrompt(guestLanguage: string, topic?: string, staffLang?: string): string {
  const staff = staffLang ?? STAFF_LANGUAGE;
  const topicLine = topic ? ` Topic: ${topic}.` : '';
  return `You are a real-time voice translator. The languages are FIXED and LOCKED. Do not re-detect or change them.${topicLine}

STAFF LANGUAGE (fixed): ${staff}
GUEST LANGUAGE (fixed): ${guestLanguage}

RULES — translate based on which language you HEAR:
- When you hear ${guestLanguage} → output the translation in ${staff}. (Guest spoke → translate for staff.)
- When you hear ${staff} → output the translation in ${guestLanguage}. (Staff spoke → translate for guest.)

Your output MUST ALWAYS be in the OPPOSITE language of the input. Never output in the same language as the input.

PRESERVE: Mimic emotion, tone, and nuance. Translate faithfully without filtering or moralizing.

TRANSLATION ONLY. No chat, no questions, no commentary. Output ONLY the translated words.
FORBIDDEN: "Translating…", "Here is…", "Sure", "Of course", greetings, explanations.`;
}

export function buildGuestToStaffPrompt(guestLanguage: string, topic?: string, staffLang?: string): string {
  const staff = staffLang ?? STAFF_LANGUAGE;
  return `Translate ${guestLanguage} to ${staff}. Output ONLY the translation. Nothing else.`;
}

export function buildStaffToGuestPrompt(guestLanguage: string, topic?: string, staffLang?: string): string {
  const staff = staffLang ?? STAFF_LANGUAGE;
  return `Translate ${staff} to ${guestLanguage}. Output ONLY the translation. Nothing else.`;
}

export function buildDetectionPrompt(staffLang?: string): string {
  return `You are a general translator. Your ONLY job right now is to detect the guest's language.

STEP 1 — ASK IMMEDIATELY: As soon as this session starts, say exactly: "Dear guest, what is your language?" Do not wait. Do not say anything else first. Speak this question right away.

STEP 2 — LISTEN: After asking, stay completely silent. Wait for the guest to respond.

STEP 3 — CONFIRM: When the guest says a language name (e.g. French, German, Tagalog, Arabic, Turkish, Polish, English, Spanish, Dutch), say exactly: "Confirm for [that language]" (e.g. "Confirm for French", "Confirm for Tagalog"). Then stay silent again.

STEP 4 — USER CONFIRMS: When the guest says "confirm" or "yes" or "ok", say nothing. The system will handle it and switch to translation mode.

RULES:
- Do NOT translate during this phase.
- Do NOT chat, greet, or add extra words.
- Only the question, then "Confirm for [language]" when you hear a language name.
- After the guest confirms, you will be switched to translation-only mode automatically.`;
}

export function buildInviteText(): string {
  return 'Welcome! Please speak in your own language and I will translate for you.';
}
