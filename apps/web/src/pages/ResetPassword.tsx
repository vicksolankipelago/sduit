import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Login.css';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password reset successfully! You can now sign in.');
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-container">
          <h1>Flow Builder</h1>
          <p className="subtitle">Invalid reset link</p>
          <div className="error-message">
            This password reset link is invalid or has expired.
          </div>
          <div className="auth-switch">
            <p>
              <button type="button" onClick={() => navigate('/forgot-password')}>
                Request a new reset link
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Flow Builder</h1>
        <p className="subtitle">Set your new password</p>

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div className="success-message">
            {success}
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate('/login')}
                style={{ marginTop: '8px' }}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Please wait...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="auth-switch">
          <p>
            Remember your password?{' '}
            <button type="button" onClick={() => navigate('/login')}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
