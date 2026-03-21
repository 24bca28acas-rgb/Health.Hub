
import React, { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Activity } from 'lucide-react';
import { performMaintenance } from './services/storage';
import { DailyActivityProvider } from './contexts/DailyActivityContext';

/**
 * ELITE BOOT SEQUENCE
 * Prioritize storage maintenance to clear third-party bloat before Supabase attempts to load tokens.
 */
// performMaintenance(); // DISABLED: Prevents aggressive session clearing on boot.

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("System Error caught:", error, errorInfo);
    // Automatic recovery for storage errors
    if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
      console.warn("ErrorBoundary triggered storage cleanup.");
      performMaintenance(true);
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000000_100%)] pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-6 opacity-30">
              <Activity size={48} color="#CEF245" />
            </div>
            <h1 className="text-xl font-black mb-3 tracking-[0.2em] text-luxury-neon uppercase font-cyber">Recovery Protocol</h1>
            <p className="text-gray-500 max-w-xs text-xs leading-relaxed mb-8">
               Ecosystem storage limit exceeded. The browser cannot save your secure session. 
               We are performing a diagnostic reset.
            </p>
            <button 
              onClick={() => {
                  localStorage.clear();
                  window.location.reload();
              }}
              className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-bold text-[10px] tracking-[0.2em] uppercase active:scale-95 transition-all font-cyber"
            >
              Clear & Restart System
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const lockOrientation = async () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
    try {
      await (screen.orientation as any).lock('portrait');
    } catch (e) {}
  }
};

lockOrientation().catch(() => {});

const container = document.getElementById('root');
if (container) {
  // Prevent multiple createRoot calls during HMR
  if (!(window as any)._reactRoot) {
    (window as any)._reactRoot = createRoot(container);
  }
  (window as any)._reactRoot.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
