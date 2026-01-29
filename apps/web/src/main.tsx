import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/voiceAgent/ErrorBoundary';
import { LoginPage } from './pages/Login';
import { AdminLoginPage } from './pages/AdminLogin';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { ResetPasswordPage } from './pages/ResetPassword';
import VoiceAgent from './pages/VoiceAgent';
import { JourneyBuilderPage } from './pages/JourneyBuilder';
import { TranscriptsPage } from './pages/Transcripts';
import UIShowcase from './pages/UIShowcase';
import { SettingsPage } from './pages/Settings';
import { PreviewAccessPage } from './pages/PreviewAccess';
import { AgentEditorPage } from './pages/AgentEditor';
import { MobilePreviewPage } from './pages/MobilePreview';
import { FeedbackPage } from './pages/Feedback';
import './styles/pelago-design-system.css';
import './pages/Login.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary componentName="App">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />

            {/* Protected preview route (no layout - redirects to voice agent) */}
            <Route path="/preview/:journeyId" element={
              <ProtectedRoute>
                <MobilePreviewPage />
              </ProtectedRoute>
            } />

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
              <Route path="builder/agent" element={<AgentEditorPage />} />
              <Route path="transcripts" element={<TranscriptsPage />} />
              <Route path="screens" element={<UIShowcase />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="preview-access" element={<PreviewAccessPage />} />
            </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
