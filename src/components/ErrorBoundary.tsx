import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Error caught in ${this.props.moduleName || "Module"}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#fff5f5',
          border: '1px solid #feb2b2',
          borderRadius: '12px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#c53030' }}>⚠️ Une erreur est survenue</h2>
          <p style={{ color: '#742a2a', marginBottom: '20px' }}>
            Désolé, le module <strong>{this.props.moduleName || "Facturation"}</strong> a rencontré un problème technique et ne peut pas être affiché.
          </p>
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'left',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxHeight: '150px',
            overflowY: 'auto',
            border: '1px solid #edf2f7',
            marginBottom: '20px'
          }}>
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#e53e3e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Recharger l'application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
