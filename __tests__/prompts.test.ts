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
    expect(prompt).toContain('Return only the translated text');
    expect(prompt).toContain('add labels');
    expect(prompt).toContain('explain');
  });

  it('includes role-based translation directions', () => {
    const prompt = buildBidirectionalPrompt('Turkish');
    expect(prompt).toContain('staff');
    expect(prompt).toContain('guest');
    expect(prompt).toContain('translate into');
  });

  it('preserves meaning and tone', () => {
    const prompt = buildBidirectionalPrompt('Spanish');
    expect(prompt).toContain('Preserve meaning');
    expect(prompt).toContain('tone');
  });
});

describe('buildGuestToStaffPrompt', () => {
  it('translates TO staff language', () => {
    const prompt = buildGuestToStaffPrompt('French');
    expect(prompt).toContain('French');
    expect(prompt).toContain(STAFF_LANGUAGE);
    expect(prompt).toContain('ONLY');
  });
});

describe('buildStaffToGuestPrompt', () => {
  it('translates TO guest language', () => {
    const prompt = buildStaffToGuestPrompt('Arabic');
    expect(prompt).toContain(STAFF_LANGUAGE);
    expect(prompt).toContain('Arabic');
  });
});

describe('buildDetectionPrompt', () => {
  it('includes ask step', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain('Dear guest');
    expect(prompt).toContain('language');
  });

  it('includes confirm step', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain('Confirm for');
  });

  it('contains output rules', () => {
    const prompt = buildDetectionPrompt();
    expect(prompt).toContain('ONLY');
    expect(prompt).toContain('Do NOT');
  });
});

describe('buildInviteText', () => {
  it('returns a welcoming string', () => {
    const text = buildInviteText();
    expect(text.length).toBeGreaterThan(10);
    expect(text.toLowerCase()).toContain('welcome');
  });
});
