import { create } from 'zustand';

interface AuthState {
  session: object | null;
  user: { id: string; email: string } | null;
  loading: boolean;
  signOut: () => void;
}

export const useAuth = create<AuthState>(() => ({
  session: { MOCKED: true },
  user: { id: 'local-user', email: 'local-user@example.com' },
  loading: false,
  signOut: () => {},
}));
