import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@sduit/shared/auth';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (!supabase) {
        navigate('/login', { replace: true });
        return;
      }
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
        return;
      }

      if (session) {
        navigate('/', { replace: true });
      } else {
        // Listen for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            navigate('/', { replace: true });
          }
        });

        // Cleanup after 10 seconds if no auth change
        setTimeout(() => {
          subscription.unsubscribe();
          navigate('/login', { replace: true });
        }, 10000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="auth-callback">
      <div className="loading-spinner" />
      <p>Completing sign in...</p>
    </div>
  );
};
