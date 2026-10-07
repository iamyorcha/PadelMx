import React, { useState } from 'react';
import { X, PlusCircle, CalendarPlus, ShieldAlert } from 'lucide-react';

interface AddRoundsModalProps {
  currentRounds: number;
  onClose: () => void;
  onConfirm: (additionalRounds: number) => void;
}

export function AddRoundsModal({ currentRounds, onClose, onConfirm }: AddRoundsModalProps) {
  const [selectedRounds, setSelectedRounds] = useState<number>(3);
  const [customRounds, setCustomRounds] = useState<string>('');

  const quickOptions = [1, 2, 3, 5];

  const handleConfirm = () => {
    let roundsToAdd = selectedRounds;
    if (customRounds && parseInt(customRounds, 10) > 0) {
      roundsToAdd = parseInt(customRounds, 10);
    }
    if (roundsToAdd > 0) {
      onConfirm(roundsToAdd);
    }
  };

  const finalTotal = currentRounds + (customRounds && parseInt(customRounds, 10) > 0 ? parseInt(customRounds, 10) : selectedRounds);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm flex flex-col items-center p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
          <CalendarPlus className="w-6 h-6 text-emerald-400" />
        </div>

        <h3 className="text-lg font-black text-white text-center mb-1">
          Agregar Rondas Regulares
        </h3>
        <p className="text-xs text-zinc-400 text-center mb-5 px-2">
          El algoritmo mantendrá la equidad matemática considerando todos los partidos y descansos previos.
        </p>

        <div className="w-full bg-zinc-950/70 border border-zinc-800 rounded-2xl p-3 mb-5 flex justify-between items-center text-xs">
          <div className="text-zinc-400">
            Rondas actuales: <span className="text-white font-bold">{currentRounds}</span>
          </div>
          <div className="text-emerald-400 font-bold">
            Total resultante: <span className="text-white text-sm font-black">{finalTotal}</span>
          </div>
        </div>

        <div className="w-full space-y-3 mb-6">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">
            Seleccionar cantidad de rondas a sumar:
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quickOptions.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setSelectedRounds(opt);
                  setCustomRounds('');
                }}
                className={`py-3 rounded-xl font-black text-sm transition-all ${
                  !customRounds && selectedRounds === opt
                    ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50'
                }`}
              >
                +{opt}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <div className="text-[10px] font-medium text-zinc-400 mb-1.5 pl-1">O personalizar cantidad:</div>
            <input
              type="number"
              min="1"
              max="50"
              placeholder="Ej. 4"
              value={customRounds}
              onChange={e => setCustomRounds(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="w-full flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Confirmar (+{customRounds && parseInt(customRounds, 10) > 0 ? customRounds : selectedRounds})
          </button>
        </div>
      </div>
    </div>
  );
}
