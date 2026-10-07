import React from 'react';
import { useAppContext } from '../store';
import { WifiOff, AlertCircle, RefreshCw, RotateCcw, X } from 'lucide-react';

export const SyncStatusBanner: React.FC = () => {
  const { isOnline, syncStatus, lastSyncError, clearSyncError, lastDeletedTournament, undoDeleteTournament } = useAppContext();

  if (isOnline && syncStatus !== 'error' && !lastSyncError && !lastDeletedTournament) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-2 z-40">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-between gap-3 bg-zinc-900/95 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium backdrop-blur-md mb-2">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Modo sin conexión. Los cambios se guardan localmente y se sincronizarán al recuperar la red.</span>
          </div>
        </div>
      )}

      {/* Sync / Firestore error banner */}
      {lastSyncError && (
        <div className="flex items-center justify-between gap-3 bg-red-950/90 border border-red-500/30 text-red-200 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium backdrop-blur-md mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{lastSyncError}</span>
          </div>
          <button
            onClick={clearSyncError}
            className="p-1 hover:bg-red-900/50 rounded-lg text-red-400 hover:text-white transition-colors"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Undo deleted tournament banner */}
      {lastDeletedTournament && (
        <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-yellow-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium mb-2">
          <span>Torneo <strong>"{lastDeletedTournament.name}"</strong> eliminado.</span>
          <button
            onClick={undoDeleteTournament}
            className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-[11px] uppercase tracking-wider transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Deshacer
          </button>
        </div>
      )}
    </div>
  );
};
