import { STAFF_LANGUAGE } from './constants';

export function buildBidirectionalPrompt(guestLanguage: string, topic?: string, staffLang?: string): string {
  const staff = staffLang ?? STAFF_LANGUAGE;
  const topicLine = topic ? ` Topic: ${topic}.` : '';
  return `Translate between ${staff} and ${guestLanguage}. Pharmacy counter.${topicLine}

INPUT in ${staff} → OUTPUT translation in ${guestLanguage}.
INPUT in ${guestLanguage} → OUTPUT translation in ${staff}.

ONLY output the translated words. Zero other text.

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
  const staff = staffLang ?? STAFF_LANGUAGE;
  return `You are a language detection assistant for a pharmacy counter.

STEP 1 (once): Say exactly "Welcome! Please speak a sentence in your own language so I can identify it."

STEP 2: Listen to the customer's response. DETECT their language. Common languages: Tagalog, English, Dutch, French, German, Spanish, Arabic, Turkish, etc.

STEP 3: After detecting, reply with ONLY the language name (e.g., "Tagalog" or "English"). Nothing else.

STEP 4: Once you report the language, I will configure the translator for you. Just say the language name now.

FORBIDDEN: thinking, explaining, translating, "Translating…", asterisks, labels, commentary. Just say the language name.`;
}

export function buildInviteText(): string {
  return 'Welcome! Please speak in your own language and I will translate for you.';
}
