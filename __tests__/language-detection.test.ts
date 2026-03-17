import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromText,
  normalizeLanguage,
  isStaffLanguage,
  inferTurnDirection,
} from '../lib/language-detection';

describe('normalizeLanguage', () => {
  it('normalizes exact match', () => {
    expect(normalizeLanguage('French')).toBe('French');
    expect(normalizeLanguage('Turkish')).toBe('Turkish');
    expect(normalizeLanguage('Arabic')).toBe('Arabic');
  });

  it('normalizes case-insensitively', () => {
    expect(normalizeLanguage('french')).toBe('French');
    expect(normalizeLanguage('TURKISH')).toBe('Turkish');
  });

  it('returns null for unknown languages', () => {
    expect(normalizeLanguage('Klingon')).toBeNull();
    expect(normalizeLanguage('')).toBeNull();
  });

  it('matches by name field', () => {
    expect(normalizeLanguage('Arabic (Moroccan)')).toBe('Moroccan Arabic (Darija)');
  });
});

describe('isStaffLanguage', () => {
  it('recognizes Dutch (Flemish)', () => {
    expect(isStaffLanguage('Dutch (Flemish)')).toBe(true);
    expect(isStaffLanguage('dutch (flemish)')).toBe(true);
    expect(isStaffLanguage('Dutch')).toBe(true);
    expect(isStaffLanguage('Flemish')).toBe(true);
  });

  it('rejects non-Dutch languages', () => {
    expect(isStaffLanguage('French')).toBe(false);
    expect(isStaffLanguage('English (US)')).toBe(false);
  });
});

describe('detectLanguageFromText', () => {
  it('returns null for empty or very short text', () => {
    expect(detectLanguageFromText('')).toBeNull();
    expect(detectLanguageFromText('a')).toBeNull();
  });

  it('detects Arabic from script', () => {
    const result = detectLanguageFromText('مرحبا أنا بحاجة إلى دواء');
    expect(result).not.toBeNull();
    expect(result!.normalizedLocale).toBe('Arabic');
    expect(result!.confidence).toBeGreaterThan(0.5);
  });

  it('detects Russian from Cyrillic', () => {
    const result = detectLanguageFromText('Здравствуйте мне нужно лекарство');
    expect(result).not.toBeNull();
    expect(result!.normalizedLocale).toBe('Russian');
  });

  it('detects Japanese from script', () => {
    const result = detectLanguageFromText('こんにちは薬が必要です');
    expect(result).not.toBeNull();
    expect(result!.normalizedLocale).toBe('Japanese');
  });

  it('detects French from Latin word patterns', () => {
    const result = detectLanguageFromText('Bonjour je suis le pharmacien merci pour votre visite');
    expect(result).not.toBeNull();
    expect(result!.normalizedLocale).toBe('French');
  });

  it('detects Turkish from Latin word patterns', () => {
    const result = detectLanguageFromText('Merhaba ben bir ilaç için geldim teşekkür ederim');
    expect(result).not.toBeNull();
    expect(result!.normalizedLocale).toBe('Turkish');
  });

  it('detects Dutch (Flemish) from word patterns', () => {
    const result = detectLanguageFromText('Ik heb een medicijn nodig alstublieft bedankt voor de hulp');
    expect(result).not.toBeNull();
    const locale = result!.normalizedLocale;
    expect(locale === 'Dutch (Flemish)' || locale === 'Dutch').toBe(true);
  });
});

describe('inferTurnDirection', () => {
  it('returns guest-to-staff when no guest language set', () => {
    expect(inferTurnDirection('anything', null)).toBe('guest-to-staff');
  });

  it('identifies staff speaking Dutch as staff-to-guest', () => {
    const result = inferTurnDirection(
      'Ik heb een medicijn voor u dat is niet beschikbaar',
      'French',
    );
    expect(result).toBe('staff-to-guest');
  });

  it('identifies guest speaking French as guest-to-staff', () => {
    const result = inferTurnDirection(
      'Bonjour je cherche un médicament pour le mal de tête',
      'French',
    );
    expect(result).toBe('guest-to-staff');
  });
});
