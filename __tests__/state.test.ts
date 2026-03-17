import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore, useLogStore, useSettings } from '../lib/state';
import { STAFF_LANGUAGE } from '../lib/constants';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('starts in idle phase with staff language set', () => {
    const state = useSessionStore.getState();
    expect(state.sessionPhase).toBe('idle');
    expect(state.staffLanguage).toBe(STAFF_LANGUAGE);
    expect(state.guestLanguage).toBeNull();
    expect(state.activeTurn).toBeNull();
  });

  it('transitions through session phases', () => {
    const store = useSessionStore.getState();

    store.setPhase('prompting');
    expect(useSessionStore.getState().sessionPhase).toBe('prompting');

    store.setPhase('detecting');
    expect(useSessionStore.getState().sessionPhase).toBe('detecting');

    store.setPhase('live');
    expect(useSessionStore.getState().sessionPhase).toBe('live');
  });

  it('sets guest language with auto-detection', () => {
    const store = useSessionStore.getState();
    store.setGuestLanguage('French', 0.85, 'auto');

    const state = useSessionStore.getState();
    expect(state.guestLanguage).toBe('French');
    expect(state.detectionConfidence).toBe(0.85);
    expect(state.guestLanguageSource).toBe('auto');
  });

  it('sets guest language with manual override', () => {
    const store = useSessionStore.getState();
    store.setGuestLanguage('Turkish', 1.0, 'manual-override');

    const state = useSessionStore.getState();
    expect(state.guestLanguage).toBe('Turkish');
    expect(state.detectionConfidence).toBe(1.0);
    expect(state.guestLanguageSource).toBe('manual-override');
  });

  it('tracks active turn direction', () => {
    const store = useSessionStore.getState();

    store.setActiveTurn('guest-to-staff');
    expect(useSessionStore.getState().activeTurn).toBe('guest-to-staff');

    store.setActiveTurn('staff-to-guest');
    expect(useSessionStore.getState().activeTurn).toBe('staff-to-guest');
  });

  it('handles error state', () => {
    const store = useSessionStore.getState();
    store.setError('Connection failed');

    const state = useSessionStore.getState();
    expect(state.sessionPhase).toBe('error');
    expect(state.errorMessage).toBe('Connection failed');
  });

  it('clears error on phase transition', () => {
    const store = useSessionStore.getState();
    store.setError('Some error');
    store.setPhase('detecting');

    const state = useSessionStore.getState();
    expect(state.sessionPhase).toBe('detecting');
    expect(state.errorMessage).toBeNull();
  });

  it('reset returns to initial state', () => {
    const store = useSessionStore.getState();
    store.setPhase('live');
    store.setGuestLanguage('Arabic', 0.9, 'auto');
    store.setActiveTurn('guest-to-staff');

    store.reset();
    const state = useSessionStore.getState();
    expect(state.sessionPhase).toBe('idle');
    expect(state.guestLanguage).toBeNull();
    expect(state.activeTurn).toBeNull();
  });

  it('handles pending actions', () => {
    const store = useSessionStore.getState();

    store.requestStart();
    expect(useSessionStore.getState().pendingAction).toBe('start');

    store.clearPendingAction();
    expect(useSessionStore.getState().pendingAction).toBeNull();

    store.requestStop();
    expect(useSessionStore.getState().pendingAction).toBe('stop');

    store.requestResetLanguage();
    expect(useSessionStore.getState().pendingAction).toBe('reset-language');
  });

  it('handles language override request', () => {
    const store = useSessionStore.getState();
    store.requestLanguageOverride('Spanish');

    const state = useSessionStore.getState();
    expect(state.pendingAction).toBe('reset-language');
    expect(state.pendingLanguageOverride).toBe('Spanish');
  });
});

describe('useLogStore', () => {
  beforeEach(() => {
    useLogStore.getState().clearTurns();
  });

  it('starts with empty turns', () => {
    expect(useLogStore.getState().turns).toHaveLength(0);
  });

  it('adds turns with timestamps', () => {
    useLogStore.getState().addTurn({ role: 'user', text: 'Hello', isFinal: true });
    const turns = useLogStore.getState().turns;
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe('user');
    expect(turns[0].text).toBe('Hello');
    expect(turns[0].timestamp).toBeInstanceOf(Date);
  });

  it('adds turns with session metadata', () => {
    useLogStore.getState().addTurn({
      role: 'user',
      text: 'Bonjour',
      isFinal: true,
      speakerRole: 'guest',
      direction: 'guest-to-staff',
      sourceLanguage: 'French',
      targetLanguage: 'Dutch (Flemish)',
    });

    const turn = useLogStore.getState().turns[0];
    expect(turn.speakerRole).toBe('guest');
    expect(turn.direction).toBe('guest-to-staff');
    expect(turn.sourceLanguage).toBe('French');
    expect(turn.targetLanguage).toBe('Dutch (Flemish)');
  });

  it('updates last turn', () => {
    useLogStore.getState().addTurn({ role: 'agent', text: 'Hallo', isFinal: false });
    useLogStore.getState().updateLastTurn({ text: 'Hallo, welkom', isFinal: true });

    const turn = useLogStore.getState().turns[0];
    expect(turn.text).toBe('Hallo, welkom');
    expect(turn.isFinal).toBe(true);
  });

  it('clears all turns', () => {
    useLogStore.getState().addTurn({ role: 'user', text: 'Hi', isFinal: true });
    useLogStore.getState().addTurn({ role: 'agent', text: 'Hello', isFinal: true });
    useLogStore.getState().clearTurns();

    expect(useLogStore.getState().turns).toHaveLength(0);
  });
});

describe('useSettings', () => {
  it('has correct defaults', () => {
    const state = useSettings.getState();
    expect(state.voice).toBe('Charon');
    expect(state.topic).toBe('');
  });

  it('updates voice', () => {
    useSettings.getState().setVoice('Puck');
    expect(useSettings.getState().voice).toBe('Puck');
  });

  it('updates topic', () => {
    useSettings.getState().setTopic('Medication dispensing');
    expect(useSettings.getState().topic).toBe('Medication dispensing');
  });
});
