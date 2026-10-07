import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, Trophy, CalendarDays, Swords, CheckCircle2, Share2, Download, Link2, Monitor, QrCode, Camera, Upload, Loader2, Image as ImageIcon, Receipt, X, Sparkles, ChevronRight, Info } from 'lucide-react';
import { useAppContext } from '../store';
import {
  calculateStandings,
  Match,
  Player,
  Tournament,
  Expense,
  generateKingMatches,
  generateMexicanoMatches,
  isTournamentCompleted,
  getTournamentPodium,
  generatePlayoffMatches,
  generateSemisFromQuarters,
  generateFinalsFromSemis,
  generateAdditionalAmericanoRounds,
  canAddRegularRounds,
  getTournamentState,
  PlayoffFormat
} from '../domain/tournament';
import * as htmlToImage from 'html-to-image';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';
import QRCode from 'react-qr-code';
import { PlayerProfileModal } from './PlayerProfileModal';
import { PlayoffConfigModal } from './PlayoffConfigModal';
import { AddRoundsModal } from './AddRoundsModal';
import { SplitBillModal } from './SplitBillModal';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';

export function TournamentDashboard({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { tournaments, activeTournamentId, updateTournament, isOnline } = useAppContext();
  const tournament = tournaments.find(t => t.id === activeTournamentId);

  if (!tournament) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium animate-pulse">Cargando torneo...</p>
        <button 
          onClick={() => onNavigate('home')} 
          className="mt-8 text-sm font-bold text-zinc-500 hover:text-white transition-colors"
        >
          Si tarda mucho, pulsa aquí para volver
        </button>
      </div>
    );
  }

  return <TournamentDashboardImpl tournament={tournament} onNavigate={onNavigate} />;
}

