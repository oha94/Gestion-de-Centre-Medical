import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import App from './App';
import Setup from './views/Setup';
import SetupService from './services/SetupService';
import './index.css';

function AppRouter() {
  const [setupStatus, setSetupStatus] = useState<{
    isConfigured: boolean;
    loading: boolean;
  }>({
    isConfigured: false,
    loading: true
  });

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const status = await SetupService.checkSetupStatus();
      setSetupStatus({
        isConfigured: status.setupCompleted,
        loading: false
      });
    } catch (error) {
      console.error('Error checking setup status:', error);
      // If there's an error, assume not configured
      setSetupStatus({
        isConfigured: false,
        loading: false
      });
    }
  };

  if (setupStatus.loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏥</div>
          <h2 style={{ margin: 0 }}>Chargement...</h2>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!setupStatus.isConfigured ? (
          <>
            <Route path="/setup" element={<Setup />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
