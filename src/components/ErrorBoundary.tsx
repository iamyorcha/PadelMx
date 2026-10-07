import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { reportError } from '../utils/telemetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    reportError(error, {
      componentStack: errorInfo.componentStack || undefined,
      operation: 'react_error_boundary',
      route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Error inesperado de ejecución';

      return (
        <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white mb-2">
            Algo no salió como se esperaba
          </h1>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            Ha ocurrido un problema al renderizar la aplicación. Hemos registrado el incidente automáticamente para investigarlo.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm mb-6">
            <button
              onClick={this.handleRetry}
              className="flex-1 py-3 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-zinc-700 active:scale-[0.98]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 py-3 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-zinc-700 active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Recargar
            </button>
            <button
              onClick={this.handleHome}
              className="flex-1 py-3 px-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-yellow-500/10 active:scale-[0.98]"
            >
              <Home className="w-3.5 h-3.5" /> Inicio
            </button>
          </div>

          <div className="w-full max-w-md">
            <button
              onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              {this.state.showDetails ? (
                <>Ocultar detalles técnicos <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Ver detalles técnicos para soporte <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>

            {this.state.showDetails && (
              <div className="mt-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-left text-xs font-mono text-zinc-400 overflow-x-auto max-h-48 text-[11px]">
                <div className="font-bold text-red-400 mb-1">{errorMessage}</div>
                {this.state.error?.stack && (
                  <pre className="whitespace-pre-wrap opacity-75">{this.state.error.stack.slice(0, 500)}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
