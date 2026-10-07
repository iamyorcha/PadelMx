import React, { useMemo, useState } from 'react';
import { ArrowLeft, Trophy, Medal, X, CalendarDays, TrendingUp, Swords, ExternalLink } from 'lucide-react';
import { useAppContext } from '../store';
import { calculateStandings, isTournamentCompleted, getTournamentPodium, Tournament } from '../domain/tournament';
import { PlayerProfileModal } from './PlayerProfileModal';

export function GlobalRankings({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { tournaments } = useAppContext();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { globalStats, playerHistories, recentMatches } = useMemo(() => {
    const stats: Record<string, { 
      name: string, 
      matchesPlayed: number, 
      pointsWon: number, 
      wins: number,
      tournamentsParticipated: number,
      tournamentsWon: number,
      gold: number,
      silver: number,
      bronze: number,
      streak: number
    }> = {};

    const histories: Record<string, {
      tournamentName: string;
      date: Date | null;
      position: number;
      isWinner: boolean;
      points: number;
    }[]> = {};

    const matchesList: Record<string, { won: boolean; date: Date | null; }[]> = {};

    // Sort tournaments by creation date oldest to newest to calculate streak correctly
    const sortedTournaments = [...tournaments].sort((a, b) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return da - db;
    });

    sortedTournaments.forEach(t => {
      const ts = calculateStandings(t);
      const isTourneyCompleted = isTournamentCompleted(t);
      const podium = isTourneyCompleted ? getTournamentPodium(t) : null;
      const tDate = t.createdAt?.toMillis ? new Date(t.createdAt.toMillis()) : t.createdAt ? new Date(t.createdAt) : null;
      
      ts.forEach((player, index) => {
        const key = player.name.trim().toLowerCase();
        if (!key) return;
        
        if (!stats[key]) {
          stats[key] = { name: player.name, matchesPlayed: 0, pointsWon: 0, wins: 0, tournamentsParticipated: 0, tournamentsWon: 0, gold: 0, silver: 0, bronze: 0, streak: 0 };
          histories[key] = [];
          matchesList[key] = [];
        }
        
        stats[key].matchesPlayed += player.matchesPlayed;
        stats[key].pointsWon += player.pointsWon;
        stats[key].wins += player.wins;
        stats[key].tournamentsParticipated += 1;
        
        let isWinner = false;
        let finalPos = index + 1;

        if (podium && player.matchesPlayed > 0) {
           if (podium.gold.includes(player.id)) {
              isWinner = true;
              finalPos = 1;
              stats[key].tournamentsWon += 1;
              stats[key].gold += 1;
           } else if (podium.silver.includes(player.id)) {
              finalPos = 2;
              stats[key].silver += 1;
           } else if (podium.bronze.includes(player.id)) {
              finalPos = 3;
              stats[key].bronze += 1;
           }
        }

        histories[key].push({
           tournamentName: t.name,
           date: tDate,
           position: finalPos,
           isWinner,
           points: player.pointsWon
        });
      });

      // Gather matches for streak
      t.matches.forEach(m => {
          if (m.score1 !== null && m.score2 !== null) {
              const team1Won = m.score1 > m.score2;
              m.team1.forEach(pId => {
                  const pName = t.players.find(p => p.id === pId)?.name.trim().toLowerCase();
                  if (pName && matchesList[pName]) matchesList[pName].push({ won: team1Won, date: tDate });
              });
              m.team2.forEach(pId => {
                  const pName = t.players.find(p => p.id === pId)?.name.trim().toLowerCase();
                  if (pName && matchesList[pName]) matchesList[pName].push({ won: !team1Won, date: tDate });
              });
          }
      });
    });

    Object.keys(matchesList).forEach(key => {
       const ms = matchesList[key];
       let streak = 0;
       for (let i = ms.length - 1; i >= 0; i--) {
           if (ms[i].won) streak++;
           else break;
       }
       if (stats[key]) stats[key].streak = streak;
    });

    return { 
      globalStats: Object.values(stats).sort((a, b) => {
        if (b.pointsWon !== a.pointsWon) return b.pointsWon - a.pointsWon;
        return b.matchesPlayed - a.matchesPlayed;
      }),
      playerHistories: histories,
      recentMatches: matchesList
    };
  }, [tournaments]);

  const selectedStats = selectedPlayer ? globalStats.find(s => s.name.toLowerCase() === selectedPlayer.toLowerCase()) : null;
  const history = selectedPlayer ? playerHistories[selectedPlayer.toLowerCase()] || [] : [];
  
  // Sort history newest first
  history.sort((a, b) => {
     if (!a.date) return 1;
     if (!b.date) return -1;
     return b.date.getTime() - a.date.getTime();
  });

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 text-white font-sans pb-10 relative">
      <header className="px-6 pt-12 pb-6 flex items-center gap-4 bg-zinc-950 z-10 border-b border-zinc-900">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-yellow-500 hover:text-yellow-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Ranking Global</h1>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-6 pb-24 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          {globalStats.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <Trophy className="w-16 h-16 text-zinc-800 mb-4" />
                <h3 className="text-xl font-bold text-zinc-400 mb-2">Aún no hay clasificaciones</h3>
                <p className="text-sm text-zinc-600 max-w-xs">Termina torneos para ver el desempeño global de los jugadores aquí.</p>
             </div>
          ) : (
            <div className="bg-zinc-900 rounded-[32px] shadow-sm border border-zinc-800 mb-12">
            <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-black/50 text-zinc-500 text-xs font-semibold uppercase tracking-wider border-b border-zinc-800">
                  <th className="p-5 w-12 text-center border-r border-zinc-800/50">#</th>
                  <th className="p-5">Jugador</th>
                  <th className="p-5 text-right w-24">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {globalStats.map((stat, i) => (
                  <tr 
                    key={stat.name} 
                    onClick={() => setSelectedPlayer(stat.name)}
                    className={`cursor-pointer transition-colors ${i < 3 ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-zinc-800/50"}`}
                  >
                     <td className="p-5 text-center border-r border-zinc-800/50">
                      {i === 0 ? <Trophy className="w-5 h-5 text-[#FACC15] mx-auto" /> : 
                       i === 1 ? <Medal className="w-5 h-5 text-zinc-300 mx-auto" /> :
                       i === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> :
                       <span className="text-sm font-bold text-zinc-500">{i+1}</span>}
                    </td>
                    <td className="p-5 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{stat.name}</span>
                        {stat.streak >= 3 && (
                          <span className="flex items-center text-xs font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-md" title={`Racha de ${stat.streak} victorias`}>
                            🔥 {stat.streak}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-2">
                        <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {stat.matchesPlayed} PJ</span>
                        <span className="text-zinc-700">•</span>
                        <span className="flex items-center gap-1 font-medium text-emerald-400">
                          <TrendingUp className="w-3 h-3" /> {stat.matchesPlayed > 0 ? Math.round((stat.wins/stat.matchesPlayed)*100) : 0}% Win Rate
                        </span>
                        
                        {(stat.gold > 0 || stat.silver > 0 || stat.bronze > 0) && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <div className="flex gap-1.5 items-center bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
                              {stat.gold > 0 && <span className="flex items-center gap-0.5 font-bold text-[#FACC15]">🥇{stat.gold}</span>}
                              {stat.silver > 0 && <span className="flex items-center gap-0.5 font-bold text-zinc-300">🥈{stat.silver}</span>}
                              {stat.bronze > 0 && <span className="flex items-center gap-0.5 font-bold text-amber-600">🥉{stat.bronze}</span>}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-right font-bold text-white text-base">
                      {stat.pointsWon}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Player Profile Modal */}
      {selectedPlayer && (
        <PlayerProfileModal 
           playerName={selectedPlayer}
           onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}


