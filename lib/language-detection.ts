import { AVAILABLE_LANGUAGES, STAFF_LANGUAGE } from './constants';

export interface DetectionResult {
  language: string;
  confidence: number;
  normalizedLocale: string;
}

const SCRIPT_RANGES: Array<{ range: [number, number]; language: string }> = [
  { range: [0x0600, 0x06FF], language: 'Arabic' },
  { range: [0x0400, 0x04FF], language: 'Russian' },
  { range: [0x4E00, 0x9FFF], language: 'Chinese (Simplified)' },
  { range: [0x3040, 0x309F], language: 'Japanese' },
  { range: [0x30A0, 0x30FF], language: 'Japanese' },
  { range: [0xAC00, 0xD7AF], language: 'Korean' },
  { range: [0x0E00, 0x0E7F], language: 'Thai' },
  { range: [0x0900, 0x097F], language: 'Hindi' },
  { range: [0x0980, 0x09FF], language: 'Bengali' },
  { range: [0x0A80, 0x0AFF], language: 'Gujarati' },
  { range: [0x0B80, 0x0BFF], language: 'Tamil' },
  { range: [0x0C00, 0x0C7F], language: 'Telugu' },
  { range: [0x0C80, 0x0CFF], language: 'Kannada' },
  { range: [0x0D00, 0x0D7F], language: 'Malayalam' },
  { range: [0x10A0, 0x10FF], language: 'Georgian' },
  { range: [0x0530, 0x058F], language: 'Armenian' },
  { range: [0x0590, 0x05FF], language: 'Hebrew' },
  { range: [0x1000, 0x109F], language: 'Myanmar (Burmese)' },
  { range: [0x0D80, 0x0DFF], language: 'Sinhala (Sinhalese)' },
  { range: [0x1780, 0x17FF], language: 'Khmer' },
  { range: [0x0E80, 0x0EFF], language: 'Lao' },
];

