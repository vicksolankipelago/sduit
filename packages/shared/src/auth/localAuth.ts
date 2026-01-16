import type { AuthClient, AuthResult, AuthSession, AuthChangeCallback, Unsubscribe } from './types';

const STORAGE_KEY = 'sduit.auth.session';

const listeners = new Set<AuthChangeCallback>();

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
};

const readSession = (): AuthSession | null => {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

const writeSession = (session: AuthSession | null) => {
  const storage = getStorage();
  if (!storage) return;
  if (!session) {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const notify = (session: AuthSession | null) => {
  listeners.forEach((listener) => {
    listener(session);
  });
};

const createSession = (email: string): AuthSession => ({
  accessToken: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
  refreshToken: null,
  expiresAt: null,
  user: {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-user`,
    email
  }
});

export const createLocalAuthClient = (): AuthClient => ({
  register: async (email: string, _password: string): Promise<AuthResult> => {
    const session = createSession(email);
    writeSession(session);
    notify(session);
    return { session };
  },
  login: async (email: string, _password: string): Promise<AuthResult> => {
    const session = createSession(email);
    writeSession(session);
    notify(session);
    return { session };
  },
  logout: async (): Promise<void> => {
    writeSession(null);
    notify(null);
  },
  getSession: (): AuthSession | null => readSession(),
  onAuthStateChange: (callback: AuthChangeCallback): Unsubscribe => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }
});