function TournamentDashboardImpl({ tournament, onNavigate }: { tournament: Tournament, onNavigate: (route: string) => void }) {
  const { updateTournament, isViewer, isOnline } = useAppContext();
  const [activeTab, setActiveTab] = useState<'matches' | 'standings' | 'photos'>('matches');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [displayRound, setDisplayRound] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlayoffConfigModal, setShowPlayoffConfigModal] = useState(false);
  const [showAddRoundsModal, setShowAddRoundsModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [initialProfileTab, setInitialProfileTab] = useState<'tournament' | 'h2h' | 'career' | undefined>(undefined);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isGeneratingRound, setIsGeneratingRound] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = isViewer || !auth.currentUser || (Boolean(tournament.ownerId) && auth.currentUser.uid !== tournament.ownerId);

  const handleSavePayments = (totalCost: number, payments: Record<string, boolean>, expenses: Expense[]) => {
    updateTournament({ id: tournament.id, totalCost, payments, expenses });
    setShowSplitBillModal(false);
  };

  const standings = useMemo(() => calculateStandings(tournament), [tournament]);
  const isCompleted = useMemo(() => isTournamentCompleted(tournament), [tournament]);
  const tournamentPodium = useMemo(() => getTournamentPodium(tournament), [tournament]);
  const tournamentState = useMemo(() => getTournamentState(tournament), [tournament]);
  const canAddRoundsResult = useMemo(() => canAddRegularRounds(tournament), [tournament]);

  const badges = useMemo(() => {
    const b: Record<string, string[]> = {};
    if (tournament.status !== 'completed' && standings.length > 0 && 
        !tournament.matches.some(m => m.isPlayoff && m.playoffType === 'final' && m.score1 !== null)) {
      // Return empty if not mostly done, but we can also just compute it if we have standings
    }
    
    const playerPointsLost: Record<string, number> = {};
    const playerPointsTotal: Record<string, number> = {};
    const playerUniquePartners: Record<string, Set<string>> = {};
    
    tournament.players.forEach(p => {
        playerPointsLost[p.id] = 0;
        playerPointsTotal[p.id] = 0;
        playerUniquePartners[p.id] = new Set();
        b[p.id] = [];
    });
    
    tournament.matches.forEach(m => {
       if (m.score1 !== null && m.score2 !== null) {
           const team1Won = m.score1 > m.score2;
           m.team1.forEach(pid => {
               if (playerPointsLost[pid] !== undefined) {
                  playerPointsLost[pid] += m.score2!;
                  playerPointsTotal[pid] += (m.score1! + m.score2!);
                  if (team1Won) playerUniquePartners[pid].add(m.team1.find(x => x!==pid) || '');
               }
           });
           m.team2.forEach(pid => {
               if (playerPointsLost[pid] !== undefined) {
                  playerPointsLost[pid] += m.score1!;
                  playerPointsTotal[pid] += (m.score1! + m.score2!);
                  if (!team1Won) playerUniquePartners[pid].add(m.team2.find(x => x!==pid) || '');
               }
           });
       }
    });

    const activePlayers = tournament.players.filter(p => playerPointsTotal[p.id] > 0);
    if (activePlayers.length > 0) {
        const muro = [...activePlayers].sort((a,b) => playerPointsLost[a.id] - playerPointsLost[b.id])[0];
        const maquina = [...activePlayers].sort((a,b) => playerPointsTotal[b.id] - playerPointsTotal[a.id])[0];
        const mvp = [...activePlayers].sort((a,b) => playerUniquePartners[b.id].size - playerUniquePartners[a.id].size)[0];
        
        if (muro) b[muro.id].push('🛡️ El Muro');
        if (maquina) b[maquina.id].push('⚡ La Máquina');
        if (mvp) b[mvp.id].push('🌟 El MVP');
    }
    
    return b;
  }, [tournament, standings]);


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
    // If all regular matches are completed, we should stay on maxRegularRound
    // or go to playoff rounds ONLY IF playoffs are generated.
    const playoffMatches = tournament.matches.filter(m => m.isPlayoff);
    if (playoffMatches.length > 0) {
      const quarters = playoffMatches.filter(m => m.playoffType === 'quarterfinal');
      const semis = playoffMatches.filter(m => m.playoffType === 'semifinal');
      const finals = playoffMatches.filter(m => m.playoffType === 'final');
      
      const hasQuarters = quarters.length > 0;
      const hasSemis = semis.length > 0;

      if (hasQuarters && quarters.some(m => m.score1 === null)) return maxRegularRound + 1;
      
      const semiRoundOffset = hasQuarters ? 2 : 1;
      if (hasSemis && semis.some(m => m.score1 === null)) return maxRegularRound + semiRoundOffset;

      const finalRoundOffset = (hasQuarters ? 3 : (hasSemis ? 2 : 1));
      if (finals.length > 0 && finals.some(m => m.score1 === null)) return maxRegularRound + finalRoundOffset;
      
      return maxRegularRound + finalRoundOffset;
    }
    
    return current;
  }, [rounds, maxRegularRound, tournament.matches]);

  // Sync displayRound initially or when activeRound changes
  React.useEffect(() => {
    if (displayRound === null || (displayRound < activeRound && activeRound > 0)) {
        setDisplayRound(activeRound);
    }
  }, [activeRound, displayRound]);

  const playoffMatches = tournament.matches.filter(m => m.isPlayoff);
  const quarterFinals = playoffMatches.filter(m => m.playoffType === 'quarterfinal');
  const semiFinals = playoffMatches.filter(m => m.playoffType === 'semifinal');
  const finalMatch = playoffMatches.find(m => m.playoffType === 'final' || (m.isPlayoff && !m.playoffType));
  const thirdPlaceMatch = playoffMatches.find(m => m.playoffType === 'third_place');

  const isRegularComplete = Object.values(rounds).every((roundMatches: any) => (roundMatches as Match[]).every((m: Match) => m.score1 !== null));
  
  const currentViewRound = displayRound || 1;
  const isViewingPlayoff = currentViewRound > maxRegularRound && playoffMatches.length > 0;
  
  // Dynamic playoff round detection
  const hasQuarters = quarterFinals.length > 0;
  const hasSemis = semiFinals.length > 0;

  const isViewingQuarters = isViewingPlayoff && currentViewRound === maxRegularRound + 1 && hasQuarters;
  const isViewingSemis = isViewingPlayoff && (
    (hasQuarters && currentViewRound === maxRegularRound + 2) ||
    (!hasQuarters && hasSemis && currentViewRound === maxRegularRound + 1)
  );
  const isViewingFinals = isViewingPlayoff && (
    (hasQuarters && currentViewRound === maxRegularRound + 3) ||
    (!hasQuarters && hasSemis && currentViewRound === maxRegularRound + 2) ||
    (!hasQuarters && !hasSemis && currentViewRound === maxRegularRound + 1)
  );

  const isCurrentViewRoundComplete = !isViewingPlayoff && rounds[currentViewRound] && rounds[currentViewRound].every(m => m.score1 !== null);
  const areQuartersComplete = hasQuarters && quarterFinals.every(m => m.score1 !== null);
  const areSemisComplete = hasSemis && semiFinals.every(m => m.score1 !== null);
  const isFinalComplete = finalMatch && finalMatch.score1 !== null;

  const playerForms = useMemo(() => {
    const forms: Record<string, ('W' | 'L' | 'D' | 'R')[]> = {};
    tournament.players.forEach(p => {
      forms[p.id] = [];
    });

    const completedMatches = tournament.matches.filter(m => m.score1 !== null && m.score2 !== null);

    for (let r = 1; r <= maxRegularRound; r++) {
      const roundMatches = completedMatches.filter(m => m.round === r && !m.isPlayoff);
      if (roundMatches.length === 0) continue;

      tournament.players.forEach(p => {
        const match = roundMatches.find(m => m.team1.includes(p.id) || m.team2.includes(p.id));
        if (match) {
          const isTeam1 = match.team1.includes(p.id);
          const myScore = isTeam1 ? match.score1! : match.score2!;
          const oppScore = isTeam1 ? match.score2! : match.score1!;
          if (myScore > oppScore) forms[p.id].push('W');
          else if (myScore < oppScore) forms[p.id].push('L');
          else forms[p.id].push('D');
        } else {
          forms[p.id].push('R');
        }
      });
    }

    return forms;
  }, [tournament.players, tournament.matches, maxRegularRound]);

  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    if ((isCompleted || (isFinalComplete && isViewingFinals)) && !hasCelebrated) {
      setHasCelebrated(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FACC15', '#EAB308', '#FFFFFF']
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, [isCompleted, isFinalComplete, isViewingFinals, hasCelebrated]);

  const totalMatchesLength = tournament.matches.length;
  const completedMatchesCount = tournament.matches.filter(m => m.score1 !== null).length;
  const progressPct = totalMatchesLength === 0 ? 0 : Math.round((completedMatchesCount / totalMatchesLength) * 100);

  const getRestingPlayers = (roundMatches: Match[]) => {
    const playingIds = new Set(roundMatches.flatMap(m => [...m.team1, ...m.team2]));
    return tournament.players.filter(p => !playingIds.has(p.id));
  };

  const handleShareStandings = () => setShowShareModal(true);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `tournaments/${tournament.id}/winners_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateTournament({ id: tournament.id, winnersPhoto: url });
      if(navigator.vibrate) navigator.vibrate([20, 50, 20]);
    } catch (err) {
      console.error("Error uploading photo:", err);
      alert("Error al subir la foto. Inténtalo de nuevo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!finalMatch) return;
    
    const isTeam1Win = finalMatch.score1! > finalMatch.score2!;
    const winnerNames = isTeam1Win 
      ? `${getPlayerName(finalMatch.team1[0])} & ${getPlayerName(finalMatch.team1[1])}`
      : `${getPlayerName(finalMatch.team2[0])} & ${getPlayerName(finalMatch.team2[1])}`;
    
    const runnerUpNames = !isTeam1Win 
      ? `${getPlayerName(finalMatch.team1[0])} & ${getPlayerName(finalMatch.team1[1])}`
      : `${getPlayerName(finalMatch.team2[0])} & ${getPlayerName(finalMatch.team2[1])}`;

    const topStandings = standings.slice(0, 5).map((s, i) => {
        let medal = '';
        if (i === 0) medal = '🥇';
        else if (i === 1) medal = '🥈';
        else if (i === 2) medal = '🥉';
        else medal = '🔹';
        return `${medal} ${s.name}: ${s.pointsWon} pts (${s.wins}V)`;
    }).join('\n');
    
    const today = new Date().toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    let message = `🏆 *RESULTADOS DEL TORNEO* 🏆\n`;
    message += `📍 *${tournament.name.toUpperCase()}*\n`;
    message += `📅 *Fecha:* ${today}\n\n`;
    message += `🥇 *CAMPEONES:* ${winnerNames}\n`;
    message += `🥈 *Finalistas:* ${runnerUpNames}\n`;
    
    if (thirdPlaceMatch && thirdPlaceMatch.score1 !== null) {
      const isT1Third = thirdPlaceMatch.score1 > thirdPlaceMatch.score2!;
      const thirdPlaceNames = isT1Third 
        ? `${getPlayerName(thirdPlaceMatch.team1[0])} & ${getPlayerName(thirdPlaceMatch.team1[1])}`
        : `${getPlayerName(thirdPlaceMatch.team2[0])} & ${getPlayerName(thirdPlaceMatch.team2[1])}`;
      message += `🥉 *3er Puesto:* ${thirdPlaceNames}\n`;
    }
    
    message += `\n📊 *TOP 5 RANKING FINAL:*\n${topStandings}\n\n`;
    message += `📲 Creado con Machos Padel App. By Yorch`;
    
    try {
      if (tournament.winnersPhoto && navigator.share && (navigator as any).canShare) {
        const response = await fetch(tournament.winnersPhoto);
        const blob = await response.blob();
        const file = new File([blob], 'campeones.jpg', { type: 'image/jpeg' });
        
        if ((navigator as any).canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            text: message,
            title: `Resultados - ${tournament.name}`
          });
          return;
        }
      }
      
      if (navigator.share) {
        await navigator.share({
          text: message,
          title: `Resultados - ${tournament.name}`
        });
      } else {
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
      }
    } catch (err) {
      console.error("Error sharing:", err);
      const encoded = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const generatePlayoff = async (format: PlayoffFormat, options?: { includeThirdPlaceMatch?: boolean }) => {
    if (isReadOnly || isGeneratingRound) return;
    if (tournament.matches.some(m => m.isPlayoff)) {
      setShowPlayoffConfigModal(false);
      return;
    }
    
    setIsGeneratingRound(true);
    try {
      const newMatches = generatePlayoffMatches(tournament, format, options);
      if (newMatches.length > 0) {
        await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...newMatches] });
        setDisplayRound(newMatches[0].round);
      }
    } catch (err: any) {
      alert(err.message || 'Error al generar fase de playoffs.');
    } finally {
      setIsGeneratingRound(false);
      setShowPlayoffConfigModal(false);
    }
  };

  const handleGenerateSemisFromQuarters = async () => {
    if (isReadOnly || isGeneratingRound) return;
    if (tournament.matches.some(m => m.isPlayoff && m.playoffType === 'semifinal')) return;
    setIsGeneratingRound(true);
    try {
      const newSemis = generateSemisFromQuarters(tournament);
      await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...newSemis] });
      setDisplayRound(newSemis[0].round);
    } catch (err: any) {
      alert(err.message || 'Error al generar semifinales.');
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const handleGenerateFinalsFromSemis = async () => {
    if (isReadOnly || isGeneratingRound) return;
    if (tournament.matches.some(m => m.isPlayoff && (m.playoffType === 'final' || m.playoffType === 'third_place'))) return;
    setIsGeneratingRound(true);
    try {
      const newFinals = generateFinalsFromSemis(tournament, true);
      await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...newFinals] });
      setDisplayRound(newFinals[0].round);
    } catch (err: any) {
      alert(err.message || 'Error al generar finales.');
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const handleAddRegularRounds = async (roundsToAdd: number) => {
    if (isReadOnly || isGeneratingRound) return;
    const check = canAddRegularRounds(tournament);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }

    setIsGeneratingRound(true);
    try {
      const newMatches = generateAdditionalAmericanoRounds(tournament, roundsToAdd);
      await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...newMatches] });
      setDisplayRound(newMatches[0].round);
      setShowAddRoundsModal(false);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err: any) {
      alert(err.message || 'Error al agregar rondas.');
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const getPlayerName = (id: string) => tournament.players.find(p => p.id === id)?.name || 'Desconocido';

  const handleGenerateAISummary = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/tournament-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentData: {
            name: tournament.name,
            type: tournament.type,
            standings: standings.map(s => ({ name: s.name, points: s.pointsWon, diff: s.pointsDifference, wins: s.wins })),
            recentMatches: tournament.matches.filter(m => m.score1 !== null).slice(-5).map(m => ({
               t1: [getPlayerName(m.team1[0]), getPlayerName(m.team1[1])],
               t2: [getPlayerName(m.team2[0]), getPlayerName(m.team2[1])],
               score: `${m.score1}-${m.score2}`
            }))
          }
        })
      });
      const data = await response.json();
      if (data.summary) {
        setAiSummary(data.summary);
        if(navigator.vibrate) navigator.vibrate([10, 30, 10]);
      }
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const renderMatch = (match: Match) => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      key={match.id} 
      className="relative bg-zinc-900 rounded-3xl overflow-hidden shadow-xl shadow-black/20 border border-zinc-800 mb-4 p-4"
    >
      <div className="absolute top-4 right-5 text-xs font-bold text-zinc-500 uppercase tracking-widest">
        Pista {match.court}
      </div>
      
      <div className="flex flex-col mt-4">
        <div 
           onClick={() => { if(!isReadOnly) { if(navigator.vibrate) navigator.vibrate(20); setEditingMatch(match); } }}
           className={`flex items-center justify-between w-full p-2 ${!isReadOnly ? 'hover:bg-zinc-800/80 cursor-pointer active:scale-[0.98]' : 'cursor-default'} rounded-xl transition-all`}
        >
          {/* Player 1 & 2 */}
          <div className="flex-1 text-left leading-snug">
            {match.serveFirst === 1 && (
               <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5 whitespace-nowrap">
                 🎾 Saque
               </div>
            )}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayerId(match.team1[0]);
                setInitialProfileTab('tournament');
              }}
              className="text-[15px] font-medium text-white hover:text-yellow-400 hover:underline cursor-pointer transition-colors inline-block"
              title="Ver ficha e historial del jugador"
            >
              {getPlayerName(match.team1[0])}
            </div>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayerId(match.team1[1]);
                setInitialProfileTab('tournament');
              }}
              className="text-[15px] font-medium text-white hover:text-yellow-400 hover:underline cursor-pointer transition-colors block"
              title="Ver ficha e historial del jugador"
            >
              {getPlayerName(match.team1[1])}
            </div>
          </div>
          
          {/* Scores */}
          <div 
            onClick={(e) => {
              if (!isReadOnly) {
                e.stopPropagation();
                if (navigator.vibrate) navigator.vibrate(20);
                setEditingMatch(match);
              }
            }}
            className="flex items-center gap-3 px-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            title={!isReadOnly ? "Editar marcador" : undefined}
          >
            <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-2xl font-mono shadow-inner border border-zinc-800 font-bold ${match.score1 !== null && match.score1 > match.score2! ? 'bg-yellow-500 text-black border-none drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-black text-white'}`}>
               {match.score1 !== null ? String(match.score1).padStart(2, '0') : '--'}
            </div>
            <span className="text-[11px] font-semibold text-zinc-600 uppercase">VS</span>
            <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-2xl font-mono shadow-inner border border-zinc-800 font-bold ${match.score2 !== null && match.score2 > match.score1! ? 'bg-yellow-500 text-black border-none drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-black text-white'}`}>
               {match.score2 !== null ? String(match.score2).padStart(2, '0') : '--'}
            </div>
          </div>
          
          {/* Player 3 & 4 */}
          <div className="flex-1 text-right leading-snug">
            {match.serveFirst === 2 && (
               <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5 whitespace-nowrap">
                 Saque 🎾
               </div>
            )}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayerId(match.team2[0]);
                setInitialProfileTab('tournament');
              }}
              className="text-[15px] font-medium text-white hover:text-yellow-400 hover:underline cursor-pointer transition-colors inline-block"
              title="Ver ficha e historial del jugador"
            >
              {getPlayerName(match.team2[0])}
            </div>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayerId(match.team2[1]);
                setInitialProfileTab('tournament');
              }}
              className="text-[15px] font-medium text-white hover:text-yellow-400 hover:underline cursor-pointer transition-colors block"
              title="Ver ficha e historial del jugador"
            >
              {getPlayerName(match.team2[1])}
            </div>
          </div>
        </div>

         {match.isPlayoff && (
          <div className="text-center mt-3 pt-3 border-t border-zinc-800">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              match.playoffType === 'third_place' ? 'text-zinc-500' : 'text-[#FACC15]'
            }`}>
              {match.playoffType === 'final' ? '👑 GRAN FINAL' : 
               match.playoffType === 'semifinal' ? '⭐ SEMIFINAL - Pista Central' : 
               match.playoffType === 'third_place' ? (tournament.players.length >= 8 ? '🥈 FINAL PLATA' : '🥉 3ER PUESTO') : 'CONTENIDO PREMIUM'}
            </span>
          </div>
         )}
      </div>
    </motion.div>
  );

  const handleSaveScore = async (matchId: string, s1: number, s2: number) => {
    if (isReadOnly || isSavingScore) return;
    setIsSavingScore(true);

    const updatedMatches = tournament.matches.map(m => 
      m.id === matchId ? { ...m, score1: s1, score2: s2 } : m
    );
    
    const isFinishingFinal = finalMatch && finalMatch.id === matchId;
    
    try {
      await updateTournament({ 
        id: tournament.id, 
        matches: updatedMatches,
        ...(isFinishingFinal ? { status: 'completed' } : {})
      });
      setEditingMatch(null);

      // Auto-trigger playoffs for Americano when all matches are done
      if (tournament.type === 'americano') {
        const regularMatches = updatedMatches.filter(m => !m.isPlayoff);
        const allScored = regularMatches.every(m => m.score1 !== null);
        const hasPlayoffs = updatedMatches.some(m => m.isPlayoff);
        
        if (allScored && !hasPlayoffs && !isReadOnly) {
          setTimeout(() => {
            setShowPlayoffConfigModal(true);
            if(navigator.vibrate) navigator.vibrate([30, 50, 30]);
          }, 500);
        }
      }
    } catch (err) {
      console.error("Error saving score:", err);
      alert("Error al guardar el marcador. Por favor, intenta de nuevo.");
    } finally {
      setIsSavingScore(false);
    }
  };

  const handleGenerateNextKingRound = async () => {
    if (isReadOnly || isGeneratingRound) return;
    if (tournament.matches.some(m => m.round === maxRegularRound + 1)) return;
    setIsGeneratingRound(true);

    try {
      const nextMatches = generateKingMatches(tournament, maxRegularRound);
      if (nextMatches.length > 0) {
        await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...nextMatches] });
        setDisplayRound(maxRegularRound + 1);
        if(navigator.vibrate) navigator.vibrate(100);
      } else {
        alert("Asegúrate de haber completado todos los marcadores de la ronda actual antes de generar la siguiente.");
      }
    } catch (err) {
      alert("Error al generar la siguiente ronda.");
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const handleGenerateNextMexicanoRound = async () => {
    if (isReadOnly || isGeneratingRound) return;
    if (tournament.matches.some(m => m.round === maxRegularRound + 1)) return;
    setIsGeneratingRound(true);

    try {
      const nextMatches = generateMexicanoMatches(tournament, maxRegularRound);
      if (nextMatches.length > 0) {
        await updateTournament({ id: tournament.id, matches: [...tournament.matches, ...nextMatches] });
        setDisplayRound(maxRegularRound + 1);
        if(navigator.vibrate) navigator.vibrate(100);
      } else {
        alert("Asegúrate de haber completado todos los marcadores de la ronda actual antes de generar la siguiente.");
      }
    } catch (err) {
      alert("Error al generar la siguiente ronda.");
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const isPlayoffMode = playoffMatches.length > 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative">
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-400 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 z-40">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          Modo Sin Conexión - Los cambios se guardan localmente y se sincronizarán al recuperar la red.
        </div>
      )}
      <header className="px-6 pt-12 pb-4 backdrop-blur-2xl bg-zinc-950/80 sticky top-0 flex flex-col gap-5 text-white border-b border-zinc-900/50 z-30">
          <div className="flex items-center gap-3">
            {isPlayoffMode && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-md mb-1 animate-pulse">
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">FASE FINAL</span>
              </div>
            )}
            <button 
              onClick={() => {
                if (activeTab === 'standings') {
                  setActiveTab('matches');
                } else {
                  onNavigate('home');
                }
              }} 
              className="p-2 -ml-2 text-yellow-500 hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 pointer-events-none" />
            </button>
            <div className="flex-1 text-center pr-8">
              <h1 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 uppercase tracking-widest mb-0.5">
                {tournament.type === 'king' ? 'Rey de la Cancha' : tournament.type === 'mexicano' ? 'Torneo Mexicano' : 'Torneo Americano'}
              </h1>
              <h2 className="text-3xl font-black tracking-tight">
                {activeTab === 'matches' 
                  ? (isPlayoffMode ? 'Playoffs' : 'Rondas') 
                  : activeTab === 'standings' 
                    ? 'Ranking' 
                    : 'Fotos'}
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 ml-auto pointer-events-auto">
               <button onClick={() => setShowSplitBillModal(true)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors" title="Cuentas">
                 <Receipt className="w-5 h-5" />
               </button>
               <button onClick={() => onNavigate('tv')} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors" title="Modo TV">
                 <Monitor className="w-5 h-5" />
               </button>
               <button onClick={() => setShowQRModal(true)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors" title="Código QR">
                  <QrCode className="w-5 h-5" />
               </button>
            </div>
          </div>

          {activeTab === 'matches' && (
            <div className="flex items-center justify-center -mb-8 mt-2 z-10 relative">
            <button 
              onClick={() => setDisplayRound(r => Math.max(1, (r || 1) - 1))}
              disabled={currentViewRound <= 1}
              className="p-3 text-white disabled:opacity-30"
            >
              <ArrowLeft className="w-5 h-5 pointer-events-none" />
            </button>
              
            <div className="bg-zinc-900 text-white rounded-xl px-6 py-3 font-black shadow-md mx-2 min-w-[120px] text-center border ring-1 ring-white/10 ring-inset border-zinc-800 whitespace-nowrap bg-gradient-to-b from-zinc-800 to-zinc-900">
               {isViewingFinals ? 'Fase Final' : isViewingSemis ? 'Semifinales' : `Ronda #${currentViewRound}`}
            </div>
            
            <button 
               onClick={() => setDisplayRound(r => Math.min(maxRegularRound + (finalMatch ? (semiFinals.length > 0 ? 2 : 1) : semiFinals.length > 0 ? 1 : 0), (r || 1) + 1))}
               disabled={currentViewRound >= maxRegularRound + (finalMatch ? (semiFinals.length > 0 ? 2 : 1) : semiFinals.length > 0 ? 1 : 0)}
               className="p-3 text-white disabled:opacity-30"
            >
              <div className="w-5 h-5 items-center justify-center flex"><ArrowLeft className="w-5 h-5 pointer-events-none rotate-180" /></div>
            </button>
          </div>
        )}
      </header>

      <main className={`flex-1 overflow-y-auto no-scrollbar p-6 pb-32 bg-zinc-950 ${activeTab === 'matches' ? 'pt-10' : ''}`}>
        {activeTab === 'matches' ? (
          <div className="space-y-4">
            {isPlayoffMode && (
              <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
                <div className="bg-gradient-to-br from-yellow-500/20 to-zinc-900 border border-yellow-500/30 rounded-3xl p-6 flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                      <Trophy className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Fase Final</h3>
                      <p className="text-xs font-bold text-yellow-500/80 uppercase tracking-widest">Cruces Eliminatorios</p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button 
                      onClick={() => {
                        if(window.confirm('¿Deseas reiniciar los playoffs? Se borrarán los partidos de fase final actuales.')) {
                          updateTournament({ ...tournament, matches: tournament.matches.filter(m => !m.isPlayoff) });
                        }
                      }}
                      className="p-3 bg-zinc-950/50 hover:bg-red-500/20 border border-zinc-800 hover:border-red-500/30 rounded-2xl transition-all group"
                    >
                      <X className="w-5 h-5 text-zinc-500 group-hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {isViewingQuarters ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {quarterFinals.map(renderMatch)}
                 {areQuartersComplete && !isReadOnly && (
                    <div className="pt-6 pb-2 md:col-span-2 animate-in fade-in slide-in-from-bottom-4">
                      {semiFinals.length > 0 ? (
                        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setDisplayRound(currentViewRound + 1); }} className="w-full bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 border border-yellow-400 text-white font-black text-[13px] py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                          Ir a Semifinales
                          <ArrowLeft className="w-5 h-5 rotate-180" />
                        </button>
                      ) : (
                        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); handleGenerateSemisFromQuarters(); }} className="w-full bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 border border-yellow-400 text-white font-black text-[13px] py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                          Generar Semifinales
                        </button>
                      )}
                    </div>
                 )}
               </div>
            ) : isViewingSemis ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {semiFinals.map(renderMatch)}
                 {areSemisComplete && !isReadOnly && (
                   <div className="pt-6 pb-2 md:col-span-2 animate-in fade-in slide-in-from-bottom-4">
                     {finalMatch ? (
                       <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setDisplayRound(currentViewRound + 1); }} className="w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600 border border-red-400 text-white font-black text-[13px] py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                         Ir a la Gran Final
                         <ArrowLeft className="w-5 h-5 rotate-180" />
                       </button>
                     ) : (
                        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); handleGenerateFinalsFromSemis(); }} className="w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600 border border-red-400 text-white font-black text-[13px] py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                         Generar Final y 3er Puesto
                       </button>
                     )}
                   </div>
                 )}
               </div>
            ) : isViewingFinals ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {!finalMatch && (
                     <div className="flex flex-col items-center justify-center py-12 text-zinc-500 col-span-full">
                       <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mb-4 text-transparent"></div>
                       <p className="font-medium animate-pulse">Generando partidos...</p>
                     </div>
                   )}
                   {finalMatch && renderMatch(finalMatch)}
                   {thirdPlaceMatch && renderMatch(thirdPlaceMatch)}
                     {isFinalComplete && (
                       <div className="col-span-full mx-auto md:w-2/3 mt-4 bg-zinc-900 border-2 border-yellow-500/20 rounded-3xl p-5 text-center animate-in fade-in zoom-in duration-500 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
                         
                         <Trophy className="w-14 h-14 text-yellow-500 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" />
                         <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.3em] mb-1">¡Nuestros Campeones!</h3>
                         <h2 className="text-2xl font-black text-white leading-tight mb-4 px-4">
                           {finalMatch.score1! > finalMatch.score2! 
                             ? `${getPlayerName(finalMatch.team1[0])} & ${getPlayerName(finalMatch.team1[1])}`
                             : `${getPlayerName(finalMatch.team2[0])} & ${getPlayerName(finalMatch.team2[1])}`}
                         </h2>

                         {/* Photo Section */}
                         <div className="mb-6 px-2">
                            {tournament.winnersPhoto ? (
                               <div className="relative group">
                                 <img 
                                   src={tournament.winnersPhoto} 
                                   alt="Campeones" 
                                   className="w-full h-48 object-cover rounded-2xl border border-zinc-800 shadow-xl"
                                 />
                                 {!isReadOnly && (
                                    <button 
                                       onClick={() => photoInputRef.current?.click()}
                                       className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                                    >
                                       <div className="flex flex-col items-center gap-2">
                                         <Camera className="w-8 h-8 text-white" />
                                         <span className="text-xs font-bold text-white uppercase">Cambiar Foto</span>
                                       </div>
                                    </button>
                                 )}
                               </div>
                            ) : (
                               !isReadOnly && (
                                 <button 
                                   onClick={() => photoInputRef.current?.click()}
                                   disabled={isUploadingPhoto}
                                   className="w-full h-40 border-2 border-dashed border-zinc-800 hover:border-yellow-500/40 hover:bg-yellow-500/5 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"
                                 >
                                   {isUploadingPhoto ? (
                                     <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                                   ) : (
                                     <>
                                       <div className="p-3 bg-zinc-800 rounded-full group-hover:bg-yellow-500/20 group-hover:text-yellow-500 transition-colors">
                                         <Camera className="w-6 h-6" />
                                       </div>
                                       <div className="flex flex-col gap-1">
                                         <span className="text-xs font-black text-white uppercase tracking-wider">Tomar Foto de los Ganadores</span>
                                         <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Para el recuerdo eterno</span>
                                       </div>
                                     </>
                                   )}
                                 </button>
                               )
                            )}
                            <input 
                               type="file" 
                               ref={photoInputRef} 
                               accept="image/*" 
                               capture="environment" 
                               className="hidden" 
                               onChange={handlePhotoUpload} 
                            />
                         </div>

                         <div className="flex flex-col gap-3">
                            <button 
                              onClick={handleShareWhatsApp} 
                              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                            >
                               <Share2 className="w-5 h-5" />
                               Compartir Resultados
                            </button>
                           
                           {!isReadOnly && (
                               <button 
                                 onClick={async () => {
                                   try {
                                     await updateTournament({ id: tournament.id, status: 'completed' });
                                   } catch (e) {
                                     console.error(e);
                                   }
                                   onNavigate('home');
                                 }} 
                                 className="w-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                               >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Finalizar y Salir
                               </button>
                           )}
                         </div>
                       </div>
                     )}
                 </div>
            ) : (
              rounds[currentViewRound] ? (
                <div className="w-full">
                  {getRestingPlayers(rounds[currentViewRound]).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium mb-6 px-2 col-span-full">
                       <span className="w-2 h-2 rounded-full bg-red-600" />
                       Descansan: {getRestingPlayers(rounds[currentViewRound]).map(p => p.name).join(', ')}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                     {rounds[currentViewRound].map(renderMatch)}
                  </div>

                  {!isReadOnly && playoffMatches.length === 0 && (
                    <div className="mt-8 mb-4 px-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {canAddRoundsResult.allowed && (
                        <button 
                          onClick={() => setShowAddRoundsModal(true)}
                          className="py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-yellow-500/30 text-zinc-300 hover:text-yellow-400 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider group"
                        >
                          <CalendarDays className="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                          <span>Agregar Rondas (+)</span>
                        </button>
                      )}
                      <button 
                        onClick={() => setShowPlayoffConfigModal(true)}
                        className={`py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-yellow-500/30 text-zinc-300 hover:text-yellow-400 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider group ${
                          !canAddRoundsResult.allowed ? 'sm:col-span-2' : ''
                        }`}
                      >
                        <Swords className="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                        <span>Fase de Playoffs</span>
                      </button>
                    </div>
                  )}
                  
                  {isCurrentViewRoundComplete && currentViewRound < maxRegularRound && !isReadOnly && (
                     <div className="pt-6 pb-2 animate-in fade-in slide-in-from-bottom-4">
                       <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setDisplayRound(currentViewRound + 1); }} className="w-full bg-gradient-to-r from-zinc-800 to-zinc-700 border border-zinc-600 text-white font-black uppercase tracking-widest text-[13px] py-4 rounded-2xl shadow-xl hover:from-zinc-700 hover:to-zinc-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                         Comenzar Ronda {currentViewRound + 1}
                         <ArrowLeft className="w-5 h-5 rotate-180" />
                       </button>
                     </div>
                  )}

                  {isCurrentViewRoundComplete && currentViewRound === maxRegularRound && playoffMatches.length === 0 && !isReadOnly && (
                     <div className="pt-6 pb-2 animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-3">
                       <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center mb-1">
                         <h4 className="text-yellow-400 font-black uppercase text-xs tracking-widest mb-1">¡Fase Regular Completada!</h4>
                         <p className="text-zinc-400 text-xs">Todos los partidos han finalizado. Puedes iniciar los playoffs o seguir agregando rondas.</p>
                       </div>

                       <button 
                         onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setShowPlayoffConfigModal(true); }}
                         className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-black text-[13px] py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                       >
                         <Swords className="w-5 h-5" />
                         Configurar Playoffs (Cuartos / Semis / Finales)
                       </button>

                       {canAddRoundsResult.allowed && (
                         <button 
                           onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setShowAddRoundsModal(true); }}
                           className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs py-3.5 px-6 rounded-xl transition-all uppercase tracking-wider text-center flex items-center justify-center gap-2"
                         >
                           <CalendarDays className="w-4 h-4 text-yellow-500" />
                           Agregar Más Rondas Regulares (+{canAddRoundsResult.suggestedFairRounds || 1})
                         </button>
                       )}

                       {tournament.type === 'king' && (
                         <button 
                           disabled={isGeneratingRound}
                           onClick={() => { if(navigator.vibrate) navigator.vibrate(50); handleGenerateNextKingRound(); }} 
                           className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs py-3 px-6 rounded-xl transition-all uppercase tracking-wider text-center flex items-center justify-center gap-2"
                         >
                           {isGeneratingRound ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                           Generar Siguiente Ronda (Rey de la Cancha)
                         </button>
                       )}

                       {tournament.type === 'mexicano' && (
                         <button 
                           disabled={isGeneratingRound}
                           onClick={() => { if(navigator.vibrate) navigator.vibrate(50); handleGenerateNextMexicanoRound(); }} 
                           className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs py-3 px-6 rounded-xl transition-all uppercase tracking-wider text-center flex items-center justify-center gap-2"
                         >
                           {isGeneratingRound ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 rotate-180" />}
                           Generar Siguiente Ronda (Mexicano)
                         </button>
                       )}

                       <button 
                         onClick={async () => {
                           if (window.confirm('¿Deseas finalizar el torneo directamente según las posiciones de la fase regular (sin fase eliminatoria)?')) {
                             try {
                               await updateTournament({ id: tournament.id, status: 'completed' });
                               setActiveTab('standings');
                             } catch (e) {
                               console.error(e);
                             }
                           }
                         }} 
                         className="w-full bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-zinc-300 font-bold text-[11px] py-3 px-6 rounded-xl transition-all uppercase tracking-widest text-center"
                       >
                         Finalizar Torneo Por Ranking Directo (Sin Playoffs)
                       </button>
                     </div>
                  )}
                </div>
              ) : (
                 <div className="text-center py-10 text-zinc-500">Aún no hay encuentros.</div>
              )
            )}
          </div>
        ) : activeTab === 'standings' ? (
          <div className="flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-4">
              <div className="flex items-center justify-between mb-4 -mt-2">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">RANKING DEL TORNEO</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (standings.length > 0) {
                        if (navigator.vibrate) navigator.vibrate(20);
                        setSelectedPlayerId(standings[0].id);
                        setInitialProfileTab('h2h');
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 hover:border-yellow-500/30 px-3 py-2 rounded-lg"
                    title="Comparar participantes cara a cara"
                  >
                    <Swords className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="hidden xs:inline">Cara a Cara</span>
                  </button>
                  <button 
                    onClick={handleGenerateAISummary} 
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg"
                  >
                    {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
                    AI Resumen
                  </button>
                  <button onClick={handleShareStandings} className="flex items-center gap-1.5 text-xs font-bold text-yellow-500 hover:text-yellow-400 transition-colors bg-yellow-500/10 px-3 py-2 rounded-lg">
                    <Share2 className="w-4 h-4" />
                    Compartir
                  </button>
                </div>
              </div>

              {/* Informative helper hint */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span>Toca a cualquier jugador para ver su <strong>ficha detallada</strong>, historial ronda a ronda y parejas.</span>
                </div>
              </div>

              {aiSummary && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl mb-4 relative"
                >
                  <button onClick={() => setAiSummary(null)} className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resumen Inteligente</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-zinc-300 italic">
                    {aiSummary}
                  </p>
                </motion.div>
              )}

              <div className="bg-zinc-900 rounded-3xl shadow-sm border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/50 text-zinc-500 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-800">
                      <th className="py-3 px-2 w-8 text-center sm:p-4 sm:w-12">#</th>
                      <th className="py-3 px-2 sm:p-4">Jugador</th>
                      <th className="py-3 px-1 text-center sm:p-4" title="Partidos Ganados">PG</th>
                      <th className="py-3 px-1 text-center sm:p-4" title="Partidos Perdidos">PP</th>
                      <th className="py-3 px-1 text-center sm:p-4" title="Partidos Empatados">PE</th>
                      <th className="py-3 px-1 text-center hidden sm:table-cell sm:p-4 text-zinc-600" title="Diferencia de Puntos">DIF</th>
                      <th className="py-3 px-1 text-center hidden md:table-cell sm:p-4 text-zinc-600" title="Promedio de Puntos por Partido">PTS/P</th>
                      <th className="py-3 px-2 text-right sm:p-4" title="Puntos Totales">PTS</th>
                      <th className="py-3 px-1 w-6 text-center sm:p-4 sm:w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {standings.map((stat, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={stat.id} 
                        onClick={() => { 
                          if(navigator.vibrate) navigator.vibrate(20); 
                          setSelectedPlayerId(stat.id); 
                          setInitialProfileTab('tournament');
                        }}
                        className={`group ${i < 4 && !isViewingPlayoff ? "bg-gradient-to-r from-yellow-500/10 to-transparent hover:from-yellow-500/20" : "hover:bg-zinc-800/50"} cursor-pointer transition-colors`}
                      >
                         <td className="py-3 px-2 text-center sm:p-4">
                          {tournamentPodium?.gold.includes(stat.id) ? (
                            <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 mx-auto" />
                          ) : tournamentPodium?.silver.includes(stat.id) ? (
                            <div className="text-[10px] font-bold text-zinc-300 mx-auto">🥈</div>
                          ) : tournamentPodium?.bronze.includes(stat.id) ? (
                            <div className="text-[10px] font-bold text-amber-700 mx-auto">🥉</div>
                          ) : i === 0 && !tournamentPodium ? (
                            <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 mx-auto" />
                          ) : i === 1 && !tournamentPodium ? (
                            <div className="text-[10px] font-bold text-zinc-300 mx-auto">🥈</div>
                          ) : i === 2 && !tournamentPodium ? (
                            <div className="text-[10px] font-bold text-amber-700 mx-auto">🥉</div>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-500">{i+1}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 font-semibold text-white sm:p-4">
                          <div className="flex flex-col min-w-0">
                             <div className="flex items-center gap-1.5">
                               <span className="text-[13px] font-bold group-hover:text-yellow-400 transition-colors truncate max-w-[120px] xs:max-w-none">{stat.name}</span>
                             </div>
                             
                             <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                               <span className="text-[8px] text-zinc-500 font-medium">PJ: {stat.matchesPlayed}</span>
                               <span className="text-zinc-700 hidden xs:inline">•</span>
                               <span className="text-[8px] text-zinc-400 font-medium hidden xs:inline">
                                 Prom: {stat.matchesPlayed > 0 ? (stat.pointsWon / stat.matchesPlayed).toFixed(1) : '0.0'}
                               </span>
                               {stat.tieBreakReason && (
                                 <span className="text-[8px] text-yellow-500/80 font-medium bg-yellow-500/10 px-1 py-0.5 rounded" title={stat.tieBreakReason}>
                                   ℹ️ {stat.tieBreakReason}
                                 </span>
                               )}
                             </div>

                             {/* Form Pills */}
                             {playerForms[stat.id] && playerForms[stat.id].length > 0 && (
                               <div className="flex items-center gap-1 mt-1.5" title="Forma en las últimas rondas (Verde: Victoria, Rojo: Derrota, Amarillo: Empate, Gris: Descanso)">
                                 <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mr-0.5">Forma:</span>
                                 {playerForms[stat.id].slice(-4).map((res, fIdx) => (
                                   <span 
                                     key={fIdx}
                                     className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black uppercase shadow-xs ${
                                       res === 'W' 
                                         ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                                         : res === 'L' 
                                         ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                                         : res === 'D' 
                                         ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                         : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                                     }`}
                                     title={res === 'W' ? 'Victoria' : res === 'L' ? 'Derrota' : res === 'D' ? 'Empate' : 'Descanso'}
                                   >
                                     {res === 'W' ? 'V' : res === 'L' ? 'D' : res === 'D' ? 'E' : '—'}
                                   </span>
                                 ))}
                               </div>
                             )}

                             {badges[stat.id] && badges[stat.id].length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-1">
                                   {badges[stat.id].map(b => (
                                     <span key={b} className="text-[6px] uppercase tracking-tighter font-black bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded-[2px]">
                                        {b.split(' ').pop()}
                                     </span>
                                   ))}
                                </div>
                             )}
                          </div>
                        </td>
                        <td className="py-3 px-1 text-center text-[11px] font-bold text-white sm:p-4 sm:text-xs">
                          {stat.wins}
                        </td>
                        <td className="py-3 px-1 text-center text-[11px] font-bold text-zinc-400 sm:p-4 sm:text-xs">
                          {stat.losses}
                        </td>
                        <td className="py-3 px-1 text-center text-[11px] font-bold text-zinc-500 sm:p-4 sm:text-xs">
                          {stat.draws}
                        </td>
                        <td className={`py-3 px-1 text-center text-xs font-bold hidden sm:table-cell sm:p-4 ${stat.pointsDifference > 0 ? 'text-green-500' : stat.pointsDifference < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                          {stat.pointsDifference > 0 ? '+' : ''}{stat.pointsDifference}
                        </td>
                        <td className="py-3 px-1 text-center text-xs font-bold text-zinc-400 hidden md:table-cell sm:p-4">
                          {stat.matchesPlayed > 0 ? (stat.pointsWon / stat.matchesPlayed).toFixed(1) : '0.0'}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 text-sm sm:p-4 sm:text-base">
                          {stat.pointsWon}
                        </td>
                        <td className="py-3 px-1 text-center sm:p-4">
                          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-yellow-500 group-hover:translate-x-0.5 transition-all mx-auto" />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </div>
        ) : (
          <TournamentPhotos tournament={tournament} isReadOnly={isReadOnly} />
        )}
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 flex justify-center gap-8 px-8 py-4 z-40 shadow-2xl rounded-full w-[calc(100%-48px)] max-w-md">
        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setActiveTab('matches'); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'matches' ? 'text-yellow-500 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}>
           <CalendarDays className="w-6 h-6" />
           <span className="text-[10px] font-bold tracking-wider uppercase">Rondas</span>
        </button>
        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setActiveTab('photos'); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'photos' ? 'text-yellow-500 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}>
           <Camera className="w-6 h-6" />
           <span className="text-[10px] font-bold tracking-wider uppercase">Fotos</span>
        </button>
        <button onClick={() => { if(navigator.vibrate) navigator.vibrate(50); setActiveTab('standings'); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'standings' ? 'text-yellow-500 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}>
           <Trophy className="w-6 h-6" />
           <span className="text-[10px] font-bold tracking-wider uppercase">Ranking</span>
        </button>
      </div>

      {/* Score entry modal */}
      {editingMatch && (
        <ScoreModal 
          match={editingMatch} 
          tournament={tournament} 
          onClose={() => setEditingMatch(null)}
          onSave={handleSaveScore}
          getPlayerName={getPlayerName}
        />
      )}
      
      {showPlayoffConfigModal && (
        <PlayoffConfigModal 
          playerCount={standings.length}
          onClose={() => setShowPlayoffConfigModal(false)}
          onConfirm={generatePlayoff}
          onFinalizeWithoutPlayoffs={async () => {
            setShowPlayoffConfigModal(false);
            if (window.confirm('¿Finalizar el torneo directamente por posiciones de fase regular sin disputar eliminatorias?')) {
              try {
                await updateTournament({ id: tournament.id, status: 'completed' });
                setActiveTab('standings');
              } catch (e) {
                console.error(e);
              }
            }
          }}
        />
      )}

      {showAddRoundsModal && (
        <AddRoundsModal
          currentRounds={maxRegularRound}
          onClose={() => setShowAddRoundsModal(false)}
          onConfirm={handleAddRegularRounds}
        />
      )}

      {showSplitBillModal && (
        <SplitBillModal 
          tournament={tournament}
          onClose={() => setShowSplitBillModal(false)}
          onSave={handleSavePayments}
        />
      )}

      {showShareModal && (
        <ShareModal 
          tournament={tournament} 
          standings={standings} 
          onClose={() => setShowShareModal(false)}
          isFinalComplete={isFinalComplete}
          finalMatch={finalMatch}
          getPlayerName={getPlayerName}
          badges={badges}
          tournamentPodium={tournamentPodium}
        />
      )}

      {showQRModal && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end sm:justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-0 sm:p-6" onClick={() => setShowQRModal(false)}>
           <div className="bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] w-full sm:max-w-md mx-auto animate-in slide-in-from-bottom-8 duration-300 flex flex-col items-center justify-center shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-widest leading-none bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 to-yellow-600">
                Escanea <br/>para ver
              </h2>
              <p className="text-zinc-400 font-medium text-center mb-8">Todos los resultados en vivo</p>
              
              <div className="bg-white p-6 rounded-[2rem] shadow-[0_0_50px_rgba(250,204,21,0.2)] mb-8">
                 <QRCode 
                    value={`${window.location.origin}/?viewer=${tournament.id}`} 
                    size={280}
                    level="H"
                 />
              </div>

              <button 
                onClick={() => setShowQRModal(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-colors"
               >
                 Cerrar QR
              </button>
           </div>
        </div>
      )}

      {selectedPlayerId && (() => {
        const pStat = standings.find(s => s.id === selectedPlayerId);
        if (!pStat) return null;
        return (
          <PlayerProfileModal 
             playerName={pStat.name} 
             playerId={selectedPlayerId}
             currentTournament={tournament}
             initialTab={initialProfileTab}
             onClose={() => {
               setSelectedPlayerId(null);
               setInitialProfileTab(undefined);
             }}
          />
        );
      })()}
    </div>
  );
}

function ScoreModal({ 
  match, 
  tournament, 
  onClose, 
  onSave,
  getPlayerName
}: { 
  match: Match, 
  tournament: Tournament, 
  onClose: () => void,
  onSave: (id: string, s1: number, s2: number) => Promise<void>,
  getPlayerName: (id: string) => string
}) {
  const [score1, setScore1] = useState(match.score1 ?? (tournament.type === 'king' ? 0 : Math.floor(tournament.pointsPerMatch / 2)));
  const [score2, setScore2] = useState(match.score2 ?? (tournament.type === 'king' ? 0 : tournament.pointsPerMatch - score1));
  const [isSaving, setIsSaving] = useState(false);

  const isFixedPoints = tournament.type !== 'king';
  const pointsToWin = tournament.pointsPerMatch;

  const handleScore1Change = (val: number) => {
    setScore1(val);
    if (isFixedPoints) {
      setScore2(pointsToWin - val);
    }
  };

  const handleScore2Change = (val: number) => {
    setScore2(val);
    if (isFixedPoints) {
      setScore1(pointsToWin - val);
    }
  };

  const handleSave = async () => {
    if (match.isPlayoff && score1 === score2) {
      alert("En fases eliminatorias no puede haber empate. ¡Tiene que haber un ganador!");
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(match.id, score1, score2);
    } catch (err) {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6">
      <div className="bg-zinc-900 rounded-[32px] w-full sm:max-w-md animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-zinc-800">
        <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex flex-col items-center text-center">
          <h3 className="text-base font-black text-white uppercase tracking-tight">Anotar Resultado</h3>
          <p className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest mt-0.5">
             {match.playoffType === 'final' ? 'Gran Final' : 
              match.playoffType === 'semifinal' ? 'Semifinal' : 
              match.playoffType === 'third_place' ? 'Tercer Puesto' : 
              `Pista ${match.court}`} • {isFixedPoints ? `${pointsToWin} PTS TOTALES` : 'Puntos Libres'}
          </p>
        </div>
        
        <div className="p-4 space-y-4 bg-zinc-950">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center text-center p-3 bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Equipo 1</span>
              <div className="text-[13px] font-bold text-white leading-tight min-h-[32px] flex flex-col justify-center">
                {getPlayerName(match.team1[0])}<br/>{getPlayerName(match.team1[1])}
              </div>
              <div className="bg-black text-white rounded-xl w-16 h-16 flex items-center justify-center text-4xl font-mono mt-3 shadow-inner border border-zinc-800 font-black relative group overflow-hidden">
                {!isFixedPoints && (
                  <input 
                    type="number"
                    value={score1}
                    onChange={(e) => handleScore1Change(Number(e.target.value))}
                    className="absolute inset-0 bg-transparent text-center focus:outline-none"
                  />
                )}
                {isFixedPoints ? score1 : ''}
              </div>
            </div>

            <div className="flex flex-col items-center text-center p-3 bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800">
               <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Equipo 2</span>
              <div className="text-[13px] font-bold text-white leading-tight min-h-[32px] flex flex-col justify-center">
                {getPlayerName(match.team2[0])}<br/>{getPlayerName(match.team2[1])}
              </div>
               <div className="bg-black text-white rounded-xl w-16 h-16 flex items-center justify-center text-4xl font-mono mt-3 shadow-inner border border-zinc-800 font-black relative overflow-hidden">
                {!isFixedPoints && (
                  <input 
                    type="number"
                    value={score2}
                    onChange={(e) => handleScore2Change(Number(e.target.value))}
                    className="absolute inset-0 bg-transparent text-center focus:outline-none"
                  />
                )}
                {isFixedPoints ? score2 : ''}
              </div>
            </div>
          </div>

          {isFixedPoints && (
            <div className="px-2 pt-2 pb-0">
               <input 
                type="range" 
                min="0" 
                max={pointsToWin} 
                value={score1} 
                onChange={(e) => { if(navigator.vibrate) navigator.vibrate(5); handleScore1Change(Number(e.target.value)); }}
                className="w-full h-3 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-[10px] font-black text-zinc-500 mt-3 uppercase tracking-tighter">
                <span>0 (Eq 1)</span>
                <span>{pointsToWin} (Eq 1)</span>
              </div>
            </div>
          )}
          
          {!isFixedPoints && (
            <p className="text-[10px] text-zinc-500 text-center uppercase font-bold">Pulsa sobre los números para editar</p>
          )}
        </div>

        <div className="flex p-4 gap-3 bg-zinc-900">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-3.5 font-bold text-[14px] text-zinc-400 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition disabled:opacity-50"
          >
            Atras
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-3.5 px-6 font-black text-[14px] text-white bg-red-600 border border-red-500/50 rounded-xl hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] transition uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({ 
  tournament, standings, onClose, isFinalComplete, finalMatch, getPlayerName, badges, tournamentPodium
}: { 
  tournament: Tournament, standings: ReturnType<typeof calculateStandings>, onClose: () => void, isFinalComplete: boolean | undefined, finalMatch: Match | undefined, getPlayerName: (id: string) => string, badges: Record<string, string[]>, tournamentPodium?: { gold: string[]; silver: string[]; bronze: string[] } | null
}) {
  const [downloading, setDownloading] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!storyRef.current) return;
    setDownloading(true);
    try {
      await new Promise(r => setTimeout(r, 100)); // wait for fonts roughly
      const dataUrl = await htmlToImage.toJpeg(storyRef.current, { quality: 0.9, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `machos-padel-${tournament.name.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to export image', e);
    }
    setDownloading(false);
  };

  const shareLink = window.location.origin + window.location.pathname + '?viewer=' + tournament.id;
  const [copyStatus, setCopyStatus] = useState('Copiar Enlace');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopyStatus('¡Copiado!');
    setTimeout(() => setCopyStatus('Copiar Enlace'), 2000);
  };

  const handleWhatsApp = () => {
     let text = `🏆 *${tournament.name.toUpperCase()}* 🎾\n`;
     text += `━━━━━━━━━━━━━━━━━━━━━\n`;
     
     const podium = getTournamentPodium(tournament);
     if (podium) {
       text += `🔥 *¡TORNEO FINALIZADO!*\n\n`;
       text += `🥇 *CAMPEONES:* \n✨ ${podium.gold.map(getPlayerName).join(' & ')} ✨\n\n`;
       if (podium.silver.length > 0) {
         text += `🥈 *Subcampeones:* ${podium.silver.map(getPlayerName).join(' & ')}\n`;
       }
       if (podium.bronze.length > 0) {
         text += `🥉 *3er Puesto:* ${podium.bronze.map(getPlayerName).join(' & ')}\n`;
       }
       text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
     } else {
       text += `📈 *ESTADO DEL RANKING ACTUAL:*\n\n`;
     }
     
     if (standings.length > 0) {
       standings.slice(0, 8).forEach((p, i) => {
         let medal = '🔹';
         if (i === 0) medal = '🥇';
         if (i === 1) medal = '🥈';
         if (i === 2) medal = '🥉';
         
         let badgeText = '';
         if (badges[p.id] && badges[p.id].length > 0) {
             badgeText = ` _(${badges[p.id].join(', ')})_`;
         }
         
         const statsLine = `PG: ${p.wins} | PP: ${p.losses} ${p.draws > 0 ? `| PE: ${p.draws}` : ''}`;
         text += `${medal} *${i + 1}. ${p.name}* \n   ↳  *${p.pointsWon} pts* | ${statsLine}${badgeText}\n\n`;
       });
       
       const outerBadges = standings.slice(8).filter(p => badges[p.id] && badges[p.id].length > 0);
       if (outerBadges.length > 0) {
          text += `⭐ *MENCIONES ESPECIALES:*\n`;
          outerBadges.forEach(p => {
             text += `🎖️ *${p.name}:* ${badges[p.id].join(' | ')}\n`;
          });
          text += `\n`;
       }
     }

     const finishedMatches = tournament.matches.filter(m => m.score1 !== null && m.score2 !== null);
     if (finishedMatches.length > 0) {
        text += `🎾 *¡ÚLTIMOS RESULTADOS!* 🎾\n`;
        finishedMatches.slice(-3).reverse().forEach(m => {
           text += `👉 ${getPlayerName(m.team1[0])}/${getPlayerName(m.team1[1])}  *${m.score1}-${m.score2}*  ${getPlayerName(m.team2[0])}/${getPlayerName(m.team2[1])}\n`;
        });
        text += `\n`;
     }

     text += `━━━━━━━━━━━━━━━━━━━━━\n`;
     text += `📱 *Ver todos los resultados en vivo:* \n${shareLink}\n\n`;
     text += `_Generado con pasión en Machos Padel App_ 🎾`;

     window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end sm:justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-6">
      <div className="bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] w-full sm:max-w-md animate-in slide-in-from-bottom-8 duration-300 flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border border-zinc-800">
        
        <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center text-center">
            <h3 className="text-xl font-bold text-white flex-1 text-center pl-6">Compartir</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-2">✕</button>
        </div>
        
        <div className="p-6 space-y-6 bg-zinc-950 overflow-y-auto max-h-[70vh]">
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-2">
             <div className="flex items-center gap-3 mb-2 text-yellow-500">
                <Link2 className="w-5 h-5" />
                <h4 className="font-bold text-white">Resultados en Vivo</h4>
             </div>
             <p className="text-sm text-zinc-400 mb-4 leading-snug">Envía este enlace a los jugadores para que sigan los partidos y el ranking en su celular.</p>
             <div className="flex gap-2">
                <button onClick={handleCopyLink} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 px-2 rounded-xl text-sm transition-colors">
                  {copyStatus}
                </button>
                <button onClick={handleWhatsApp} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1">
                  <Share2 className="w-4 h-4" /> WhatsApp
                </button>
             </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
             <div className="flex items-center justify-between mb-4">
               <div>
                  <h4 className="font-bold text-white flex items-center gap-2 mb-1">
                     <Download className="w-4 h-4 text-yellow-500" /> Exportar Story
                  </h4>
                  <p className="text-xs text-zinc-400">Descarga una imagen para Instagram.</p>
               </div>
               <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-2 px-4 rounded-xl text-sm transition-colors shrink-0"
               >
                 {downloading ? 'Generando...' : 'Descargar'}
               </button>
             </div>
             
             {/* Preview Container for Exporting */}
             <div className="flex items-center justify-center p-4 bg-black rounded-xl overflow-hidden">
               <div className="relative overflow-hidden w-[270px] h-[480px] origin-center scale-[0.8] shadow-lg shadow-yellow-500/10">
                   <div 
                      ref={storyRef}
                      className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden w-[540px] h-[960px] origin-top-left scale-[0.5]"
                      style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, #450a0a 0%, #09090b 60%)' }}
                    >
                      <div className="border border-red-900/40 w-full h-full rounded-3xl p-8 flex flex-col justify-between absolute inset-4" style={{ backgroundColor: '#09090b' }}>
                         
                         <div className="flex flex-col items-center mt-6">
                            <img src="/logo.png" alt="Machos Padel" className="w-[300px] object-contain drop-shadow-xl" />
                            <div className="w-16 h-1 bg-[#EF4444] my-8 rounded-full"></div>
                            <h2 className="text-4xl font-bold text-center leading-tight">
                               {tournament.name}
                            </h2>
                         </div>

                         <div className="flex-1 mt-10 w-full flex flex-col items-center">
                            {(tournamentPodium || getTournamentPodium(tournament)) ? (
                               <div className="w-full text-center space-y-6">
                                  <div className="w-full p-8 rounded-3xl" style={{ backgroundColor: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                                     <h3 className="text-[#FACC15] font-bold uppercase tracking-widest mb-4">🏆 Campeones</h3>
                                     {(tournamentPodium || getTournamentPodium(tournament))!.gold.map(id => (
                                       <div key={id} className="text-3xl font-bold text-white mb-1">{getPlayerName(id)}</div>
                                     ))}
                                  </div>
                                  {(tournamentPodium || getTournamentPodium(tournament))!.silver.length > 0 && (
                                    <div className="w-full p-6 rounded-3xl" style={{ backgroundColor: 'rgba(24, 24, 27, 0.8)', border: '1px solid #27272a' }}>
                                       <h3 className="text-[#A1A1AA] font-bold uppercase tracking-widest mb-3">🥈 Subcampeones</h3>
                                       <div className="text-2xl font-semibold text-white">{(tournamentPodium || getTournamentPodium(tournament))!.silver.map(getPlayerName).join(' & ')}</div>
                                    </div>
                                  )}
                                  {(tournamentPodium || getTournamentPodium(tournament))!.bronze.length > 0 && (
                                    <div className="w-full p-5 rounded-2xl" style={{ backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid #27272a' }}>
                                       <h3 className="text-[#b45309] font-bold uppercase tracking-widest mb-2 text-xs">🥉 3er Puesto</h3>
                                       <div className="text-lg font-semibold text-zinc-300">{(tournamentPodium || getTournamentPodium(tournament))!.bronze.map(getPlayerName).join(' & ')}</div>
                                    </div>
                                  )}
                               </div>
                            ) : (
                               <div className="w-full rounded-3xl p-6 shadow-xl w-[90%]" style={{ backgroundColor: 'rgba(24, 24, 27, 0.8)', border: '1px solid #27272a' }}>
                                  <h3 className="text-[#FACC15] font-bold uppercase tracking-widest mb-6 text-center text-lg">Ranking Actual</h3>
                                  <div className="space-y-4">
                                     {standings.slice(0, 6).map((s, i) => (
                                        <div key={s.id} className="flex flex-col pb-3" style={{ borderBottom: '1px solid #27272a' }}>
                                           <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-4">
                                                 <span className="text-2xl font-bold text-[#71717A] w-8">{i + 1}.</span>
                                                 <span className="text-2xl font-semibold text-white">{s.name}</span>
                                              </div>
                                              <span className="text-2xl font-bold text-white">{s.pointsWon} <span className="text-sm text-[#71717A] uppercase">pts</span></span>
                                           </div>
                                           {badges[s.id] && badges[s.id].length > 0 && (
                                              <div className="flex gap-2 mt-2 ml-12">
                                                {badges[s.id].map(b => (
                                                  <span key={b} className="text-xs font-bold text-[#A1A1AA] bg-[#27272a] px-2 py-1 rounded-md uppercase tracking-widest">{b}</span>
                                                ))}
                                              </div>
                                           )}
                                        </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>

                         <div className="text-center pb-6">
                            <p className="font-bold text-lg tracking-widest uppercase" style={{ color: '#52525B' }}>@machospadel</p>
                         </div>
                      </div>
                   </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TournamentPhotos({ tournament, isReadOnly }: { tournament: Tournament, isReadOnly: boolean }) {
  const { updateTournament } = useAppContext();
  const [uploading, setUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRefGallery = useRef<HTMLInputElement>(null);
  const fileInputRefCamera = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { compressImage } = await import('../utils/imageUtils');
      const blob = await compressImage(file, 1200, 1200, 0.8);
      
      const storageRef = ref(storage, `tournament_photos/${tournament.id}/${Date.now()}_img.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      const newPhotos = [...(tournament.photos || []), downloadURL];
      updateTournament({ ...tournament, photos: newPhotos });
      
      // Reset input
      if (event.target) event.target.value = '';
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Hubo un error subiendo la imagen. Por favor, asegúrate de estar autenticado y vuelve a intentarlo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSharePhoto = async (url: string) => {
    try {
      if (url.startsWith('data:image/')) {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Foto del torneo ${tournament.name}`,
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: `Foto del torneo ${tournament.name}`,
          text: '¡Mira esta foto del torneo!',
          url: url // fallback (might fail if URL is too long)
        });
      } else {
        alert("Tu dispositivo no soporta compartir esta imagen directamente.");
      }
    } catch (error) {
      console.error("Error sharing photo:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
         <h3 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-yellow-500" />
            Galería
         </h3>
         {!isReadOnly && (
            <div className="flex gap-2">
               <label 
                  title="Tomar Foto"
                  className={`w-10 h-10 flex flex-col justify-center items-center gap-1 bg-yellow-500 text-black rounded-xl hover:bg-yellow-400 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
               >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
               </label>
               
               <label 
                  title="Subir de Galería"
                  className={`flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-yellow-500 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
               >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
               </label>
            </div>
         )}
      </div>

      {!tournament.photos || tournament.photos.length === 0 ? (
        <div className="text-center py-12 px-4 bg-zinc-900/50 rounded-3xl border border-zinc-800/50">
           <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
           <p className="text-zinc-500 font-medium tracking-wide">No hay fotos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-8">
           {tournament.photos.map((photo, idx) => (
             <div key={idx} className="relative group rounded-2xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800 shadow-xl cursor-pointer" onClick={() => setFullscreenImage(photo)}>
                <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 pointer-events-none">
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleSharePhoto(photo); }}
                     className="bg-yellow-500 text-black p-2 rounded-lg pointer-events-auto shadow-lg hover:bg-yellow-400 focus:bg-yellow-400 active:scale-95 transition-all"
                   >
                     <Share2 className="w-4 h-4" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
           <div className="flex justify-between items-center p-4">
              <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Galería VIP</span>
              <div className="flex gap-4">
                 <button onClick={() => handleSharePhoto(fullscreenImage)} className="text-yellow-500 p-2 hover:bg-zinc-800 rounded-full transition-colors">
                    <Share2 className="w-6 h-6" />
                 </button>
                 <button onClick={() => setFullscreenImage(null)} className="text-zinc-400 p-2 hover:bg-zinc-800 hover:text-white rounded-full transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>
           </div>
           <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
              <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
           </div>
        </div>
      )}
    </div>
  );
}
