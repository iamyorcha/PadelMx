import React, { useMemo, useState } from 'react';
import { 
  X, 
  TrendingUp, 
  Users, 
  Target, 
  Shield, 
  Zap, 
  Medal, 
  Trophy, 
  CalendarDays, 
  Swords, 
  Coffee, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  ArrowRightLeft, 
  Clock, 
  Award,
  Sparkles
} from 'lucide-react';
import { useAppContext } from '../store';
import { 
  calculateStandings, 
  isTournamentCompleted, 
  getTournamentPodium, 
  Tournament 
} from '../domain/tournament';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface PlayerProfileModalProps {
  playerName: string;
  playerId?: string;
  currentTournament?: Tournament;
  initialTab?: 'tournament' | 'h2h' | 'career';
  onClose: () => void;
}

export function PlayerProfileModal({ 
  playerName, 
  playerId, 
  currentTournament, 
  initialTab,
  onClose 
}: PlayerProfileModalProps) {
  const { tournaments } = useAppContext();
  const searchName = playerName.trim().toLowerCase();

  const [activeTab, setActiveTab] = useState<'tournament' | 'h2h' | 'career'>(
    initialTab || (currentTournament ? 'tournament' : 'career')
  );

  // Find player in current tournament if provided
  const tournamentPlayer = useMemo(() => {
    if (!currentTournament) return null;
    return (
      currentTournament.players.find(
        p => (playerId && p.id === playerId) || p.name.trim().toLowerCase() === searchName
      ) || null
    );
  }, [currentTournament, playerId, searchName]);

  // Selected rival for Head-to-Head
  const otherPlayers = useMemo(() => {
    if (!currentTournament || !tournamentPlayer) return [];
    return currentTournament.players.filter(p => p.id !== tournamentPlayer.id);
  }, [currentTournament, tournamentPlayer]);

  const [selectedRivalId, setSelectedRivalId] = useState<string>(() => {
    return otherPlayers.length > 0 ? otherPlayers[0].id : '';
  });

  // Calculate stats for the current tournament
  const currentTournamentStats = useMemo(() => {
    if (!currentTournament || !tournamentPlayer) return null;
    const pid = tournamentPlayer.id;
    const standings = calculateStandings(currentTournament);
    const position = standings.findIndex(s => s.id === pid) + 1;
    const myStanding = standings.find(s => s.id === pid);

    const regularMatches = currentTournament.matches.filter(m => !m.isPlayoff);
    const playoffMatches = currentTournament.matches.filter(m => m.isPlayoff);

    const maxRegularRound = regularMatches.length > 0 
      ? Math.max(...regularMatches.map(m => m.round)) 
      : 0;

    interface RoundHistoryItem {
      round: number;
      isPlayoff: boolean;
      playoffType?: string;
      court?: number;
      partnerName?: string;
      partnerId?: string;
      opponentNames?: [string, string];
      opponentIds?: [string, string];
      myScore?: number;
      oppScore?: number;
      status: 'win' | 'loss' | 'draw' | 'pending' | 'rest';
      matchId?: string;
    }

    const roundHistory: RoundHistoryItem[] = [];

    // 1. Regular Rounds
    for (let r = 1; r <= maxRegularRound; r++) {
      const match = regularMatches.find(
        m => m.round === r && (m.team1.includes(pid) || m.team2.includes(pid))
      );

      if (!match) {
        // Player rested in this round
        roundHistory.push({
          round: r,
          isPlayoff: false,
          status: 'rest'
        });
        continue;
      }

      const isTeam1 = match.team1.includes(pid);
      const myTeam = isTeam1 ? match.team1 : match.team2;
      const oppTeam = isTeam1 ? match.team2 : match.team1;

      const partnerId = myTeam.find(id => id !== pid);
      const partner = currentTournament.players.find(p => p.id === partnerId);
      const partnerName = partner ? partner.name : 'Desconocido';

      const opp1 = currentTournament.players.find(p => p.id === oppTeam[0]);
      const opp2 = currentTournament.players.find(p => p.id === oppTeam[1]);
      const opponentNames: [string, string] = [
        opp1 ? opp1.name : 'Rival 1',
        opp2 ? opp2.name : 'Rival 2'
      ];

      const hasScore = match.score1 !== null && match.score2 !== null;
      const myScore = hasScore ? (isTeam1 ? match.score1! : match.score2!) : undefined;
      const oppScore = hasScore ? (isTeam1 ? match.score2! : match.score1!) : undefined;

      let status: 'win' | 'loss' | 'draw' | 'pending' = 'pending';
      if (hasScore && myScore !== undefined && oppScore !== undefined) {
        if (myScore > oppScore) status = 'win';
        else if (myScore < oppScore) status = 'loss';
        else status = 'draw';
      }

      roundHistory.push({
        round: r,
        isPlayoff: false,
        court: match.court,
        partnerName,
        partnerId,
        opponentNames,
        opponentIds: oppTeam,
        myScore,
        oppScore,
        status,
        matchId: match.id
      });
    }

    // 2. Playoff Matches
    const myPlayoffs = playoffMatches.filter(m => m.team1.includes(pid) || m.team2.includes(pid));
    myPlayoffs.forEach(match => {
      const isTeam1 = match.team1.includes(pid);
      const myTeam = isTeam1 ? match.team1 : match.team2;
      const oppTeam = isTeam1 ? match.team2 : match.team1;

      const partnerId = myTeam.find(id => id !== pid);
      const partner = currentTournament.players.find(p => p.id === partnerId);
      const partnerName = partner ? partner.name : 'Desconocido';

      const opp1 = currentTournament.players.find(p => p.id === oppTeam[0]);
      const opp2 = currentTournament.players.find(p => p.id === oppTeam[1]);
      const opponentNames: [string, string] = [
        opp1 ? opp1.name : 'Rival 1',
        opp2 ? opp2.name : 'Rival 2'
      ];

      const hasScore = match.score1 !== null && match.score2 !== null;
      const myScore = hasScore ? (isTeam1 ? match.score1! : match.score2!) : undefined;
      const oppScore = hasScore ? (isTeam1 ? match.score2! : match.score1!) : undefined;

      let status: 'win' | 'loss' | 'draw' | 'pending' = 'pending';
      if (hasScore && myScore !== undefined && oppScore !== undefined) {
        if (myScore > oppScore) status = 'win';
        else if (myScore < oppScore) status = 'loss';
        else status = 'draw';
      }

      roundHistory.push({
        round: match.round,
        isPlayoff: true,
        playoffType: match.playoffType,
        court: match.court,
        partnerName,
        partnerId,
        opponentNames,
        opponentIds: oppTeam,
        myScore,
        oppScore,
        status,
        matchId: match.id
      });
    });

    // Tournament partners breakdown
    const tournamentPartnersMap: Record<string, { name: string; played: number; wins: number; ptsWon: number; ptsLost: number }> = {};
    roundHistory.forEach(item => {
      if (item.partnerId && item.partnerName && item.status !== 'rest' && item.status !== 'pending') {
        if (!tournamentPartnersMap[item.partnerId]) {
          tournamentPartnersMap[item.partnerId] = {
            name: item.partnerName,
            played: 0,
            wins: 0,
            ptsWon: 0,
            ptsLost: 0
          };
        }
        tournamentPartnersMap[item.partnerId].played++;
        if (item.status === 'win') tournamentPartnersMap[item.partnerId].wins++;
        if (item.myScore !== undefined) tournamentPartnersMap[item.partnerId].ptsWon += item.myScore;
        if (item.oppScore !== undefined) tournamentPartnersMap[item.partnerId].ptsLost += item.oppScore;
      }
    });

    const bestTournamentPartner = Object.values(tournamentPartnersMap).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.ptsWon - b.ptsLost) - (a.ptsWon - a.ptsLost);
    })[0] || null;

    const completedMatchesCount = roundHistory.filter(h => h.status === 'win' || h.status === 'loss' || h.status === 'draw').length;
    const winsCount = roundHistory.filter(h => h.status === 'win').length;
    const lossesCount = roundHistory.filter(h => h.status === 'loss').length;
    const drawsCount = roundHistory.filter(h => h.status === 'draw').length;
    const restsCount = roundHistory.filter(h => h.status === 'rest').length;
    const winRate = completedMatchesCount > 0 ? (winsCount / completedMatchesCount) * 100 : 0;

    return {
      position,
      standing: myStanding,
      completedMatchesCount,
      winsCount,
      lossesCount,
      drawsCount,
      restsCount,
      winRate,
      roundHistory,
      bestTournamentPartner,
      tournamentPartners: Object.values(tournamentPartnersMap)
    };
  }, [currentTournament, tournamentPlayer]);

  // Head-to-Head calculation
  const h2hStats = useMemo(() => {
    if (!currentTournament || !tournamentPlayer || !selectedRivalId) return null;
    const myId = tournamentPlayer.id;
    const rival = currentTournament.players.find(p => p.id === selectedRivalId);
    if (!rival) return null;

    let asPartnersPlayed = 0;
    let asPartnersWins = 0;
    let asPartnersLosses = 0;
    let asPartnersPtsFor = 0;
    let asPartnersPtsAgainst = 0;

    let asOpponentsPlayed = 0;
    let myWinsAgainst = 0;
    let rivalWinsAgainst = 0;
    let drawsAgainst = 0;
    let myPtsAgainst = 0;
    let rivalPtsAgainst = 0;

    const directMatches: {
      round: number;
      isPlayoff?: boolean;
      type: 'partner' | 'rival';
      myScore: number;
      oppScore: number;
      result: string;
      court?: number;
    }[] = [];

    currentTournament.matches.forEach(m => {
      if (m.score1 === null || m.score2 === null) return;
      const myInT1 = m.team1.includes(myId);
      const myInT2 = m.team2.includes(myId);
      const rivalInT1 = m.team1.includes(selectedRivalId);
      const rivalInT2 = m.team2.includes(selectedRivalId);

      if ((myInT1 || myInT2) && (rivalInT1 || rivalInT2)) {
        // Same team: partners
        if ((myInT1 && rivalInT1) || (myInT2 && rivalInT2)) {
          asPartnersPlayed++;
          const myScore = myInT1 ? m.score1 : m.score2;
          const oppScore = myInT1 ? m.score2 : m.score1;
          asPartnersPtsFor += myScore;
          asPartnersPtsAgainst += oppScore;
          if (myScore > oppScore) asPartnersWins++;
          else if (myScore < oppScore) asPartnersLosses++;

          directMatches.push({
            round: m.round,
            isPlayoff: m.isPlayoff,
            court: m.court,
            type: 'partner',
            myScore,
            oppScore,
            result: myScore > oppScore ? 'Victoria Juntos' : myScore < oppScore ? 'Derrota Juntos' : 'Empate'
          });
        } else {
          // Opposite teams: rivals
          asOpponentsPlayed++;
          const myScore = myInT1 ? m.score1 : m.score2;
          const rivalScore = myInT1 ? m.score2 : m.score1;
          myPtsAgainst += myScore;
          rivalPtsAgainst += rivalScore;

          if (myScore > rivalScore) myWinsAgainst++;
          else if (rivalScore > myScore) rivalWinsAgainst++;
          else drawsAgainst++;

          directMatches.push({
            round: m.round,
            isPlayoff: m.isPlayoff,
            court: m.court,
            type: 'rival',
            myScore,
            oppScore: rivalScore,
            result: myScore > rivalScore ? `Ganó ${tournamentPlayer.name}` : rivalScore > myScore ? `Ganó ${rival.name}` : 'Empate'
          });
        }
      }
    });

    return {
      rivalName: rival.name,
      asPartnersPlayed,
      asPartnersWins,
      asPartnersLosses,
      asPartnersPtsFor,
      asPartnersPtsAgainst,
      asOpponentsPlayed,
      myWinsAgainst,
      rivalWinsAgainst,
      drawsAgainst,
      myPtsAgainst,
      rivalPtsAgainst,
      directMatches
    };
  }, [currentTournament, tournamentPlayer, selectedRivalId]);

  // Global / Career Stats
  const stats = useMemo(() => {
    let matchesPlayed = 0;
    let matchesWon = 0;
    let totalPointsWon = 0;
    let totalPointsLost = 0;

    const partners: Record<string, { name: string; wins: number; total: number }> = {};
    const tHistory: { tournamentName: string; date: Date | null; position: number; isWinner: boolean; points: number }[] = [];
    
    let currentStreakCount = 0;
    let isActiveStreak = true;
    
    tournaments.forEach(t => {
      const ts = calculateStandings(t);
      const isTourneyCompleted = isTournamentCompleted(t);
      const podium = isTourneyCompleted ? getTournamentPodium(t) : null;
      const tDate = t.createdAt?.toMillis ? new Date(t.createdAt.toMillis()) : t.createdAt ? new Date(t.createdAt) : null;
      
      const playerIndex = ts.findIndex(p => p.name.trim().toLowerCase() === searchName);
      if (playerIndex !== -1) {
        const pStat = ts[playerIndex];
        if (pStat.matchesPlayed > 0) {
          const isWinner = podium ? podium.gold.includes(pStat.id) : false;
          let finalPos = playerIndex + 1;
          if (podium) {
            if (podium.gold.includes(pStat.id)) finalPos = 1;
            else if (podium.silver.includes(pStat.id)) finalPos = 2;
            else if (podium.bronze.includes(pStat.id)) finalPos = 3;
          }

          tHistory.push({
            tournamentName: t.name,
            date: tDate,
            position: finalPos,
            isWinner,
            points: pStat.pointsWon
          });
        }
      }
    });

    tHistory.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });

    const allPlayerMatches = tournaments.flatMap(t => {
      const playerInTournament = t.players.find(p => p.name.trim().toLowerCase() === searchName);
      if (!playerInTournament) return [];
      const pid = playerInTournament.id;
      
      return t.matches
        .filter(m => (m.team1.includes(pid) || m.team2.includes(pid)) && m.score1 !== null && m.score2 !== null)
        .map(m => ({
          ...m,
          playerIdInThisTournament: pid,
          tournamentDate: t.createdAt,
          tournamentPlayers: t.players
        }));
    }).sort((a, b) => {
      const aDate = a.tournamentDate?.toMillis ? a.tournamentDate.toMillis() : (a.tournamentDate ? new Date(a.tournamentDate).getTime() : 0);
      const bDate = b.tournamentDate?.toMillis ? b.tournamentDate.toMillis() : (b.tournamentDate ? new Date(b.tournamentDate).getTime() : 0);
      if (aDate !== bDate) return bDate - aDate;
      return b.round - a.round;
    });

    for (const m of allPlayerMatches) {
      matchesPlayed++;
      const pid = m.playerIdInThisTournament;
      const isTeam1 = m.team1.includes(pid);
      const isWin = isTeam1 ? m.score1! > m.score2! : m.score2! > m.score1!;
      const ptsWon = isTeam1 ? m.score1! : m.score2!;
      const ptsLost = isTeam1 ? m.score2! : m.score1!;
      
      totalPointsWon += ptsWon;
      totalPointsLost += ptsLost;

      if (isWin) matchesWon++;

      if (isActiveStreak) {
        if (isWin) currentStreakCount++;
        else isActiveStreak = false;
      }

      const partnerId = isTeam1 ? m.team1.find(p => p !== pid) : m.team2.find(p => p !== pid);
      if (partnerId) {
        const partnerNameFull = m.tournamentPlayers.find(p => p.id === partnerId)?.name || 'Desconocido';
        const partnerKey = partnerNameFull.trim().toLowerCase();
        if (!partners[partnerKey]) partners[partnerKey] = { name: partnerNameFull, wins: 0, total: 0 };
        partners[partnerKey].total++;
        if (isWin) partners[partnerKey].wins++;
      }
    }
    
    const bestPartners = Object.values(partners)
      .filter(p => p.total > 0)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.wins / b.total) - (a.wins / a.total);
      });

    return {
      matchesPlayed,
      matchesWon,
      matchesLost: matchesPlayed - matchesWon,
      winRate: matchesPlayed > 0 ? (matchesWon / matchesPlayed) * 100 : 0,
      totalPointsWon,
      bestPartner: bestPartners.length > 0 ? bestPartners[0] : null,
      currentStreakCount,
      history: tHistory
    };
  }, [tournaments, searchName]);

  const pieData = [
    { name: 'Victorias', value: stats.matchesWon, color: '#10B981' },
    { name: 'Derrotas', value: stats.matchesLost, color: '#EF4444' }
  ];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative">
        
        {/* Header */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 relative z-10 px-5 py-4 flex justify-between items-center">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 uppercase tracking-wider truncate">
              {playerName}
            </h3>
            {currentTournamentStats && (
              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                <span className="font-bold text-yellow-500">#{currentTournamentStats.position} en el torneo</span>
                <span>•</span>
                <span>{currentTournamentStats.standing?.pointsWon ?? 0} pts</span>
                <span>•</span>
                <span className={
                  (currentTournamentStats.standing?.pointsDifference ?? 0) > 0 
                    ? 'text-emerald-400 font-bold' 
                    : (currentTournamentStats.standing?.pointsDifference ?? 0) < 0 
                    ? 'text-rose-400 font-bold' 
                    : 'text-zinc-500'
                }>
                  {(currentTournamentStats.standing?.pointsDifference ?? 0) > 0 ? '+' : ''}
                  {currentTournamentStats.standing?.pointsDifference ?? 0} dif
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (only when inside a tournament) */}
        {currentTournament && (
          <div className="bg-zinc-900/50 border-b border-zinc-800/80 px-4 py-2 flex gap-2">
            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'tournament'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>En este Torneo</span>
            </button>
            <button
              onClick={() => setActiveTab('h2h')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'h2h'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Cara a Cara</span>
            </button>
            <button
              onClick={() => setActiveTab('career')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'career'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Carrera Global</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto bg-gradient-to-b from-zinc-900/40 to-zinc-950 pb-10">
          
          {/* TAB 1: EN ESTE TORNEO */}
          {activeTab === 'tournament' && currentTournamentStats && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Quick KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Posición</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-black text-yellow-500">#{currentTournamentStats.position}</span>
                    {currentTournamentStats.position === 1 && <Trophy className="w-4 h-4 text-yellow-500" />}
                  </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Récord</span>
                  <div className="text-lg font-black text-white">
                    <span className="text-emerald-400">{currentTournamentStats.winsCount}V</span>{' '}
                    <span className="text-zinc-600">-</span>{' '}
                    <span className="text-rose-400">{currentTournamentStats.lossesCount}D</span>
                  </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Puntos</span>
                  <div className="text-lg font-black text-white">
                    {currentTournamentStats.standing?.pointsWon ?? 0}
                    <span className="text-xs ml-1 font-semibold text-zinc-500">
                      ({(currentTournamentStats.standing?.pointsDifference ?? 0) >= 0 ? '+' : ''}
                      {currentTournamentStats.standing?.pointsDifference ?? 0})
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Efectividad</span>
                  <div className="text-2xl font-black text-emerald-400">
                    {currentTournamentStats.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Best Partner in this Tournament */}
              {currentTournamentStats.bestTournamentPartner && (
                <div className="bg-gradient-to-r from-yellow-500/10 via-zinc-900/70 to-zinc-900 border border-yellow-500/20 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-black text-sm flex items-center justify-center">
                      {currentTournamentStats.bestTournamentPartner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 block">Mejor Pareja del Torneo</span>
                      <span className="text-sm font-bold text-white">{currentTournamentStats.bestTournamentPartner.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-400 block">
                      {currentTournamentStats.bestTournamentPartner.wins} victorias
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      +{currentTournamentStats.bestTournamentPartner.ptsWon - currentTournamentStats.bestTournamentPartner.ptsLost} dif
                    </span>
                  </div>
                </div>
              )}

              {/* Round-by-Round History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-yellow-500" />
                    Historial Partido a Partido
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-bold">
                    {currentTournamentStats.completedMatchesCount} jugados
                    {currentTournamentStats.restsCount > 0 && ` • ${currentTournamentStats.restsCount} descansos`}
                  </span>
                </div>

                <div className="space-y-2">
                  {currentTournamentStats.roundHistory.map((item, idx) => {
                    if (item.status === 'rest') {
                      return (
                        <div 
                          key={idx}
                          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3.5 flex items-center justify-between opacity-80"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <Coffee className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-zinc-300">Ronda {item.round}</span>
                              <span className="text-[10px] text-zinc-500 block">Sin partido programado en esta ronda</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                            Descanso
                          </span>
                        </div>
                      );
                    }

                    const isWin = item.status === 'win';
                    const isLoss = item.status === 'loss';
                    const isDraw = item.status === 'draw';
                    const isPending = item.status === 'pending';

                    return (
                      <div
                        key={idx}
                        className={`border rounded-2xl p-3.5 transition-all ${
                          item.isPlayoff 
                            ? 'bg-gradient-to-r from-yellow-500/10 via-zinc-900/90 to-zinc-900 border-yellow-500/30' 
                            : isWin 
                            ? 'bg-zinc-900/80 border-zinc-800 hover:border-emerald-500/30' 
                            : isLoss 
                            ? 'bg-zinc-900/80 border-zinc-800 hover:border-rose-500/30' 
                            : 'bg-zinc-900/80 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {item.isPlayoff ? (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                                <Swords className="w-3 h-3" />
                                {item.playoffType === 'final' ? 'Gran Final' : item.playoffType === 'third_place' ? '3er Puesto' : item.playoffType === 'semifinal' ? 'Semifinal' : 'Cuartos'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                Ronda {item.round}
                              </span>
                            )}
                            {item.court && (
                              <span className="text-[10px] text-zinc-500 font-semibold">
                                • Pista {item.court}
                              </span>
                            )}
                          </div>

                          <div>
                            {isWin && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Victoria
                              </span>
                            )}
                            {isLoss && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Derrota
                              </span>
                            )}
                            {isDraw && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                                <MinusCircle className="w-3 h-3" /> Empate
                              </span>
                            )}
                            {isPending && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pendiente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Match Details */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex-1 min-w-0 pr-2 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase">Pareja:</span>
                              <span className="font-bold text-white truncate">{item.partnerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase">vs:</span>
                              <span className="text-zinc-400 truncate">
                                {item.opponentNames ? item.opponentNames.join(' & ') : 'Rivales'}
                              </span>
                            </div>
                          </div>

                          {/* Score box */}
                          <div className="text-right shrink-0 bg-black/40 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
                            {isPending ? (
                              <span className="text-xs font-mono font-bold text-zinc-500">- vs -</span>
                            ) : (
                              <div className="flex items-center gap-1 font-mono font-black text-sm">
                                <span className={isWin ? 'text-emerald-400 font-black' : 'text-white'}>
                                  {item.myScore}
                                </span>
                                <span className="text-zinc-600">-</span>
                                <span className={isLoss ? 'text-rose-400 font-black' : 'text-zinc-400'}>
                                  {item.oppScore}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CARA A CARA (HEAD-TO-HEAD) */}
          {activeTab === 'h2h' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  Seleccionar Rival para Comparar
                </label>
                <select
                  value={selectedRivalId}
                  onChange={(e) => setSelectedRivalId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-yellow-500"
                >
                  {otherPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {h2hStats ? (
                <div className="space-y-4">
                  {/* Duel Header */}
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between text-center">
                    <div className="flex-1">
                      <span className="text-xs font-bold text-yellow-400 block truncate">{playerName}</span>
                      <span className="text-2xl font-black text-white">{h2hStats.myWinsAgainst}</span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mt-0.5">Victorias directas</span>
                    </div>
                    <div className="px-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
                        <Swords className="w-4 h-4 text-yellow-500" />
                      </div>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1 block">VS</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-zinc-300 block truncate">{h2hStats.rivalName}</span>
                      <span className="text-2xl font-black text-white">{h2hStats.rivalWinsAgainst}</span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mt-0.5">Victorias directas</span>
                    </div>
                  </div>

                  {/* Summary as Rivals vs Partners */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Como Rivales
                      </span>
                      <div className="text-sm font-bold text-white">
                        {h2hStats.asOpponentsPlayed} partidos
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Puntos: {h2hStats.myPtsAgainst} - {h2hStats.rivalPtsAgainst}
                      </span>
                    </div>

                    <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-2xl">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Como Compañeros
                      </span>
                      <div className="text-sm font-bold text-white">
                        {h2hStats.asPartnersPlayed} partidos ({h2hStats.asPartnersWins}V - {h2hStats.asPartnersLosses}D)
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Pts juntos: +{h2hStats.asPartnersPtsFor - h2hStats.asPartnersPtsAgainst} dif
                      </span>
                    </div>
                  </div>

                  {/* Direct Matches List */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Historial de Cruces Directos
                    </h5>
                    {h2hStats.directMatches.length > 0 ? (
                      h2hStats.directMatches.map((dm, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 block">
                              {dm.isPlayoff ? 'Playoffs' : `Ronda ${dm.round}`} • {dm.type === 'partner' ? 'Compañeros' : 'Rivales directos'}
                            </span>
                            <span className="font-bold text-white">{dm.result}</span>
                          </div>
                          <div className="font-mono font-black text-sm bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg text-white">
                            {dm.myScore} - {dm.oppScore}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic text-center py-4">
                        Aún no se han cruzado en la pista en este torneo.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-4">Selecciona un rival para comparar.</p>
              )}
            </div>
          )}

          {/* TAB 3: CARRERA GLOBAL / HISTORIAL */}
          {activeTab === 'career' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* General Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="text-zinc-500 text-[10px] font-bold mb-1 uppercase tracking-widest flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-400"/> Win Rate Global
                  </div>
                  <div className="text-3xl font-black text-white">{stats.winRate.toFixed(0)}%</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="text-zinc-500 text-[10px] font-bold mb-1 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-yellow-500"/> Racha Actual
                  </div>
                  <div className="text-3xl font-black text-white">
                    {stats.currentStreakCount} <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Vic.</span>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-[24px] flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-50"></div>
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest self-start mb-4">
                  Partidos Totales: <span className="text-white text-xs">{stats.matchesPlayed}</span>
                </h3>
                {stats.matchesPlayed > 0 ? (
                  <div className="w-full h-44 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: 'bold', border: '1px solid #3f3f46' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number) => [`${value} partidos`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-black text-emerald-400 leading-none">{stats.matchesWon}</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Gana</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center w-full">
                    <p className="text-zinc-600 text-sm font-medium">Sin datos suficientes</p>
                  </div>
                )}
                <div className="flex justify-center gap-6 mt-4 w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Victorias ({stats.matchesWon})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Derrotas ({stats.matchesLost})</span>
                  </div>
                </div>
              </div>

              {/* Best Partner All-Time */}
              <div className="bg-gradient-to-br from-indigo-900/40 via-zinc-950 to-zinc-950 border border-indigo-500/20 p-5 rounded-[24px] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Users className="w-16 h-16 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Compañero Ideal Histórico</h3>
                </div>
                
                {stats.bestPartner ? (
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black text-xl shadow-inner shrink-0">
                      {stats.bestPartner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white leading-tight">{stats.bestPartner.name}</p>
                      <p className="text-xs text-indigo-300/70 font-medium mt-0.5">
                        {stats.bestPartner.wins} victorias juntos <span className="text-zinc-600">({stats.bestPartner.total} p.)</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 font-medium relative z-10">Juega más partidos para descubrirlo.</p>
                )}
              </div>
              
              {/* Tournament History */}
              {stats.history.length > 0 && (
                <div>
                  <h4 className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mb-3 ml-1 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Historial de Torneos
                  </h4>
                  <div className="space-y-2.5">
                    {stats.history.map((h, idx) => (
                      <div key={idx} className="bg-zinc-950/50 border border-zinc-800/80 p-4 rounded-[20px] flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white text-sm mb-1">{h.tournamentName}</p>
                          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                            {h.date ? h.date.toLocaleDateString() : 'Desconocido'}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          {h.isWinner ? (
                            <span className="bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                              <Trophy className="w-3 h-3" /> Campeón
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs font-bold bg-zinc-800/50 px-3 py-1 rounded-xl">
                              #{h.position}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-500/80 mt-1.5">{h.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
