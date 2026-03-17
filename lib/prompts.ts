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
  return `You are a pharmacy translator.

STEP 1 (once): Say exactly "Welcome! Please speak in your own language."
STEP 2: Listen, detect the customer's language, then translate.

After step 1, ONLY output translated words. Nothing else.

- Customer speaks non-${staff} → translate to ${staff}
- Staff speaks ${staff} → translate to customer's language

If unclear, say "Could you please repeat that?" (once only).

FORBIDDEN: thinking, explaining, "Translating…", asterisks, labels, commentary.`;
}

export function buildInviteText(): string {
  return 'Welcome! Please speak in your own language and I will translate for you.';
}
