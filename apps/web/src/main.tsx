import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { ResetPasswordPage } from './pages/ResetPassword';
import VoiceAgent from './pages/VoiceAgent';
import { JourneyBuilderPage } from './pages/JourneyBuilder';
import { TranscriptsPage } from './pages/Transcripts';
import { SettingsPage } from './pages/Settings';
import './styles/pelago-design-system.css';
import './pages/Login.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes with layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<VoiceAgent />} />
            <Route path="builder" element={<JourneyBuilderPage />} />
            <Route path="transcripts" element={<TranscriptsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
