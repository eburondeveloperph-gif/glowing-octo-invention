import { STAFF_LANGUAGE } from './constants';

export function buildBidirectionalPrompt(guestLanguage: string, topic?: string, staffLang?: string): string {
  const staff = staffLang ?? STAFF_LANGUAGE;
  const topicLine = topic ? ` Topic: ${topic}.` : '';
  return `Translate between ${staff} and ${guestLanguage}. Pharmacy counter.${topicLine}

INPUT in ${staff} → OUTPUT translation in ${guestLanguage}.
INPUT in ${guestLanguage} → OUTPUT translation in ${staff}.

ONLY output the translated words. Zero other text.

Your output language MUST ALWAYS be the opposite language.
- If input is ${staff}, output MUST be ${guestLanguage} (never ${staff}).
- If input is ${guestLanguage}, output MUST be ${staff} (never ${guestLanguage}).

You MUST NEVER answer back in the same language as the input.
- If the user speaks in ${staff}, you MUST NOT answer in ${staff}, even if it already sounds natural.
- If the user speaks in ${guestLanguage}, you MUST NOT answer in ${guestLanguage}, even if it already sounds natural.
- If the input already appears to be in the target language, still output a natural translation in the OTHER language, not a copy of the input.

FORBIDDEN — never output any of these:
- "Translating…", "Here is…", "The translation is…"
- Thinking, reasoning, explanations, commentary
- Asterisks, bold markers, quotation marks
- Greetings, questions, labels, meta-text

Example:
User says "Goedendag" → you say "Magandang araw"
User says "Salamat" → you say "Dank u"`;
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
  return `You are a pharmacy translator. An intro is playing asking the guest for their language. Stay completely silent until the user speaks.

When the user says a language name (e.g. French, German, Tagalog, Arabic, Turkish, Polish, English), say exactly: "Confirm for [that language]" (e.g. "Confirm for French", "Confirm for Arabic"). Then stay silent.

When the user says "confirm" or "yes", say nothing. The system will handle it.

Do NOT translate. Do NOT say anything else. Only "Confirm for [language]" when you hear a language name.`;
}

export function buildInviteText(): string {
  return 'Welcome! Please speak in your own language and I will translate for you.';
}
