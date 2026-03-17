import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE, STAFF_LANGUAGE } from './constants';
import {
  FunctionDeclaration,
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

export type SessionPhase = 'idle' | 'selecting-language' | 'prompting' | 'detecting' | 'live' | 'error';
export type GuestLanguageSource = 'auto' | 'manual-override' | null;
export type TurnDirection = 'guest-to-staff' | 'staff-to-guest' | null;

export interface SessionState {
  staffLanguage: string;
  guestLanguage: string | null;
  pendingGuestLanguage: string | null;
  guestLanguageSource: GuestLanguageSource;
  sessionPhase: SessionPhase;
  activeTurn: TurnDirection;
  detectionConfidence: number | null;
  lastDetectedTranscript: string | null;
  errorMessage: string | null;

  pendingAction: 'start' | 'stop' | 'reset-language' | 'select-language' | null;
  pendingLanguageOverride: string | null;
  pendingSelectedLanguage: string | null;

  requestStart: () => void;
  requestStop: () => void;
  requestResetLanguage: () => void;
  requestLanguageOverride: (language: string) => void;
  requestSelectLanguage: (language: string) => void;
  clearPendingAction: () => void;

  setStaffLanguage: (language: string) => void;
  setPhase: (phase: SessionPhase) => void;
  setGuestLanguage: (language: string, confidence: number, source: GuestLanguageSource) => void;
  setPendingGuestLanguage: (language: string | null) => void;
  setActiveTurn: (direction: TurnDirection) => void;
  setLastDetectedTranscript: (transcript: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

const SESSION_DEFAULTS = {
  staffLanguage: STAFF_LANGUAGE,
  guestLanguage: null as string | null,
  pendingGuestLanguage: null as string | null,
  guestLanguageSource: null as GuestLanguageSource,
  sessionPhase: 'idle' as SessionPhase,
  activeTurn: null as TurnDirection,
  detectionConfidence: null as number | null,
  lastDetectedTranscript: null as string | null,
  errorMessage: null as string | null,
  pendingAction: null as 'start' | 'stop' | 'reset-language' | 'select-language' | null,
  pendingLanguageOverride: null as string | null,
  pendingSelectedLanguage: null as string | null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...SESSION_DEFAULTS,

  requestStart: () => set({ pendingAction: 'start' }),
  requestStop: () => set({ pendingAction: 'stop' }),
  requestResetLanguage: () => set({ pendingAction: 'reset-language' }),
  requestLanguageOverride: (language) =>
    set({ pendingAction: 'reset-language', pendingLanguageOverride: language }),
  requestSelectLanguage: (language) =>
    set({ pendingAction: 'select-language', pendingSelectedLanguage: language }),
  clearPendingAction: () =>
    set({ pendingAction: null, pendingLanguageOverride: null }),

  setStaffLanguage: (language) => set({ staffLanguage: language }),
  setPhase: (phase) => set({ sessionPhase: phase, errorMessage: null }),
  setGuestLanguage: (language, confidence, source) =>
    set({ guestLanguage: language, pendingGuestLanguage: null, detectionConfidence: confidence, guestLanguageSource: source }),
  setPendingGuestLanguage: (language) => set({ pendingGuestLanguage: language }),
  setActiveTurn: (direction) => set({ activeTurn: direction }),
  setLastDetectedTranscript: (transcript) => set({ lastDetectedTranscript: transcript }),
  setError: (message) => set({ sessionPhase: 'error', errorMessage: message }),
  reset: () => set({ ...SESSION_DEFAULTS, pendingGuestLanguage: null }),
}));

// ---------------------------------------------------------------------------
// App settings (voice, model, topic)
// ---------------------------------------------------------------------------

export const useSettings = create<{
  model: string;
  voice: string;
  topic: string;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setTopic: (topic: string) => void;
}>((set) => ({
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  topic: '',
  setModel: (model) => set({ model }),
  setVoice: (voice) => set({ voice }),
  setTopic: (topic) => set({ topic }),
}));

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export const useUI = create<{
  isSidebarOpen: boolean;
  isProfileOpen: boolean;
  micVolume: number;
  introVolume: number;
  ttsVolume: number;
  introComplete: boolean;
  dbSessionId: string | null;
  activeSpeaker: 'none' | 'staff' | 'guest' | 'ai';
  guestLanguageJustConfirmed: boolean;
  awaitingAiResponse: boolean;
  toggleSidebar: () => void;
  toggleProfile: () => void;
  setMicVolume: (v: number) => void;
  setIntroVolume: (v: number) => void;
  setTtsVolume: (v: number) => void;
  setIntroComplete: (v: boolean) => void;
  setActiveSpeaker: (s: 'none' | 'staff' | 'guest' | 'ai') => void;
  setGuestLanguageJustConfirmed: (v: boolean) => void;
  setAwaitingAiResponse: (v: boolean) => void;
}>((set) => ({
  isSidebarOpen: false,
  isProfileOpen: false,
  micVolume: 0,
  introVolume: 0,
  ttsVolume: 0,
  introComplete: false,
  dbSessionId: null,
  activeSpeaker: 'none',
  guestLanguageJustConfirmed: false,
  awaitingAiResponse: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen, isProfileOpen: false })),
  toggleProfile: () => set((s) => ({ isProfileOpen: !s.isProfileOpen, isSidebarOpen: false })),
  setMicVolume: (micVolume) => set({ micVolume }),
  setIntroVolume: (introVolume) => set({ introVolume }),
  setTtsVolume: (ttsVolume) => set({ ttsVolume }),
  setIntroComplete: (introComplete) => set({ introComplete }),
  setActiveSpeaker: (activeSpeaker) => set({ activeSpeaker }),
  setGuestLanguageJustConfirmed: (guestLanguageJustConfirmed) => set({ guestLanguageJustConfirmed }),
  setAwaitingAiResponse: (awaitingAiResponse) => set({ awaitingAiResponse }),
}));

// ---------------------------------------------------------------------------
// Conversation turns log
// ---------------------------------------------------------------------------

export interface FunctionCall {
  name: string;
  description: string;
  parameters: any;
  isEnabled: boolean;
  scheduling: FunctionResponseScheduling;
}

export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}

export interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  speakerRole?: 'staff' | 'guest' | 'system';
  direction?: TurnDirection;
  sourceLanguage?: string;
  targetLanguage?: string;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set) => ({
  turns: [],
  addTurn: (turn) =>
    set((s) => ({ turns: [...s.turns, { ...turn, timestamp: new Date() }] })),
  updateLastTurn: (update) =>
    set((s) => {
      if (s.turns.length === 0) return s;
      const newTurns = [...s.turns];
      newTurns[newTurns.length - 1] = { ...newTurns[newTurns.length - 1], ...update };
      return { turns: newTurns };
    }),
  clearTurns: () => set({ turns: [] }),
}));
