import React, { useState } from 'react';
import { X, Trophy, Swords, Medal, Check, Flag } from 'lucide-react';
import { PlayoffFormat } from '../domain/tournament';

interface PlayoffConfigModalProps {
  playerCount: number;
  onClose: () => void;
  onConfirm: (format: PlayoffFormat, options?: { includeThirdPlaceMatch?: boolean }) => void;
  onFinalizeWithoutPlayoffs?: () => void;
}

export function PlayoffConfigModal({
  playerCount,
  onClose,
  onConfirm,
  onFinalizeWithoutPlayoffs
}: PlayoffConfigModalProps) {
  const [includeThirdPlace, setIncludeThirdPlace] = useState(true);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm flex flex-col items-center p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800 z-10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
        <h3 className="text-lg font-black text-white mb-1 px-4 text-center leading-tight">
          Configuración de Playoffs
        </h3>
        <p className="text-[11px] text-zinc-400 text-center mb-4 px-2 leading-snug">
          Tienes {playerCount} jugadores en el ranking. Elige el formato de eliminación.
        </p>

        {/* 3rd place match toggle */}
        {playerCount >= 8 && (
          <div
            onClick={() => setIncludeThirdPlace(!includeThirdPlace)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-2.5 mb-3 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-300 font-medium">Partido por 3er Puesto (Bronce)</span>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                includeThirdPlace
                  ? 'bg-amber-500 border-amber-500 text-zinc-950'
                  : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              {includeThirdPlace && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}

        <div className="w-full space-y-2.5 overflow-y-auto max-h-[55vh] pr-1 custom-scrollbar">
          {playerCount >= 16 && (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest pl-1">
                Top 16 Jugadores:
              </div>
              <button
                type="button"
                onClick={() => onConfirm('top16_quarters', { includeThirdPlaceMatch: includeThirdPlace })}
                className="w-full bg-zinc-950 border border-zinc-700 hover:border-yellow-500 rounded-2xl p-3 text-left transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="bg-yellow-500/10 p-1.5 rounded-lg text-yellow-500">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-yellow-500 transition-colors">
                      Cuartos de Final (Top 16)
                    </h4>
                    <span className="text-[10px] text-zinc-500">Cuartos → Semis → Gran Final</span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 pl-10">
                  4 llaves balanceadas (1º+16º vs 8º+9º, 4º+13º vs 5º+12º, etc.).
                </div>
              </button>
            </div>
          )}

          {playerCount >= 8 && (
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest pl-1">
                Top 8 Jugadores:
              </div>
              <button
                type="button"
                onClick={() => onConfirm('top8_semis', { includeThirdPlaceMatch: includeThirdPlace })}
                className="w-full bg-zinc-950 border border-zinc-700 hover:border-yellow-500 rounded-2xl p-3 text-left transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="bg-yellow-500/10 p-1.5 rounded-lg text-yellow-500">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-yellow-500 transition-colors">
                      Semifinales y Final
                    </h4>
                    <span className="text-[10px] text-zinc-500">Semis → Gran Final {includeThirdPlace && '+ 3er puesto'}</span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 pl-10 space-y-0.5">
                  <p className="flex justify-between">
                    <span>Semi 1:</span> <span className="text-white font-medium">1º + 8º vs 4º + 5º</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Semi 2:</span> <span className="text-white font-medium">2º + 7º vs 3º + 6º</span>
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onConfirm('top8_oroplata', { includeThirdPlaceMatch: includeThirdPlace })}
                className="w-full bg-zinc-950 border border-zinc-700 hover:border-yellow-500 rounded-2xl p-3 text-left transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="bg-yellow-500/10 p-1.5 rounded-lg text-yellow-500">
                    <Medal className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Finales Oro y Plata
                  </h4>
                </div>
                <div className="text-[10px] text-zinc-400 pl-10 space-y-0.5">
                  <p className="flex justify-between">
                    <span>Final Oro (1-4):</span> <span className="text-white font-medium">1º+4º vs 2º+3º</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Final Plata (5-8):</span> <span className="text-zinc-400">5º+8º vs 6º+7º</span>
                  </p>
                </div>
              </button>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest pl-1">
              Top 4 Jugadores:
            </div>
            <button
              type="button"
              onClick={() => onConfirm('top4_14v23')}
              className="w-full bg-zinc-950 border border-zinc-700 hover:border-yellow-500 rounded-2xl p-3 text-left transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-yellow-500/10 p-1.5 rounded-lg text-yellow-500">
                  <Medal className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-white text-sm group-hover:text-yellow-500 transition-colors">
                  Final Directa (Equilibrada)
                </h4>
              </div>
              <div className="text-[11px] text-zinc-400 pl-10 flex justify-between tracking-wide">
                <span>Parejas:</span> <span className="text-yellow-500 font-bold">1º y 4º vs 2º y 3º</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onConfirm('top4_12v34')}
              className="w-full bg-zinc-950 border border-zinc-700 hover:border-yellow-500 rounded-2xl p-3 text-left transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-yellow-500/10 p-1.5 rounded-lg text-yellow-500">
                  <Swords className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-white text-sm group-hover:text-yellow-500 transition-colors">
                  Final Directa (Top vs Resto)
                </h4>
              </div>
              <div className="text-[11px] text-zinc-400 pl-10 flex justify-between tracking-wide">
                <span>Parejas:</span> <span className="text-white font-bold">1º y 2º vs 3º y 4º</span>
              </div>
            </button>
          </div>

          {onFinalizeWithoutPlayoffs && (
            <div className="pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={onFinalizeWithoutPlayoffs}
                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-2xl p-3 text-left transition-all flex items-center gap-3"
              >
                <div className="bg-zinc-800 p-1.5 rounded-lg text-zinc-400">
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-200">Finalizar Torneo sin Playoffs</h4>
                  <p className="text-[10px] text-zinc-500">El podio se otorgará según la tabla regular actual.</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

