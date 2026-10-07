import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../store';
import { Match } from '../domain/tournament';
import { ArrowLeft } from 'lucide-react';

export function TVMode({ tournamentId, onNavigate }: { tournamentId: string, onNavigate?: (route: string) => void }) {
  const { tournaments } = useAppContext();
  const tournament = tournaments.find(t => t.id === tournamentId);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!tournament) {
    return (
      <div className="w-full h-screen bg-black text-white flex items-center justify-center text-4xl">
        Cargando torneo...
      </div>
    );
  }

  // Get active matches
  const rounds = useMemo(() => {
    const r: Record<number, Match[]> = {};
    tournament.matches.forEach(m => {
      if (!m.isPlayoff) {
        if (!r[m.round]) r[m.round] = [];
        r[m.round].push(m);
      }
    });
    return r;
  }, [tournament.matches]);

  const maxRegularRound = useMemo(() => Math.max(0, ...Object.keys(rounds).map(Number)), [rounds]);

  const activeRound = useMemo(() => {
    if (maxRegularRound === 0) return 1;
    let current = 1;
    for (let r = 1; r <= maxRegularRound; r++) {
       const matchesInRound = rounds[r] || [];
       if (matchesInRound.length > 0 && matchesInRound.some(m => m.score1 === null)) {
          return r;
       }
       current = r;
    }
    const playoffMatches = tournament.matches.filter(m => m.isPlayoff);
    if (playoffMatches.length > 0) {
      const playoffHasUnfinished = playoffMatches.some(m => m.score1 === null);
      const semis = playoffMatches.filter(m => m.playoffType === 'semifinal');
      const finalMatch = playoffMatches.find(m => m.playoffType === 'final');
      if (playoffHasUnfinished) {
         if (semis.length > 0 && semis.some(m => m.score1 === null)) return maxRegularRound + 1;
         return maxRegularRound + (semis.length > 0 ? 2 : 1);
      } else {
         if (semis.length > 0 && !finalMatch) {
            return maxRegularRound + 1;
         }
         return maxRegularRound + (semis.length > 0 ? 2 : 1);
      }
    }
    return current;
  }, [rounds, maxRegularRound, tournament.matches]);

  const activeMatches = useMemo(() => {
    const playoffMatches = tournament.matches.filter(m => m.isPlayoff);
    if (activeRound > maxRegularRound && playoffMatches.length > 0) {
       // We are in playoffs
       const quarters = playoffMatches.filter(m => m.playoffType === 'quarterfinal');
       const semis = playoffMatches.filter(m => m.playoffType === 'semifinal');
       const finals = playoffMatches.filter(m => m.playoffType === 'final' || m.playoffType === 'third_place');
       if (quarters.length > 0 && activeRound === maxRegularRound + 1) {
          return quarters;
       }
       if (semis.length > 0 && activeRound === maxRegularRound + (quarters.length > 0 ? 2 : 1)) {
          return semis;
       }
       return finals.length > 0 ? finals : playoffMatches;
    } else {
      return rounds[activeRound] || [];
    }
  }, [activeRound, maxRegularRound, rounds, tournament.matches]);

  const getPlayerName = (id: string) => {
    const p = tournament.players.find(pl => pl.id === id);
    return p ? p.name : 'Desc';
  };

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col font-sans overflow-hidden select-none">
        <header className="px-4 sm:px-12 py-3 sm:py-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0 gap-3 sm:gap-8">
           <div className="flex-1 flex items-center gap-3 sm:gap-8 min-w-0">
              {onNavigate && (
                 <button onClick={() => onNavigate('tournament')} className="p-2 sm:p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all active:scale-90">
                    <ArrowLeft className="w-5 h-5 sm:w-10 sm:h-10" />
                 </button>
              )}
              <img src="/logo.png" alt="Logo" className="h-10 sm:h-24 object-contain brightness-110 hidden sm:block" />
              <div className="min-w-0 flex flex-col">
                  <h1 className="text-xl sm:text-6xl font-black tracking-tight sm:tracking-tighter uppercase text-white truncate leading-tight">
                     {tournament.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 sm:mt-2">
                     <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded text-[8px] sm:text-base font-black uppercase tracking-widest hidden xs:inline-block">
                        LIVE
                     </span>
                     <p className="text-[10px] sm:text-2xl text-zinc-500 font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">
                        {activeRound > maxRegularRound ? 'Fase Final' : 'Fase de Grupos'} • <span className="text-zinc-300">Ronda {activeRound}</span>
                     </p>
                  </div>
              </div>
           </div>
           
           <div className="text-xl sm:text-7xl font-black text-white font-mono tracking-tighter shrink-0 bg-zinc-900 px-4 sm:px-8 py-2 sm:py-4 rounded-xl sm:rounded-3xl border border-zinc-800 shadow-2xl flex flex-col items-center justify-center">
              <span className="leading-none">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
           </div>
        </header>

        <main className="flex-1 p-4 sm:p-10 grid gap-4 sm:gap-8 grid-cols-1 lg:grid-cols-2 overflow-y-auto no-scrollbar">
           {activeMatches.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center text-zinc-500 space-y-4 sm:space-y-6">
                 <p className="text-3xl sm:text-6xl font-bold">Ronda Completada</p>
                 <p className="text-xl sm:text-3xl text-center">Esperando generar siguiente cuadro...</p>
              </div>
           ) : (
              activeMatches.map((match) => (
                 <div key={match.id} className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-[24px] sm:rounded-[60px] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative group hover:border-yellow-500/30 transition-all duration-500">
                    <div className="bg-zinc-950/80 py-3 sm:py-6 text-center border-b border-zinc-800 flex items-center justify-center gap-3">
                       <h2 className="text-lg sm:text-4xl font-black text-zinc-400 tracking-[0.3em] uppercase">Cancha {match.court}</h2>
                       {match.score1 !== null && match.score2 !== null && (
                         <span className="text-xs sm:text-lg font-bold px-2 sm:px-4 py-0.5 sm:py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase tracking-widest">
                           Finalizado
                         </span>
                       )}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-16 gap-6 sm:gap-12">
                       <div className="w-full text-center space-y-1 sm:space-y-4">
                          <p className="text-[20px] sm:text-7xl font-black text-white line-clamp-1 truncate px-4 drop-shadow-lg uppercase">{getPlayerName(match.team1[0])}</p>
                          <p className="text-[20px] sm:text-7xl font-black text-white line-clamp-1 truncate px-4 drop-shadow-lg uppercase">{getPlayerName(match.team1[1])}</p>
                       </div>
                       
                       <div className="flex items-center justify-center w-full gap-4 sm:gap-10">
                          {match.score1 !== null && match.score2 !== null ? (
                             <div className="flex items-center gap-3 sm:gap-8 bg-zinc-950 px-6 sm:px-12 py-2 sm:py-4 rounded-2xl sm:rounded-3xl border border-zinc-800 shadow-xl">
                                <span className={`text-3xl sm:text-7xl font-black font-mono ${match.score1 > match.score2 ? 'text-yellow-400' : 'text-zinc-400'}`}>{match.score1}</span>
                                <span className="text-lg sm:text-4xl text-zinc-600 font-bold">-</span>
                                <span className={`text-3xl sm:text-7xl font-black font-mono ${match.score2 > match.score1 ? 'text-yellow-400' : 'text-zinc-400'}`}>{match.score2}</span>
                             </div>
                          ) : (
                             <>
                                <div className="h-0.5 sm:h-1 flex-1 bg-gradient-to-r from-transparent via-red-600/50 to-red-600"></div>
                                <div className="bg-red-600 text-white text-xl sm:text-5xl font-black italic px-4 sm:px-10 py-1 sm:py-3 rounded-lg sm:rounded-2xl rotate-[-2deg] shadow-[0_0_30px_rgba(220,38,38,0.5)]">VS</div>
                                <div className="h-0.5 sm:h-1 flex-1 bg-gradient-to-l from-transparent via-red-600/50 to-red-600"></div>
                             </>
                          )}
                       </div>

                       <div className="w-full text-center space-y-1 sm:space-y-4">
                          <p className="text-[20px] sm:text-7xl font-black text-white line-clamp-1 truncate px-4 drop-shadow-lg uppercase">{getPlayerName(match.team2[0])}</p>
                          <p className="text-[20px] sm:text-7xl font-black text-white line-clamp-1 truncate px-4 drop-shadow-lg uppercase">{getPlayerName(match.team2[1])}</p>
                       </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"></div>
                 </div>
              ))
           )}
        </main>
    </div>
  );
}
