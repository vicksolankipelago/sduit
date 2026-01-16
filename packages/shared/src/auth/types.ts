export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthSession = {
  accessToken: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user: AuthUser | null;
};

export type AuthResult = {
  session: AuthSession | null;
  error?: string;
};

export type AuthChangeCallback = (session: AuthSession | null) => void;

export type Unsubscribe = () => void;

export interface AuthClient {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  getSession(): AuthSession | null;
  onAuthStateChange(callback: AuthChangeCallback): Unsubscribe;
}
