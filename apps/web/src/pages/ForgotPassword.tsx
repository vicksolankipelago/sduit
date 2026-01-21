import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetUrl('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
      } else {
        setError(data.message || 'Failed to process request');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Flow Builder</h1>
        <p className="subtitle">Reset your password</p>

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div className="success-message">
            {success}
            {resetUrl && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={() => navigate(resetUrl)}
                  style={{ marginTop: '8px' }}
                >
                  Reset Password Now
                </button>
              </div>
            )}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Please wait...' : 'Send Reset Link'}
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