const LATIN_INDICATORS: Record<string, string[]> = {
  'Dutch (Flemish)': ['de', 'het', 'een', 'is', 'van', 'en', 'dat', 'die', 'niet', 'voor', 'zijn', 'maar', 'ook', 'nog', 'wel', 'bij', 'naar', 'als', 'dan', 'wat', 'alstublieft', 'bedankt', 'graag', 'apotheek', 'medicijn', 'goedendag', 'dank', 'hoe', 'gaat'],
  'Dutch': ['de', 'het', 'een', 'is', 'van', 'en', 'dat', 'niet', 'voor', 'zijn'],
  'French': ['le', 'la', 'les', 'un', 'une', 'des', 'est', 'sont', 'je', 'tu', 'il', 'nous', 'vous', 'bonjour', 'merci', 'oui', 'non', 'avec', 'pour', 'dans', 'que', 'qui', 'pas', 'mais', 'pharmacie', 'médicament', 'bien', 'très', 'comment'],
  'German': ['der', 'die', 'das', 'ein', 'eine', 'ist', 'und', 'nicht', 'ich', 'sie', 'wir', 'haben', 'sein', 'von', 'mit', 'auf', 'für', 'aber', 'auch', 'guten', 'tag', 'danke', 'bitte', 'apotheke'],
  'Spanish': ['el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'yo', 'hola', 'gracias', 'por', 'para', 'con', 'que', 'pero', 'más', 'muy', 'farmacia', 'buenos', 'días', 'cómo'],
  'Italian': ['il', 'la', 'lo', 'gli', 'le', 'un', 'una', 'è', 'sono', 'io', 'ciao', 'grazie', 'per', 'con', 'che', 'non', 'ma', 'anche', 'più', 'buongiorno', 'come', 'farmacia'],
  'Portuguese (Portugal)': ['o', 'a', 'os', 'as', 'um', 'uma', 'é', 'são', 'eu', 'obrigado', 'por', 'com', 'que', 'não', 'mas', 'também', 'mais', 'muito', 'farmácia', 'bom', 'dia', 'como'],
  'Portuguese (Brazil)': ['o', 'a', 'os', 'as', 'um', 'uma', 'é', 'são', 'eu', 'obrigado', 'por', 'com', 'que', 'não', 'mas', 'também', 'mais', 'muito', 'farmácia', 'olá', 'tudo', 'bem'],
  'Turkish': ['bir', 'bu', 've', 'için', 'ile', 'ben', 'sen', 'biz', 'var', 'yok', 'merhaba', 'teşekkür', 'evet', 'hayır', 'çok', 'iyi', 'değil', 'ama', 'eczane', 'ilaç', 'nasıl'],
  'Polish': ['jest', 'nie', 'się', 'na', 'to', 'do', 'że', 'tak', 'ale', 'jak', 'ten', 'za', 'dziękuję', 'proszę', 'bardzo', 'apteka', 'dzień', 'dobry'],
  'Romanian': ['este', 'sunt', 'nu', 'și', 'la', 'de', 'un', 'eu', 'mulțumesc', 'da', 'bine', 'foarte', 'cu', 'pentru', 'farmacie', 'bună', 'ziua'],
  'English (US)': ['the', 'is', 'are', 'was', 'have', 'has', 'will', 'would', 'could', 'should', 'can', 'do', 'does', 'not', 'and', 'but', 'or', 'that', 'this', 'what', 'yes', 'no', 'please', 'thank', 'hello', 'pharmacy', 'medicine', 'good', 'morning'],
  'English (UK)': ['the', 'is', 'are', 'was', 'have', 'has', 'will', 'would', 'could', 'should', 'can', 'do', 'does', 'not', 'and', 'but', 'or', 'that', 'this', 'what', 'yes', 'no', 'please', 'thank', 'hello', 'pharmacy', 'medicine', 'cheers', 'brilliant'],
  'Tagalog (Filipino)': ['ang', 'ng', 'sa', 'na', 'ay', 'mga', 'ko', 'mo', 'ka', 'po', 'opo', 'salamat', 'magandang', 'araw', 'umaga', 'gabi', 'kumusta', 'oo', 'hindi', 'paano', 'naman', 'siya', 'kami', 'tayo', 'nila', 'niya', 'dito', 'iyon', 'ano', 'bakit', 'kung', 'mabuti', 'hapon', 'gusto', 'kailangan', 'paki', 'talaga', 'lang', 'din', 'rin', 'ba', 'saan', 'gamot'],
  'Vietnamese': ['của', 'và', 'là', 'có', 'cho', 'được', 'một', 'trong', 'không', 'với', 'này', 'đã', 'sẽ', 'nhưng', 'xin', 'chào', 'cảm', 'ơn', 'tôi', 'bạn', 'rất', 'thuốc', 'nhà', 'vâng', 'đây', 'nào', 'gì', 'thế'],
  'Indonesian': ['yang', 'dan', 'di', 'ini', 'itu', 'dengan', 'untuk', 'dari', 'pada', 'adalah', 'tidak', 'saya', 'anda', 'terima', 'kasih', 'selamat', 'pagi', 'siang', 'malam', 'apa', 'bagaimana', 'bisa', 'mau', 'obat', 'apotek', 'baik', 'ya', 'sudah'],
  'Malay': ['yang', 'dan', 'di', 'ini', 'itu', 'dengan', 'untuk', 'dari', 'pada', 'adalah', 'tidak', 'saya', 'anda', 'terima', 'kasih', 'selamat', 'pagi', 'apa', 'bagaimana', 'boleh', 'ubat', 'farmasi', 'ya', 'baik'],
  'Swahili': ['na', 'ya', 'ni', 'kwa', 'wa', 'ili', 'hii', 'hiyo', 'yake', 'habari', 'asante', 'ndio', 'hapana', 'dawa', 'karibu', 'sana', 'nzuri', 'tafadhali', 'jambo', 'mimi', 'wewe', 'sisi'],
  'Croatian': ['je', 'su', 'ne', 'da', 'se', 'na', 'za', 'ali', 'od', 'sam', 'ima', 'hvala', 'molim', 'dobro', 'jutro', 'dan', 'ljekarna', 'kako', 'što'],
  'Czech': ['je', 'jsou', 'ne', 'na', 'se', 'za', 'ale', 'tak', 'jsem', 'děkuji', 'prosím', 'dobrý', 'den', 'lékárna', 'jak', 'co', 'ano', 'není', 'velmi'],
  'Hungarian': ['és', 'hogy', 'nem', 'van', 'egy', 'az', 'ez', 'meg', 'már', 'volt', 'köszönöm', 'kérem', 'igen', 'jó', 'napot', 'gyógyszertár', 'hogyan', 'mit'],
  'Swedish': ['och', 'är', 'att', 'det', 'en', 'ett', 'som', 'för', 'med', 'inte', 'den', 'har', 'jag', 'tack', 'hej', 'god', 'dag', 'apotek', 'hur', 'bra'],
  'Norwegian': ['og', 'er', 'at', 'det', 'en', 'et', 'som', 'for', 'med', 'ikke', 'den', 'har', 'jeg', 'takk', 'hei', 'god', 'dag', 'apotek', 'hvordan', 'bra'],
  'Danish': ['og', 'er', 'at', 'det', 'en', 'et', 'som', 'for', 'med', 'ikke', 'den', 'har', 'jeg', 'tak', 'hej', 'god', 'dag', 'apotek', 'hvordan', 'godt'],
  'Finnish': ['ja', 'on', 'ei', 'se', 'että', 'oli', 'mutta', 'niin', 'kun', 'minä', 'sinä', 'kiitos', 'hyvää', 'päivää', 'apteekki', 'miten', 'kyllä'],
  'Greek': ['και', 'είναι', 'δεν', 'να', 'ένα', 'για', 'αλλά', 'αυτό', 'από', 'ευχαριστώ', 'καλημέρα', 'ναι', 'φαρμακείο'],
  'Russian': ['и', 'в', 'не', 'на', 'он', 'она', 'это', 'что', 'как', 'да', 'нет', 'спасибо', 'здравствуйте', 'аптека', 'хорошо', 'пожалуйста'],
  'Ukrainian': ['і', 'в', 'не', 'на', 'він', 'вона', 'це', 'що', 'як', 'так', 'ні', 'дякую', 'аптека', 'добре', 'будь ласка'],
  'Arabic': ['في', 'من', 'على', 'هذا', 'هذه', 'أن', 'لا', 'نعم', 'شكرا', 'مرحبا', 'صيدلية', 'دواء', 'كيف'],
  'Hindi': ['और', 'है', 'में', 'को', 'का', 'की', 'के', 'से', 'नहीं', 'हां', 'धन्यवाद', 'नमस्ते', 'दवाई', 'कैसे'],
  'Urdu': ['اور', 'ہے', 'میں', 'کو', 'کا', 'کی', 'کے', 'سے', 'نہیں', 'ہاں', 'شکریہ', 'سلام', 'دوائی'],
  'Somali': ['waa', 'iyo', 'ka', 'in', 'la', 'oo', 'aan', 'ku', 'si', 'mahadsanid', 'haa', 'maya', 'farmashiye', 'dawo', 'sidee'],
  'Amharic': ['እና', 'ነው', 'ያለ', 'ለ', 'ከ', 'አይ', 'አዎ', 'አመሰግናለሁ'],
};

function detectByScript(text: string): { language: string; confidence: number } | null {
  const scriptCounts: Record<string, number> = {};
  let totalNonAscii = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (!code || code < 128) continue;
    totalNonAscii++;
    for (const { range, language } of SCRIPT_RANGES) {
      if (code >= range[0] && code <= range[1]) {
        scriptCounts[language] = (scriptCounts[language] || 0) + 1;
        break;
      }
    }
  }

  if (totalNonAscii < 2) return null;

  const entries = Object.entries(scriptCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [topLang, topCount] = entries[0];
  const ratio = topCount / totalNonAscii;
  if (ratio > 0.4) {
    return { language: topLang, confidence: Math.min(ratio + 0.2, 1.0) };
  }
  return null;
}

function detectByLatinWords(text: string): { language: string; confidence: number } | null {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 1) return null;

  const scores: Record<string, number> = {};
  for (const [language, indicators] of Object.entries(LATIN_INDICATORS)) {
    let matches = 0;
    for (const word of words) {
      if (indicators.includes(word)) matches++;
    }
    if (matches > 0) {
      scores[language] = matches / Math.max(words.length, 1);
    }
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [topLang, topScore] = entries[0];
  if (topScore < 0.03) return null;

  return { language: topLang, confidence: Math.min(topScore * 2.5, 0.95) };
}

function detectByDiacritics(text: string): { language: string; confidence: number } | null {
  const viDiacritics = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
  if (viDiacritics.test(text)) {
    const matches = (text.match(viDiacritics) || []).length;
    if (matches >= 2) return { language: 'Vietnamese', confidence: 0.85 };
  }

  const trChars = /[çğıöşü]/i;
  if (trChars.test(text)) {
    const matches = (text.match(/[çğışöü]/gi) || []).length;
    if (matches >= 2) return { language: 'Turkish', confidence: 0.6 };
  }

  const plChars = /[ąćęłńóśźż]/i;
  if (plChars.test(text)) {
    const matches = (text.match(/[ąćęłńóśźż]/gi) || []).length;
    if (matches >= 2) return { language: 'Polish', confidence: 0.65 };
  }

  const roChars = /[ăâîșț]/i;
  if (roChars.test(text)) {
    const matches = (text.match(/[ăâîșț]/gi) || []).length;
    if (matches >= 2) return { language: 'Romanian', confidence: 0.65 };
  }

  return null;
}

export function normalizeLanguage(detected: string): string | null {
  const lower = detected.toLowerCase().trim();
  const match = AVAILABLE_LANGUAGES.find(
    l => l.value.toLowerCase() === lower || l.name.toLowerCase() === lower
  );
  return match?.value ?? null;
}

export function isStaffLanguage(language: string, staffLang?: string): boolean {
  const l = language.toLowerCase();
  const s = (staffLang ?? STAFF_LANGUAGE).toLowerCase();
  if (l === s) return true;
  if (l.startsWith(s.split(' ')[0].split('(')[0].trim())) return true;
  if (s.startsWith(l.split(' ')[0].split('(')[0].trim())) return true;
  return false;
}

export function detectLanguageFromText(text: string): DetectionResult | null {
  if (!text || text.trim().length < 1) return null;

  const scriptResult = detectByScript(text);
  if (scriptResult && scriptResult.confidence > 0.5) {
    const normalized = normalizeLanguage(scriptResult.language);
    if (normalized) {
      return {
        language: scriptResult.language,
        confidence: scriptResult.confidence,
        normalizedLocale: normalized,
      };
    }
  }

  const diacriticResult = detectByDiacritics(text);
  if (diacriticResult && diacriticResult.confidence > 0.5) {
    const normalized = normalizeLanguage(diacriticResult.language);
    if (normalized) {
      return {
        language: diacriticResult.language,
        confidence: diacriticResult.confidence,
        normalizedLocale: normalized,
      };
    }
  }

  const latinResult = detectByLatinWords(text);
  if (latinResult) {
    const normalized = normalizeLanguage(latinResult.language);
    if (normalized) {
      return {
        language: latinResult.language,
        confidence: latinResult.confidence,
        normalizedLocale: normalized,
      };
    }
  }

  return null;
}

export function whichLanguage(text: string, langA: string, langB: string): 'a' | 'b' | null {
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const aWords = LATIN_INDICATORS[langA] || [];
  const bWords = LATIN_INDICATORS[langB] || [];
  let aHits = 0, bHits = 0;
  for (const w of words) {
    if (aWords.includes(w)) aHits++;
    if (bWords.includes(w)) bHits++;
  }

  const scriptResult = detectByScript(text);
  if (scriptResult && scriptResult.confidence > 0.4) {
    const norm = normalizeLanguage(scriptResult.language);
    if (norm) {
      if (isStaffLanguage(norm, langA)) return 'a';
      if (isStaffLanguage(norm, langB)) return 'b';
    }
    return 'b';
  }

  if (aHits > bHits && aHits >= 1) return 'a';
  if (bHits > aHits && bHits >= 1) return 'b';
  return null;
}

export function inferTurnDirection(
  inputText: string,
  guestLanguage: string | null,
  staffLang?: string,
): 'guest-to-staff' | 'staff-to-guest' {
  if (!guestLanguage) return 'guest-to-staff';

  const staff = staffLang ?? STAFF_LANGUAGE;
  const words = inputText.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'guest-to-staff';

  const scriptResult = detectByScript(inputText);
  if (scriptResult && scriptResult.confidence > 0.4) {
    const norm = normalizeLanguage(scriptResult.language);
    if (norm && isStaffLanguage(norm, staff)) return 'staff-to-guest';
    return 'guest-to-staff';
  }

  const staffWords = LATIN_INDICATORS[staff] || [];
  const guestWords = LATIN_INDICATORS[guestLanguage] || [];

  let staffHits = 0;
  let guestHits = 0;
  for (const w of words) {
    if (staffWords.includes(w)) staffHits++;
    if (guestWords.includes(w)) guestHits++;
  }

  if (staffHits > 0 && staffHits >= guestHits) return 'staff-to-guest';
  if (guestHits > 0 && guestHits > staffHits) return 'guest-to-staff';

  const result = detectLanguageFromText(inputText);
  if (result && isStaffLanguage(result.normalizedLocale, staff)) return 'staff-to-guest';

  return 'guest-to-staff';
}
