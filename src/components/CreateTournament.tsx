import React, { useState } from 'react';
import { ArrowLeft, Users, Trophy, X, Plus, Map, Hash, Target, ChevronRight, QrCode, Clock, Loader2 } from 'lucide-react';
import { useAppContext } from '../store';
import { Player, Tournament, generateAmericanoMatches, generateKingMatches, generateMexicanoMatches } from '../domain/tournament';
import { validateTournamentIntegrity } from '../domain/integrity';
import { reportError } from '../utils/telemetry';
import { getHumanReadableErrorMessage } from '../utils/userMessages';
import { Scanner } from '@yudiel/react-qr-scanner';

export function CreateTournament({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { addTournament, setActiveTournament } = useAppContext();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [tournamentType, setTournamentType] = useState<'americano' | 'mexicano' | 'king'>('americano');
  const [pointsPerMatch, setPointsPerMatch] = useState(16);
  const [rentDurationHours, setRentDurationHours] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [courts, setCourts] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const timePerMatch = pointsPerMatch === 16 ? 15 : pointsPerMatch === 24 ? 20 : 25;
  const recommendedRoundsFromTime = Math.floor((rentDurationHours * 60) / timePerMatch);

  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: '' },
    { id: '2', name: '' },
    { id: '3', name: '' },
    { id: '4', name: '' },
  ]);

  const handleAddPlayer = () => {
    setPlayers([...players, { id: Math.random().toString(36).slice(2, 9), name: '' }]);
  };

  const handleScan = (result: any) => {
    let value = '';
    if (typeof result === 'string') {
        value = result;
    } else if (Array.isArray(result) && result.length > 0) {
        value = result[0].rawValue || result[0].text || '';
    } else if (result && result.text) {
        value = result.text;
    }

    if (!value) return;

    try {
        const data = JSON.parse(value);
        if (data.action === 'add_player' && data.uid && data.name) {
            const exists = players.some(p => p.id === data.uid);
            if (!exists) {
                // Determine if we should replace an empty player or add a new one
                const emptyIndex = players.findIndex(p => p.name.trim() === '');
                if (emptyIndex !== -1) {
                    const newPlayers = [...players];
                    newPlayers[emptyIndex] = { id: data.uid, name: data.name };
                    setPlayers(newPlayers);
                } else {
                    setPlayers([...players, { id: data.uid, name: data.name }]);
                }
            }
            setShowScanner(false);
        }
    } catch (e) {
        console.error("Invalid QR code", e);
    }
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 4) return;
    setPlayers(players.filter(p => p.id !== id));
  };

  const updatePlayerName = (id: string, newName: string) => {
    let newPlayers = players.map(p => p.id === id ? { ...p, name: newName } : p);
    
    // Auto-add new player slot if the last player has a name now
    if (newPlayers[newPlayers.length - 1].id === id && newName.trim() !== '') {
      newPlayers.push({ id: Math.random().toString(36).slice(2, 9), name: '' });
    }
    
    setPlayers(newPlayers);
  };

  const handleNextStep = () => {
    const validPlayers = players.filter(p => p.name.trim() !== '');
    if (validPlayers.length < 4) {
      setError('Necesitas escribir al menos 4 nombres de jugadores.');
      return;
    }
    if (validPlayers.length > 64) {
      setError('El límite máximo para torneos es de 64 jugadores.');
      return;
    }
    const names = validPlayers.map(p => p.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setError('Los nombres no pueden repetirse. Usa iniciales (ej. Pato A, Pato B).');
      return;
    }
    setError(null);
    setRounds(recommendedRoundsFromTime); // Auto-set recommended rounds
    setCourts(Math.floor(validPlayers.length / 4) >= 1 ? Math.floor(validPlayers.length / 4) : 1);
    setStep(2);
  };

  const handleCreate = async () => {
    // Validate Configuration
    if (!name.trim()) {
      setError('Por favor, escribe un nombre para el torneo.');
      return;
    }
    if (name.trim().length > 60) {
      setError('El nombre del torneo no puede superar los 60 caracteres.');
      return;
    }
    setError(null);
    const validPlayers = players.filter(p => p.name.trim() !== '');
    const safeRounds = Math.min(Math.max(rounds, 1), 50);

    const maxSimultaneousMatches = Math.floor(validPlayers.length / 4);
    const finalCourts = Math.min(courts, maxSimultaneousMatches) || 1;

    const t: Tournament = {
      id: Math.random().toString(36).slice(2, 9),
      name: name.trim().slice(0, 60),
      type: tournamentType,
      pointsPerMatch,
      players: validPlayers.map(p => ({ ...p, name: p.name.trim().slice(0, 32) })),
      matches: [],
      createdAt: Date.now(),
      courtsCount: finalCourts
    };

    try {
      if (tournamentType === 'king') {
        t.matches = generateKingMatches(t, 0);
      } else if (tournamentType === 'mexicano') {
        t.matches = generateMexicanoMatches(t, 0);
      } else {
        t.matches = generateAmericanoMatches(t.players, safeRounds, finalCourts);
      }
    } catch (genErr) {
      const userMsg = getHumanReadableErrorMessage(genErr, 'Error al generar los emparejamientos del torneo.');
      reportError(genErr, { operation: 'generate_initial_matches', tournamentFormat: tournamentType });
      setError(userMsg);
      return;
    }

    // Pre-flight integrity validation
    const integrity = validateTournamentIntegrity(t);
    if (!integrity.isValid) {
      const msg = integrity.errors[0] || 'La configuración del torneo no cumple las normas de integridad.';
      setError(msg);
      reportError(new Error(msg), { operation: 'create_preflight_integrity', extra: { errors: integrity.errors } });
      return;
    }
    
    setIsCreating(true);
    try {
      const success = await addTournament(t);
      if (success) {
        setActiveTournament(t.id);
        onNavigate('tournament');
      } else {
        setError('Error al crear el torneo. Por favor, intenta de nuevo.');
      }
    } catch (err) {
      const userMsg = getHumanReadableErrorMessage(err, 'Error inesperado al crear el torneo.');
      reportError(err, { operation: 'create_tournament_ui', tournamentFormat: tournamentType });
      setError(userMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      onNavigate('home');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white font-sans pb-24">
      <header className="pt-12 pb-4 px-6 bg-zinc-950 flex items-center gap-4">
        <button onClick={handleBack} className="p-2 -ml-2 text-yellow-500 hover:text-yellow-400 transition-colors">
          <ArrowLeft className="w-6 h-6 pointer-events-none" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-full max-w-xl space-y-12">
          {step === 1 ? (
            <section className="pt-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <h2 className="text-sm font-medium text-white mb-4 text-center flex flex-col items-center">
              Añadir al menos 4 jugadores
              <span className="text-xs text-zinc-400 font-normal mt-1">
                 {players.length > 0 ? `${players.filter(p => !!p.name.trim()).length} jugadores ingresados` : ''}
              </span>
            </h2>

            <div className="space-y-0">
              {players.map((p, i) => (
                <div key={p.id} className="flex flex-row items-center -mx-6 px-6 py-2 hover:bg-zinc-900 group border-b border-zinc-800 last:border-0 transition-colors">
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updatePlayerName(p.id, e.target.value)}
                    placeholder="Escribe un nombre de jugador"
                    maxLength={32}
                    className="flex-1 bg-transparent border-0 px-2 py-3 text-white placeholder-zinc-500 focus:outline-none transition-colors font-medium"
                  />
                  <button
                    onClick={() => handleRemovePlayer(p.id)}
                    disabled={players.length <= 4}
                    className="p-3 text-zinc-600 hover:text-red-500 rounded-lg disabled:opacity-0 transition-colors"
                  >
                    <X className="w-5 h-5 pointer-events-none" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
               <button
                onClick={() => setShowScanner(true)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-sm py-3.5 px-4 rounded-xl transition-colors border border-zinc-800 flex items-center justify-center gap-2 uppercase tracking-wide"
               >
                 <QrCode className="w-5 h-5" />
                 Escanear QR
               </button>
               <button
                onClick={handleAddPlayer}
                className="bg-red-600 text-white w-14 rounded-xl shadow-sm flex flex-col items-center justify-center active:scale-95 transition-transform hover:bg-red-500 border border-red-500/50"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <label className="block text-xl font-bold text-white mb-4">El nombre de este torneo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Empiece a escribir.."
                maxLength={60}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-colors"
              />
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-yellow-500/80 uppercase tracking-widest mb-4">Configuración del Torneo</h2>

              <div className="bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-800 flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-800 text-yellow-500 rounded-2xl"><Trophy className="w-5 h-5"/></div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Formato</div>
                    <div className="text-sm font-bold text-white">Modo de Juego</div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={tournamentType} 
                    onChange={e => setTournamentType(e.target.value as any)}
                    className="bg-black border-none font-bold text-sm text-center rounded-2xl py-2.5 px-4 shadow-inner appearance-none min-w-[120px] outline-none text-white text-right"
                  >
                    <option value="americano">Americano (Parejas Rotativas)</option>
                    <option value="mexicano">Mexicano (Ranking Dinámico)</option>
                    <option value="king">Rey Cancha (Ascenso/Descenso)</option>
                  </select>
                </div>
              </div>

              {tournamentType === 'americano' && (
                <p className="text-[11px] text-zinc-500 px-4 animate-in fade-in slide-in-from-top-1">
                  Ideal para grupos donde todos juegan con todos. El sistema rota las parejas automáticamente para minimizar repeticiones.
                </p>
              )}
              {tournamentType === 'mexicano' && (
                <p className="text-[11px] text-zinc-500 px-4 animate-in fade-in slide-in-from-top-1">
                  Emparejamiento por nivel. Los mejores juegan contra los mejores en cada ronda (1&4 vs 2&3).
                </p>
              )}
              {tournamentType === 'king' && (
                <p className="text-[11px] text-zinc-500 px-4 animate-in fade-in slide-in-from-top-1">
                  Formato de canchas. Los ganadores suben a la "Cancha del Rey" y los perdedores bajan.
                </p>
              )}

              <div className="bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-800 text-yellow-500 rounded-2xl"><Map className="w-5 h-5"/></div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Capacidad</div>
                    <div className="text-sm font-bold text-white">Número de Pistas</div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={courts} 
                    onChange={e => setCourts(Number(e.target.value))}
                    className="bg-black border-none font-bold text-lg text-center rounded-2xl py-2 px-3 shadow-inner appearance-none min-w-[70px] outline-none text-white"
                  >
                    {[...Array(10)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-center px-2">
                     <div className="w-2 h-2 border-b-2 border-r-2 border-zinc-500 rotate-45 transform -translate-y-0.5"></div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-800 text-red-500 rounded-2xl"><Target className="w-5 h-5"/></div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Puntuación</div>
                    <div className="text-sm font-bold text-white">Puntos por Partido</div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={pointsPerMatch} 
                    onChange={e => {
                      const newPoints = Number(e.target.value);
                      setPointsPerMatch(newPoints);
                      const newTime = newPoints === 16 ? 15 : newPoints === 24 ? 20 : 25;
                      setRounds(Math.floor((rentDurationHours * 60) / newTime));
                    }}
                    className="bg-black border-none font-bold text-lg text-center rounded-2xl py-2 px-3 shadow-inner appearance-none min-w-[70px] outline-none text-white"
                  >
                    <option value={16}>16</option>
                    <option value={24}>24</option>
                    <option value={32}>32</option>
                  </select>
                  <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-center px-2">
                     <div className="w-2 h-2 border-b-2 border-r-2 border-zinc-500 rotate-45 transform -translate-y-0.5"></div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-800 text-green-500 rounded-2xl"><Clock className="w-5 h-5"/></div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Tiempo</div>
                    <div className="text-sm font-bold text-white">Horas Rentadas</div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={rentDurationHours} 
                    onChange={e => {
                      setRentDurationHours(Number(e.target.value));
                      setRounds(Math.floor((Number(e.target.value) * 60) / timePerMatch));
                    }}
                    className="bg-black border-none font-bold text-lg text-center rounded-2xl py-2 px-3 shadow-inner appearance-none min-w-[70px] outline-none text-white"
                  >
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(h => <option key={h} value={h}>{h} h</option>)}
                  </select>
                  <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-center px-2">
                     <div className="w-2 h-2 border-b-2 border-r-2 border-zinc-500 rotate-45 transform -translate-y-0.5"></div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-800 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-800 text-yellow-500 rounded-2xl"><Hash className="w-5 h-5"/></div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Duración</div>
                    <div className="text-sm font-bold text-white">Número de Rondas</div>
                    <div className="text-[10px] text-zinc-400 mt-1 bg-zinc-950 px-2 py-0.5 rounded-full inline-block">Recomendado: {recommendedRoundsFromTime} para {rentDurationHours}h</div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={rounds} 
                    onChange={e => setRounds(Number(e.target.value))}
                    className="bg-black border-none font-bold text-lg text-center rounded-2xl py-2 px-3 shadow-inner appearance-none min-w-[70px] outline-none text-white"
                  >
                    {[...Array(24)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-center px-2">
                     <div className="w-2 h-2 border-b-2 border-r-2 border-zinc-500 rotate-45 transform -translate-y-0.5"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        </div>
      </main>

      <div className="p-6 bg-zinc-950/80 backdrop-blur-xl pt-4 border-t border-zinc-900 fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center">
        <div className="w-full max-w-xl">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm font-semibold animate-in fade-in">
              {error}
            </div>
          )}
          {step === 1 ? (
             <button
              id="create-step1-next-btn"
              onClick={handleNextStep}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-base py-4 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2 border border-zinc-700 active:scale-[0.98]"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              id="start-tournament-btn"
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-base py-4 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2 border border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creando torneo...</span>
                </>
              ) : (
                <>
                  <span>¡Empezar juego!</span>
                  <Trophy className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showScanner && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black animate-in fade-in duration-200">
           <div className="flex-1 relative">
             <Scanner 
               onScan={handleScan} 
               onError={(err: any) => {
                 console.error("Scanner Error:", err);
                 const errorMsg = err?.message || String(err);
                 if (errorMsg.includes("Requested device not found")) {
                   alert("No se encontró una cámara compatible. Por favor, asegúrate de dar permisos o usa el ingreso manual.");
                 } else {
                   alert("Error al acceder a la cámara. Inténtalo de nuevo.");
                 }
                 setShowScanner(false);
               }}
               components={{ finder: false }} 
             />
             
             {/* Target Overlay */}
             <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                 <div className="w-64 h-64 border-2 border-yellow-500/50 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-500 rounded-tl-xl"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-500 rounded-tr-xl"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-500 rounded-bl-xl"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-500 rounded-br-xl"></div>
                 </div>
                 <p className="text-white mt-8 font-medium tracking-wide">Escanea el QR de un jugador</p>
             </div>

             <button 
               onClick={() => setShowScanner(false)} 
               className="absolute top-12 right-6 p-3 bg-zinc-900/80 rounded-full text-white z-20 backdrop-blur-sm border border-white/10"
             >
                <X className="w-6 h-6" />
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
