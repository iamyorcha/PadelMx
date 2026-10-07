import React, { useState } from 'react';
import { Tournament } from '../domain/tournament';
import { validateTournamentIntegrity } from '../domain/integrity';
import { getTelemetryLogs, clearTelemetryLogs } from '../utils/telemetry';
import { getFeatureFlag, setFeatureFlag, FeatureFlags } from '../utils/featureFlags';
import { APP_VERSION, BUILD_ID, BUILD_ENV } from '../version';
import { ShieldCheck, AlertTriangle, CheckCircle, Terminal, Flag, X, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournament?: Tournament | null;
}

export const DiagnosticsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tournament
}) => {
  const [activeTab, setActiveTab] = useState<'integrity' | 'telemetry' | 'flags'>('integrity');
  const [logs, setLogs] = useState(() => getTelemetryLogs());

  if (!isOpen) return null;

  const integrity = tournament ? validateTournamentIntegrity(tournament) : null;

  const refreshLogs = () => {
    setLogs(getTelemetryLogs());
  };

  const flags: (keyof FeatureFlags)[] = [
    'playoffs',
    'publicViewer',
    'tvMode',
    'globalRankings',
    'experimentalFormats',
    'audioCelebrations'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Diagnósticos de Producción</h2>
            <p className="text-xs text-zinc-400">v{APP_VERSION} · {BUILD_ENV} · {BUILD_ID}</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 border-b border-zinc-800 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('integrity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              activeTab === 'integrity' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Integridad
          </button>
          <button
            onClick={() => { setActiveTab('telemetry'); refreshLogs(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              activeTab === 'telemetry' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Telemetría ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              activeTab === 'flags' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flag className="w-3.5 h-3.5" /> Feature Flags
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'integrity' && (
            <div>
              {tournament ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border ${
                    integrity?.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {integrity?.isValid ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      )}
                      <h3 className="text-sm font-bold text-white">
                        {integrity?.isValid ? 'Torneo Saludable e Íntegro' : 'Anomalías de Integridad Detectadas'}
                      </h3>
                    </div>
                    <div className="text-xs text-zinc-300 space-y-1">
                      <div><strong>Torneo:</strong> {tournament.name} ({tournament.type})</div>
                      <div><strong>Jugadores:</strong> {tournament.players.length} registrados</div>
                      <div><strong>Partidos:</strong> {tournament.matches.length} generados</div>
                      <div><strong>Estado:</strong> {tournament.status}</div>
                    </div>
                  </div>

                  {integrity && integrity.errors.length > 0 && (
                    <div className="p-3 bg-red-950/60 border border-red-500/30 rounded-xl">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Errores críticos:</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-red-300">
                        {integrity.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {integrity && integrity.warnings.length > 0 && (
                    <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-xl">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Advertencias:</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-amber-300">
                        {integrity.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No hay un torneo activo seleccionado para auditar.
                </div>
              )}
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Buffer circular en memoria (últimos {logs.length} eventos)</span>
                <div className="flex gap-2">
                  <button
                    onClick={refreshLogs}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Actualizar
                  </button>
                  <button
                    onClick={() => { clearTelemetryLogs(); setLogs([]); }}
                    className="p-1.5 bg-zinc-800 hover:bg-red-900/50 text-red-400 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No se han registrado errores ni eventos en la sesión actual.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.slice().reverse().map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border text-xs font-mono ${
                        log.type === 'error'
                          ? 'bg-red-950/40 border-red-500/30 text-red-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span className="font-bold uppercase text-zinc-400">{log.type}: {log.name}</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {log.message && <div className="font-bold text-white mb-1">{log.message}</div>}
                      {log.context && (
                        <div className="text-[11px] text-zinc-400 truncate">
                          {JSON.stringify(log.context)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 mb-3">
                Conmutadores de contingencia para deshabilitar módulos en caso de incidentes en caliente:
              </p>
              {flags.map((flag) => {
                const isEnabled = getFeatureFlag(flag);
                return (
                  <div
                    key={flag}
                    className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800"
                  >
                    <span className="text-xs font-mono font-medium text-white">{flag}</span>
                    <button
                      onClick={() => {
                        setFeatureFlag(flag, !isEnabled);
                        // Trigger re-render
                        setActiveTab('flags');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-colors ${
                        isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
