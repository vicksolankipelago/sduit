import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Login.css';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithMagicLink, signInWithEmail, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await signInWithMagicLink(email);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the magic link!');
    }
    setLoading(false);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await signInWithEmail(email, password);

    if (error) {
      // Provide helpful error message for invalid credentials
      if (error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid credentials')) {
        setError('Invalid email or password. If you don\'t have an account, click "Create Account" below.');
      } else {
        setError(error.message);
      }
    } else {
      navigate(from, { replace: true });
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email to confirm your account!');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>SDUI Journey Builder</h1>
        <p className="subtitle">Sign in to continue</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'magic' ? 'active' : ''}`}
            onClick={() => setMode('magic')}
            type="button"
          >
            Magic Link
          </button>
          <button
            className={`auth-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => setMode('password')}
            type="button"
          >
            Email & Password
          </button>
        </div>

        {mode === 'magic' ? (
          <form onSubmit={handleMagicLink} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="email-password">Email</label>
              <input
                id="email-password"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleSignUp}
              disabled={loading}
            >
              Create Account
            </button>
            <Link to="/reset-password" className="forgot-password-link">
              Forgot password?
            </Link>
          </form>
        )}

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
};
