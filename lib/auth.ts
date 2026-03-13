/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { ConversationTurn } from './state';

// --- MOCKED AUTH STORE ---
// This provides a default "logged-in" state without any actual authentication.
// The app will behave as if a non-admin user is always logged in.

interface AuthState {
  session: object | null;
  user: { id: string; email: string; } | null;
  isSuperAdmin: boolean;
  loading: boolean;
  loadingData: boolean;
  signOut: () => void;
}

export const useAuth = create<AuthState>(() => ({
  session: { MOCKED: true }, // Represents a logged-in session
  user: { id: 'local-user', email: 'local-user@example.com' }, // Mock user
  isSuperAdmin: false, // Ensures system prompt is hidden
  loading: false,
  loadingData: false,
  // All auth actions are no-ops
  signOut: () => { /* No operation */ },
}));

// --- DATABASE HELPERS (NO-OP) ---
// These functions are kept for API compatibility with components but do not perform any database actions.

export const updateUserSettings = async (userId: string, newSettings: Partial<{ systemPrompt: string; voice: string }>) => {
  // No-op
  return Promise.resolve();
};

export const updateUserConversations = async (userId: string, turns: ConversationTurn[]) => {
  // No-op
  return Promise.resolve();
};

export const clearUserConversations = async (userId: string) => {
  // No-op
  return Promise.resolve();
};
