import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export const AdminLoginPage: React.FC = () => {
  const { user, loading, login, registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        const result = await registerAdmin({ email, password, firstName, lastName });
        if (!result.success) {
          setError(result.error || 'Registration failed');
        }
      } else {
        const result = await login({ email, password });
        if (!result.success) {
          setError(result.error || 'Login failed');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Flow Builder</h1>
        <p className="subtitle admin-subtitle">Admin Access</p>
        <p className="subtitle">{isRegister ? 'Create an admin account' : 'Sign in to continue'}</p>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </>
          )}
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
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>

          <button 
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : (isRegister ? 'Create Admin Account' : 'Sign In')}
          </button>

          {!isRegister && (
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot your password?
            </button>
          )}
        </form>

        <div className="auth-switch">
          {isRegister ? (
            <p>Already have an account? <button type="button" onClick={() => { setIsRegister(false); setError(''); }}>Sign in</button></p>
          ) : (
            <p>Need an admin account? <button type="button" onClick={() => { setIsRegister(true); setError(''); }}>Create one</button></p>
          )}
        </div>

        <div className="auth-switch" style={{ marginTop: '0.5rem' }}>
          <p><button type="button" onClick={() => navigate('/login')}>Back to regular login</button></p>
        </div>
      </div>
    </div>
  );
};
