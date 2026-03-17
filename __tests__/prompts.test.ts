import { describe, it, expect } from 'vitest';
import {
  buildBidirectionalPrompt,
  buildGuestToStaffPrompt,
  buildStaffToGuestPrompt,
  buildDetectionPrompt,
  buildInviteText,
} from '../lib/prompts';
import { STAFF_LANGUAGE } from '../lib/constants';

describe('buildBidirectionalPrompt', () => {
  it('includes both languages', () => {
    const prompt = buildBidirectionalPrompt('French');
    expect(prompt).toContain(STAFF_LANGUAGE);
    expect(prompt).toContain('French');
  });

  it('includes translation-only rules', () => {
    const prompt = buildBidirectionalPrompt('Arabic');
    expect(prompt).toContain('ONLY the translated text');
    expect(prompt).toContain('Do NOT');
  });

  it('includes topic when provided', () => {
    const prompt = buildBidirectionalPrompt('Turkish', 'Medication dispensing');
    expect(prompt).toContain('Medication dispensing');
    expect(prompt).toContain('pharmacy');
  });

  it('includes pharmacy context without topic', () => {
    const prompt = buildBidirectionalPrompt('Spanish');
    expect(prompt).toContain('pharmacy counter');
  });
});

describe('buildGuestToStaffPrompt', () => {
  it('translates TO staff language', () => {
    const prompt = buildGuestToStaffPrompt('French');
    expect(prompt).toContain('from French to ' + STAFF_LANGUAGE);
    expect(prompt).toContain('ONLY');
  });
});

describe('buildStaffToGuestPrompt', () => {
  it('translates TO guest language', () => {
    const prompt = buildStaffToGuestPrompt('Arabic');
    expect(prompt).toContain('from ' + STAFF_LANGUAGE + ' to Arabic');
  });
});

describe('buildDetectionPrompt', () => {
  it('includes welcome phase', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain('welcome');
  });

  it('includes translation phase', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain(STAFF_LANGUAGE);
    expect(prompt).toContain('translate');
  });

  it('contains output rules', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain('ONLY');
    expect(prompt).toContain('No labels');
  });
});

describe('buildInviteText', () => {
  it('returns a welcoming string', () => {
    const text = buildInviteText();
    expect(text.length).toBeGreaterThan(10);
    expect(text.toLowerCase()).toContain('welcome');
  });
});
