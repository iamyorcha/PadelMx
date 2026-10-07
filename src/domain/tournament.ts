export interface Player {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  round: number;
  court: number;
  team1: [string, string];
  team2: [string, string];
  score1: number | null;
  score2: number | null;
  isPlayoff?: boolean;
  playoffType?: 'quarterfinal' | 'semifinal' | 'third_place' | 'final';
  serveFirst?: 1 | 2;
}

export interface Tournament {
  id: string;
  name: string;
  type: 'americano' | 'mexicano' | 'king';
  pointsPerMatch: number; // e.g., 24, 32
  players: Player[];
  matches: Match[];
  createdAt: any;
  updatedAt?: any;
  ownerId?: string;
  status?: 'active' | 'completed' | 'draft';
  courtsCount?: number;
  photos?: string[];
  totalCost?: number;
  payments?: Record<string, boolean>; // map of playerId to true if paid
  expenses?: Expense[];
  winnersPhoto?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  playersAppliesTo: string[];
}

export type TournamentState = 'REGULAR' | 'REGULAR_COMPLETED' | 'PLAYOFFS' | 'COMPLETED';

export type PlayoffFormat =
  | 'top4_14v23'
  | 'top4_12v34'
  | 'top8_semis'
  | 'top8_oroplata'
  | 'top16_quarters'
  | 'none';

export interface PlayoffConfig {
  format: PlayoffFormat;
  includeThirdPlaceMatch?: boolean;
}

export interface PlayerFairnessMetric {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  rests: number;
  maxConsecutiveRests: number;
}

export interface FairnessMetrics {
  playerMetrics: Record<string, PlayerFairnessMetric>;
  minMatches: number;
  maxMatches: number;
  matchDifference: number; // maxMatches - minMatches (must be <= 1)
  isMathematicallyFair: boolean;
  totalConsecutiveRests: number;
  maxPartnerRepeats: number;
  maxOpponentRepeats: number;
}

/**
 * Returns the formal lifecycle state of a tournament.
 */
export function getTournamentState(tournament: Tournament): TournamentState {
  if (!tournament || !tournament.matches || tournament.matches.length === 0) {
    return 'REGULAR';
  }

  // Explicit completed status
  if (tournament.status === 'completed') {
    return 'COMPLETED';
  }

  const playoffMatches = tournament.matches.filter(m => m.isPlayoff);
  if (playoffMatches.length > 0) {
    const finalMatch = playoffMatches.find(m => m.playoffType === 'final');
    if (finalMatch && finalMatch.score1 !== null && finalMatch.score2 !== null) {
      return 'COMPLETED';
    }
    return 'PLAYOFFS';
  }

  // Regular matches only
  const allScored = tournament.matches.every(m => m.score1 !== null && m.score2 !== null);
  if (allScored) {
    return 'REGULAR_COMPLETED';
  }

  return 'REGULAR';
}

/**
 * Validates state transitions in the state machine.
 */
export function canTransitionState(from: TournamentState, to: TournamentState): boolean {
  switch (from) {
    case 'REGULAR':
      return to === 'REGULAR_COMPLETED' || to === 'COMPLETED';
    case 'REGULAR_COMPLETED':
      return to === 'REGULAR' || to === 'PLAYOFFS' || to === 'COMPLETED';
    case 'PLAYOFFS':
      return to === 'COMPLETED';
    case 'COMPLETED':
      return false;
    default:
      return false;
  }
}

/**
 * Rule: PLAYOFFS ARE IRREVERSIBLE.
 * Once any playoff match has been generated or initiated, no regular rounds can be added.
 */
export function canAddRegularRounds(tournament: Tournament): { allowed: boolean; reason?: string; suggestedFairRounds?: number } {
  if (tournament.status === 'completed') {
    return { allowed: false, reason: 'El torneo ya está formalmente finalizado.' };
  }

  const hasPlayoffs = tournament.matches.some(m => m.isPlayoff);
  if (hasPlayoffs) {
    return { allowed: false, reason: 'Los playoffs ya comenzaron. No se pueden agregar rondas regulares.' };
  }

  return { allowed: true, suggestedFairRounds: 1 };
}

// ----------------------------------------------------
// FAIRNESS METRICS (PARTE C)
// ----------------------------------------------------

export function matchesPlayed(playerId: string, matches: Match[]): number {
  let count = 0;
  for (const m of matches) {
    if (m.team1.includes(playerId) || m.team2.includes(playerId)) {
      count++;
    }
  }
  return count;
}

export function rests(playerId: string, matches: Match[], totalRounds: number): number {
  const playedRounds = new Set<number>();
  for (const m of matches) {
    if (m.team1.includes(playerId) || m.team2.includes(playerId)) {
      playedRounds.add(m.round);
    }
  }
  return Math.max(0, totalRounds - playedRounds.size);
}

export function consecutiveRests(playerId: string, matches: Match[], totalRounds: number): number {
  const playedRounds = new Set<number>();
  for (const m of matches) {
    if (m.team1.includes(playerId) || m.team2.includes(playerId)) {
      playedRounds.add(m.round);
    }
  }
  let maxConsec = 0;
  let currentConsec = 0;
  for (let r = 1; r <= totalRounds; r++) {
    if (!playedRounds.has(r)) {
      currentConsec++;
      if (currentConsec > maxConsec) {
        maxConsec = currentConsec;
      }
    } else {
      currentConsec = 0;
    }
  }
  return maxConsec;
}

export function timesPartnered(playerA: string, playerB: string, matches: Match[]): number {
  let count = 0;
  for (const m of matches) {
    const isPair1 = (m.team1[0] === playerA && m.team1[1] === playerB) || (m.team1[0] === playerB && m.team1[1] === playerA);
    const isPair2 = (m.team2[0] === playerA && m.team2[1] === playerB) || (m.team2[0] === playerB && m.team2[1] === playerA);
    if (isPair1 || isPair2) {
      count++;
    }
  }
  return count;
}

export function timesOpposed(playerA: string, playerB: string, matches: Match[]): number {
  let count = 0;
  for (const m of matches) {
    const aInTeam1 = m.team1.includes(playerA);
    const bInTeam2 = m.team2.includes(playerB);
    const bInTeam1 = m.team1.includes(playerB);
    const aInTeam2 = m.team2.includes(playerA);
    if ((aInTeam1 && bInTeam2) || (bInTeam1 && aInTeam2)) {
      count++;
    }
  }
  return count;
}

export function calculateFairnessMetrics(
  tournament: { players: Player[]; matches: Match[] },
  totalRounds?: number
): FairnessMetrics {
  const regularMatches = tournament.matches.filter(m => !m.isPlayoff);
  const maxRoundInMatches = regularMatches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = totalRounds || maxRoundInMatches || 1;

  const playerMetrics: Record<string, PlayerFairnessMetric> = {};
  const partnerMatrix: Record<string, Record<string, number>> = {};
  const opponentMatrix: Record<string, Record<string, number>> = {};

  tournament.players.forEach(p => {
    partnerMatrix[p.id] = {};
    opponentMatrix[p.id] = {};
    const played = matchesPlayed(p.id, regularMatches);
    const rCount = rests(p.id, regularMatches, rounds);
    const maxConsec = consecutiveRests(p.id, regularMatches, rounds);

    playerMetrics[p.id] = {
      playerId: p.id,
      playerName: p.name,
      matchesPlayed: played,
      rests: rCount,
      maxConsecutiveRests: maxConsec
    };
  });

  let totalConsecutiveRests = 0;
  Object.values(playerMetrics).forEach(metric => {
    if (metric.maxConsecutiveRests > 1) {
      totalConsecutiveRests += (metric.maxConsecutiveRests - 1);
    }
  });

  let maxPartnerRepeats = 0;
  let maxOpponentRepeats = 0;

  for (let i = 0; i < tournament.players.length; i++) {
    for (let j = i + 1; j < tournament.players.length; j++) {
      const p1 = tournament.players[i].id;
      const p2 = tournament.players[j].id;
      const pCount = timesPartnered(p1, p2, regularMatches);
      const oCount = timesOpposed(p1, p2, regularMatches);
      if (pCount > maxPartnerRepeats) maxPartnerRepeats = pCount;
      if (oCount > maxOpponentRepeats) maxOpponentRepeats = oCount;
    }
  }

  const matchCounts = Object.values(playerMetrics).map(m => m.matchesPlayed);
  const minMatches = matchCounts.length > 0 ? Math.min(...matchCounts) : 0;
  const maxMatches = matchCounts.length > 0 ? Math.max(...matchCounts) : 0;
  const matchDifference = maxMatches - minMatches;

  return {
    playerMetrics,
    minMatches,
    maxMatches,
    matchDifference,
    isMathematicallyFair: matchDifference <= 1,
    totalConsecutiveRests,
    maxPartnerRepeats,
    maxOpponentRepeats
  };
}

export interface MatchingHistory {
  partneredWith: Record<string, Record<string, number>>;
  playedAgainst: Record<string, Record<string, number>>;
  matchesPlayed: Record<string, number>;
  totalRests: Record<string, number>;
  restedInLastRound: Record<string, boolean>;
}

export function buildMatchingHistory(
  players: Player[],
  existingMatches: Match[],
  maxRound: number
): MatchingHistory {
  const playerIds = players.map(p => p.id);
  const history: MatchingHistory = {
    partneredWith: {},
    playedAgainst: {},
    matchesPlayed: {},
    totalRests: {},
    restedInLastRound: {}
  };

  playerIds.forEach(id => {
    history.partneredWith[id] = {};
    history.playedAgainst[id] = {};
    history.matchesPlayed[id] = 0;
    history.totalRests[id] = 0;
    history.restedInLastRound[id] = false;
    playerIds.forEach(otherId => {
      if (id !== otherId) {
        history.partneredWith[id][otherId] = 0;
        history.playedAgainst[id][otherId] = 0;
      }
    });
  });

  const roundPlayingSets: Record<number, Set<string>> = {};
  for (let r = 1; r <= maxRound; r++) {
    roundPlayingSets[r] = new Set();
  }

  for (const m of existingMatches) {
    if (m.isPlayoff) continue;
    const [p1, p2] = m.team1;
    const [p3, p4] = m.team2;

    if (history.partneredWith[p1] && history.partneredWith[p1][p2] !== undefined) {
      history.partneredWith[p1][p2]++;
      history.partneredWith[p2][p1]++;
      history.partneredWith[p3][p4]++;
      history.partneredWith[p4][p3]++;

      const opps = [[p1, p3], [p1, p4], [p2, p3], [p2, p4]];
      opps.forEach(([a, b]) => {
        history.playedAgainst[a][b]++;
        history.playedAgainst[b][a]++;
      });

      history.matchesPlayed[p1]++;
      history.matchesPlayed[p2]++;
      history.matchesPlayed[p3]++;
      history.matchesPlayed[p4]++;

      if (roundPlayingSets[m.round]) {
        roundPlayingSets[m.round].add(p1);
        roundPlayingSets[m.round].add(p2);
        roundPlayingSets[m.round].add(p3);
        roundPlayingSets[m.round].add(p4);
      }
    }
  }

  for (let r = 1; r <= maxRound; r++) {
    const playing = roundPlayingSets[r] || new Set();
    playerIds.forEach(id => {
      if (!playing.has(id)) {
        history.totalRests[id]++;
        if (r === maxRound) {
          history.restedInLastRound[id] = true;
        }
      } else {
        if (r === maxRound) {
          history.restedInLastRound[id] = false;
        }
      }
    });
  }

  return history;
}

/**
 * Core mathematical matching engine executing the strict priority chain:
 * Prioridad 1: Cantidad de partidos jugados (min diff <= 1)
 * Prioridad 2: Cantidad de descansos
 * Prioridad 3: Descansos consecutivos (0 consecutivos siempre que sea matemáticamente posible)
 * Prioridad 4: Parejas repetidas (minimizar repetición de compañeros)
 * Prioridad 5: Rivales repetidos (minimizar repetición de oponentes)
 */
function generateAmericanoRoundsInternal(
  players: Player[],
  roundsToGenerate: number,
  courtsCount: number | undefined,
  startRoundNumber: number,
  initialHistory?: MatchingHistory
): Match[] {
  const numPlayers = players.length;
  if (numPlayers < 4 || roundsToGenerate <= 0) return [];

  const maxMatches = Math.floor(numPlayers / 4);
  const matchesPerRound = courtsCount ? Math.min(maxMatches, courtsCount) : maxMatches;
  const activeSlots = matchesPerRound * 4;
  const playerIds = players.map(p => p.id);

  const history: MatchingHistory = initialHistory || {
    partneredWith: {},
    playedAgainst: {},
    matchesPlayed: {},
    totalRests: {},
    restedInLastRound: {}
  };

  if (!initialHistory) {
    playerIds.forEach(id => {
      history.partneredWith[id] = {};
      history.playedAgainst[id] = {};
      history.matchesPlayed[id] = 0;
      history.totalRests[id] = 0;
      history.restedInLastRound[id] = false;
      playerIds.forEach(otherId => {
        if (id !== otherId) {
          history.partneredWith[id][otherId] = 0;
          history.playedAgainst[id][otherId] = 0;
        }
      });
    });
  }

  const generatedMatches: Match[] = [];

  for (let rIndex = 0; rIndex < roundsToGenerate; rIndex++) {
    const currentRoundNum = startRoundNumber + rIndex;

    // -------------------------------------------------------------------------
    // STEP 1: SELECT ACTIVE PLAYERS STRICTLY ACCORDING TO PRIORITIES 1, 2, 3
    // -------------------------------------------------------------------------
    const candidates = [...playerIds].sort((a, b) => {
      // Prioridad 1: Menor cantidad de partidos jugados
      if (history.matchesPlayed[a] !== history.matchesPlayed[b]) {
        return history.matchesPlayed[a] - history.matchesPlayed[b];
      }
      // Prioridad 2: Mayor cantidad de descansos totales
      if (history.totalRests[a] !== history.totalRests[b]) {
        return history.totalRests[b] - history.totalRests[a];
      }
      // Prioridad 3: Evitar descansos consecutivos. Si descansó en la ronda anterior, TIENE prioridad para jugar
      const aRestedLast = history.restedInLastRound[a] ? 1 : 0;
      const bRestedLast = history.restedInLastRound[b] ? 1 : 0;
      if (aRestedLast !== bRestedLast) {
        return bRestedLast - aRestedLast; // 1 antes que 0
      }
      // Desempate aleatorio controlado
      return Math.random() - 0.5;
    });

    const activePlayerIds = candidates.slice(0, activeSlots);
    const restingPlayerIds = new Set(candidates.slice(activeSlots));

    // -------------------------------------------------------------------------
    // STEP 2: PAIR ACTIVE PLAYERS OPTIMIZING PRIORITIES 4 & 5 (PARTNERS & OPPONENTS)
    // Because activePlayerIds is already strictly fixed, any combination preserves
    // Priorities 1, 2, and 3 with 100% mathematical guarantee.
    // -------------------------------------------------------------------------
    let bestRound: Match[] = [];
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 400; attempt++) {
      const shuffledActive = [...activePlayerIds].sort(() => Math.random() - 0.5);
      let currentScore = 0;
      const roundMatches: Match[] = [];

      for (let m = 0; m < matchesPerRound; m++) {
        const p1 = shuffledActive[m * 4];
        const p2 = shuffledActive[m * 4 + 1];
        const p3 = shuffledActive[m * 4 + 2];
        const p4 = shuffledActive[m * 4 + 3];

        // Prioridad 4: Penalizar compañeros repetidos cuadráticamente
        const part1 = history.partneredWith[p1]?.[p2] || 0;
        const part2 = history.partneredWith[p3]?.[p4] || 0;
        currentScore += (part1 * 1000 + (part1 > 1 ? 5000 : 0));
        currentScore += (part2 * 1000 + (part2 > 1 ? 5000 : 0));

        // Prioridad 5: Penalizar oponentes repetidos
        const opp1 = history.playedAgainst[p1]?.[p3] || 0;
        const opp2 = history.playedAgainst[p1]?.[p4] || 0;
        const opp3 = history.playedAgainst[p2]?.[p3] || 0;
        const opp4 = history.playedAgainst[p2]?.[p4] || 0;
        currentScore += (opp1 + opp2 + opp3 + opp4) * 10;

        roundMatches.push({
          id: Math.random().toString(36).slice(2, 9),
          round: currentRoundNum,
          court: m + 1,
          team1: [p1, p2],
          team2: [p3, p4],
          score1: null,
          score2: null,
          serveFirst: Math.random() > 0.5 ? 1 : 2
        });
      }

      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestRound = roundMatches;
        if (bestScore === 0) break;
      }
    }

    // -------------------------------------------------------------------------
    // STEP 3: UPDATE RUNNING HISTORY FOR NEXT ROUND
    // -------------------------------------------------------------------------
    for (const match of bestRound) {
      const [p1, p2] = match.team1;
      const [p3, p4] = match.team2;

      history.partneredWith[p1][p2] = (history.partneredWith[p1][p2] || 0) + 1;
      history.partneredWith[p2][p1] = (history.partneredWith[p2][p1] || 0) + 1;
      history.partneredWith[p3][p4] = (history.partneredWith[p3][p4] || 0) + 1;
      history.partneredWith[p4][p3] = (history.partneredWith[p4][p3] || 0) + 1;

      const opps = [[p1, p3], [p1, p4], [p2, p3], [p2, p4]];
      opps.forEach(([a, b]) => {
        history.playedAgainst[a][b] = (history.playedAgainst[a][b] || 0) + 1;
        history.playedAgainst[b][a] = (history.playedAgainst[b][a] || 0) + 1;
      });

      [p1, p2, p3, p4].forEach(p => {
        history.matchesPlayed[p] = (history.matchesPlayed[p] || 0) + 1;
        history.restedInLastRound[p] = false;
      });
    }

    restingPlayerIds.forEach(p => {
      history.totalRests[p] = (history.totalRests[p] || 0) + 1;
      history.restedInLastRound[p] = true;
    });

    generatedMatches.push(...bestRound);
  }

  return generatedMatches;
}

export function generateAmericanoMatches(players: Player[], roundsCount: number, courtsCount?: number): Match[] {
  return generateAmericanoRoundsInternal(players, roundsCount, courtsCount, 1);
}

/**
 * Generates additional regular rounds for an Americano tournament while strictly preserving
 * all previous match history, ensuring uninterrupted fairness across all rounds.
 */
export function generateAdditionalAmericanoRounds(
  tournament: Tournament,
  additionalRoundsCount: number
): Match[] {
  const allowed = canAddRegularRounds(tournament);
  if (!allowed.allowed) {
    throw new Error(allowed.reason || 'No se pueden agregar rondas en el estado actual.');
  }

  const regularMatches = tournament.matches.filter(m => !m.isPlayoff);
  const maxRound = regularMatches.reduce((max, m) => Math.max(max, m.round), 0);
  const history = buildMatchingHistory(tournament.players, regularMatches, maxRound);

  return generateAmericanoRoundsInternal(
    tournament.players,
    additionalRoundsCount,
    tournament.courtsCount,
    maxRound + 1,
    history
  );
}

export interface PlayerStats {
  id: string;
  name: string;
  matchesPlayed: number;
  pointsWon: number;
  pointsDifference: number; // points won - points lost
  wins: number;
  losses: number;
  draws: number;
  tieBreakReason?: string;
}

export function calculateStandings(tournament: Tournament): PlayerStats[] {
  const statsMap: Record<string, PlayerStats> = {};

  for (const player of tournament.players) {
    statsMap[player.id] = {
      id: player.id,
      name: player.name,
      matchesPlayed: 0,
      pointsWon: 0,
      pointsDifference: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
  }

  for (const match of tournament.matches) {
    if (match.score1 !== null && match.score2 !== null) {
      const isTeam1Win = match.score1 > match.score2;
      const isTeam2Win = match.score2 > match.score1;
      const isDraw = match.score1 === match.score2;

      // Update Team 1
      for (const pId of match.team1) {
        if (!statsMap[pId]) continue;
        statsMap[pId].matchesPlayed++;
        statsMap[pId].pointsWon += match.score1;
        statsMap[pId].pointsDifference += (match.score1 - match.score2);
        if (isTeam1Win) statsMap[pId].wins++;
        else if (isTeam2Win) statsMap[pId].losses++;
        else if (isDraw) statsMap[pId].draws++;
      }

      // Update Team 2
      for (const pId of match.team2) {
        if (!statsMap[pId]) continue;
        statsMap[pId].matchesPlayed++;
        statsMap[pId].pointsWon += match.score2;
        statsMap[pId].pointsDifference += (match.score2 - match.score1);
        if (isTeam2Win) statsMap[pId].wins++;
        else if (isTeam1Win) statsMap[pId].losses++;
        else if (isDraw) statsMap[pId].draws++;
      }
    }
  }

  const sorted = Object.values(statsMap).sort((a, b) => {
    if (b.pointsWon !== a.pointsWon) return b.pointsWon - a.pointsWon;
    if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  // Calculate tie-break explanation for players tied in points
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    const next = sorted[i + 1];

    if (prev && prev.pointsWon === current.pointsWon) {
      if (prev.pointsDifference !== current.pointsDifference) {
        current.tieBreakReason = `Diferencia de puntos (${current.pointsDifference > 0 ? '+' : ''}${current.pointsDifference} vs ${prev.pointsDifference > 0 ? '+' : ''}${prev.pointsDifference})`;
      } else if (prev.wins !== current.wins) {
        current.tieBreakReason = `Victorias (${current.wins} vs ${prev.wins})`;
      } else if (prev.losses !== current.losses) {
        current.tieBreakReason = `Menor cantidad de derrotas (${current.losses} vs ${prev.losses})`;
      } else {
        current.tieBreakReason = 'Criterio alfabético / ID';
      }
    } else if (next && next.pointsWon === current.pointsWon) {
      if (current.pointsDifference !== next.pointsDifference) {
        current.tieBreakReason = `Diferencia de puntos (${current.pointsDifference > 0 ? '+' : ''}${current.pointsDifference} vs ${next.pointsDifference > 0 ? '+' : ''}${next.pointsDifference})`;
      } else if (current.wins !== next.wins) {
        current.tieBreakReason = `Victorias (${current.wins} vs ${next.wins})`;
      } else if (current.losses !== next.losses) {
        current.tieBreakReason = `Menor cantidad de derrotas (${current.losses} vs ${next.losses})`;
      } else {
        current.tieBreakReason = 'Criterio alfabético / ID';
      }
    }
  }

  return sorted;
}

/**
 * Checks if a tournament is formally completed.
 * Central single source of truth across the entire app.
 */
export function isTournamentCompleted(tournament: Tournament): boolean {
  if (!tournament || !tournament.matches || tournament.matches.length === 0) {
    return false;
  }

  // Explicit completion flag from owner
  if (tournament.status === 'completed') {
    return tournament.matches.some(m => m.score1 !== null && m.score2 !== null);
  }

  // If there is a final playoff match
  const finalMatch = tournament.matches.find(m => m.isPlayoff && m.playoffType === 'final');
  if (finalMatch) {
    return finalMatch.score1 !== null && finalMatch.score2 !== null;
  }

  // If there are ongoing playoff matches (quarters, semis) without a final yet, it is not completed
  const hasPlayoffs = tournament.matches.some(m => m.isPlayoff);
  if (hasPlayoffs) {
    return false;
  }

  // Regular matches only: completed if all matches have scores recorded
  const regularMatches = tournament.matches.filter(m => !m.isPlayoff);
  if (regularMatches.length === 0) return false;
  return regularMatches.every(m => m.score1 !== null && m.score2 !== null);
}

/**
 * Computes official tournament podium (gold, silver, bronze) based on completion.
 * Correctly accounts for playoff championship match results!
 */
export function getTournamentPodium(tournament: Tournament): { gold: string[]; silver: string[]; bronze: string[] } | null {
  if (!isTournamentCompleted(tournament)) {
    return null;
  }

  const finalMatch = tournament.matches.find(m => m.isPlayoff && m.playoffType === 'final');
  if (finalMatch && finalMatch.score1 !== null && finalMatch.score2 !== null) {
    const isTeam1Win = finalMatch.score1 > finalMatch.score2;
    const gold = isTeam1Win ? [...finalMatch.team1] : [...finalMatch.team2];
    const silver = isTeam1Win ? [...finalMatch.team2] : [...finalMatch.team1];
    
    let bronze: string[] = [];
    const thirdMatch = tournament.matches.find(m => m.isPlayoff && m.playoffType === 'third_place');
    if (thirdMatch && thirdMatch.score1 !== null && thirdMatch.score2 !== null) {
      bronze = thirdMatch.score1 > thirdMatch.score2 ? [...thirdMatch.team1] : [...thirdMatch.team2];
    } else {
      // If no 3rd place match was played, check semifinal losers
      const semiMatches = tournament.matches.filter(m => m.isPlayoff && m.playoffType === 'semifinal');
      if (semiMatches.length > 0 && semiMatches.every(m => m.score1 !== null && m.score2 !== null)) {
        const losers: string[] = [];
        semiMatches.forEach(sm => {
          if (sm.score1 !== null && sm.score2 !== null) {
            const smLosers = sm.score1 > sm.score2 ? sm.team2 : sm.team1;
            losers.push(...smLosers);
          }
        });
        bronze = losers;
      } else {
        const standings = calculateStandings(tournament);
        const podiumSet = new Set([...gold, ...silver]);
        bronze = standings.filter(p => !podiumSet.has(p.id)).slice(0, 2).map(p => p.id);
      }
    }

    return { gold, silver, bronze };
  }

  // For tournaments without playoff finals, podium comes from standings
  const standings = calculateStandings(tournament);
  if (standings.length === 0) return null;

  return {
    gold: standings.length > 0 ? [standings[0].id] : [],
    silver: standings.length > 1 ? [standings[1].id] : [],
    bronze: standings.length > 2 ? [standings[2].id] : []
  };
}

// ----------------------------------------------------
// PLAYOFF GENERATION ENGINE (PARTE H, I, K, L, M)
// ----------------------------------------------------

export function generatePlayoffMatches(
  tournament: Tournament,
  format: PlayoffFormat,
  options?: { includeThirdPlaceMatch?: boolean }
): Match[] {
  const standings = calculateStandings(tournament);
  const regularMatches = tournament.matches.filter(m => !m.isPlayoff);
  const maxRegularRound = regularMatches.reduce((max, m) => Math.max(max, m.round), 0);
  const playoffRound = maxRegularRound + 1;

  if (format === 'none') {
    return [];
  }

  // TOP 4 - FINAL DIRECTA (1&4 vs 2&3)
  if (format === 'top4_14v23' || format === 'top4_12v34') {
    if (standings.length < 4) {
      throw new Error('Se necesitan al menos 4 jugadores para una final de Top 4.');
    }
    const [p1, p2, p3, p4] = standings.slice(0, 4).map(s => s.id);
    const team1: [string, string] = format === 'top4_14v23' ? [p1, p4] : [p1, p2];
    const team2: [string, string] = format === 'top4_14v23' ? [p2, p3] : [p3, p4];

    return [{
      id: `playoff-final-${Math.random().toString(36).slice(2, 8)}`,
      round: playoffRound,
      court: 1,
      team1,
      team2,
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'final',
      serveFirst: 1
    }];
  }

  // TOP 8 - ORO Y PLATA
  if (format === 'top8_oroplata') {
    if (standings.length < 8) {
      throw new Error('Se necesitan al menos 8 jugadores para Finales Oro y Plata.');
    }
    const [p1, p2, p3, p4, p5, p6, p7, p8] = standings.slice(0, 8).map(s => s.id);

    return [
      {
        id: `playoff-final-oro-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 1,
        team1: [p1, p4],
        team2: [p2, p3],
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'final',
        serveFirst: 1
      },
      {
        id: `playoff-final-plata-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 2,
        team1: [p5, p8],
        team2: [p6, p7],
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'third_place',
        serveFirst: 1
      }
    ];
  }

  // TOP 8 - PLAYOFFS CON SEMIFINALES
  // Parejas equilibradas (Suma 9): 1+8 vs 4+5, 2+7 vs 3+6
  if (format === 'top8_semis') {
    if (standings.length < 8) {
      throw new Error('Se necesitan al menos 8 jugadores para Semifinales.');
    }
    const [p1, p2, p3, p4, p5, p6, p7, p8] = standings.slice(0, 8).map(s => s.id);

    return [
      {
        id: `playoff-semi-1-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 1,
        team1: [p1, p8],
        team2: [p4, p5],
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'semifinal',
        serveFirst: 1
      },
      {
        id: `playoff-semi-2-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 2,
        team1: [p2, p7],
        team2: [p3, p6],
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'semifinal',
        serveFirst: 1
      }
    ];
  }

  // TOP 16 - CUARTOS DE FINAL
  // Parejas equilibradas (Suma 17): 1+16 vs 8+9, 4+13 vs 5+12, 2+15 vs 7+10, 3+14 vs 6+11
  if (format === 'top16_quarters') {
    if (standings.length < 16) {
      throw new Error('Se necesitan al menos 16 jugadores para Cuartos de Final.');
    }
    const p = standings.slice(0, 16).map(s => s.id);

    return [
      {
        id: `playoff-qf-1-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 1,
        team1: [p[0], p[15]], // 1 + 16
        team2: [p[7], p[8]],  // 8 + 9
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'quarterfinal',
        serveFirst: 1
      },
      {
        id: `playoff-qf-2-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 2,
        team1: [p[3], p[12]], // 4 + 13
        team2: [p[4], p[11]], // 5 + 12
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'quarterfinal',
        serveFirst: 1
      },
      {
        id: `playoff-qf-3-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 3,
        team1: [p[1], p[14]], // 2 + 15
        team2: [p[6], p[9]],  // 7 + 10
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'quarterfinal',
        serveFirst: 1
      },
      {
        id: `playoff-qf-4-${Math.random().toString(36).slice(2, 8)}`,
        round: playoffRound,
        court: 4,
        team1: [p[2], p[13]], // 3 + 14
        team2: [p[5], p[10]], // 6 + 11
        score1: null,
        score2: null,
        isPlayoff: true,
        playoffType: 'quarterfinal',
        serveFirst: 1
      }
    ];
  }

  return [];
}

/**
 * Generates Semifinals from completed Quarterfinal matches.
 */
export function generateSemisFromQuarters(tournament: Tournament): Match[] {
  const quarters = tournament.matches.filter(m => m.isPlayoff && m.playoffType === 'quarterfinal');
  if (quarters.length < 4) {
    throw new Error('Se requieren 4 partidos de cuartos de final.');
  }

  for (const q of quarters) {
    if (q.score1 === null || q.score2 === null || q.score1 === q.score2) {
      throw new Error('Todos los partidos de cuartos de final deben tener un ganador registrado.');
    }
  }

  const qf1Winner = quarters[0].score1! > quarters[0].score2! ? quarters[0].team1 : quarters[0].team2;
  const qf2Winner = quarters[1].score1! > quarters[1].score2! ? quarters[1].team1 : quarters[1].team2;
  const qf3Winner = quarters[2].score1! > quarters[2].score2! ? quarters[2].team1 : quarters[2].team2;
  const qf4Winner = quarters[3].score1! > quarters[3].score2! ? quarters[3].team1 : quarters[3].team2;

  const currentMaxRound = tournament.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const semiRound = currentMaxRound + 1;

  return [
    {
      id: `playoff-semi-1-${Math.random().toString(36).slice(2, 8)}`,
      round: semiRound,
      court: 1,
      team1: [...qf1Winner] as [string, string],
      team2: [...qf2Winner] as [string, string],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'semifinal',
      serveFirst: 1
    },
    {
      id: `playoff-semi-2-${Math.random().toString(36).slice(2, 8)}`,
      round: semiRound,
      court: 2,
      team1: [...qf3Winner] as [string, string],
      team2: [...qf4Winner] as [string, string],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'semifinal',
      serveFirst: 1
    }
  ];
}

/**
 * Generates Final and optional 3rd place match from completed Semifinals.
 */
export function generateFinalsFromSemis(
  tournament: Tournament,
  includeThirdPlace: boolean = true
): Match[] {
  const semis = tournament.matches.filter(m => m.isPlayoff && m.playoffType === 'semifinal');
  if (semis.length < 2) {
    throw new Error('Se requieren 2 semifinales para generar la final.');
  }

  for (const s of semis) {
    if (s.score1 === null || s.score2 === null || s.score1 === s.score2) {
      throw new Error('Todas las semifinales deben tener un ganador registrado.');
    }
  }

  const s1Winner = semis[0].score1! > semis[0].score2! ? semis[0].team1 : semis[0].team2;
  const s1Loser = semis[0].score1! > semis[0].score2! ? semis[0].team2 : semis[0].team1;

  const s2Winner = semis[1].score1! > semis[1].score2! ? semis[1].team1 : semis[1].team2;
  const s2Loser = semis[1].score1! > semis[1].score2! ? semis[1].team2 : semis[1].team1;

  const currentMaxRound = tournament.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const finalRound = currentMaxRound + 1;

  const results: Match[] = [
    {
      id: `playoff-final-${Math.random().toString(36).slice(2, 8)}`,
      round: finalRound,
      court: 1,
      team1: [...s1Winner] as [string, string],
      team2: [...s2Winner] as [string, string],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'final',
      serveFirst: 1
    }
  ];

  if (includeThirdPlace) {
    results.push({
      id: `playoff-bronze-${Math.random().toString(36).slice(2, 8)}`,
      round: finalRound,
      court: 2,
      team1: [...s1Loser] as [string, string],
      team2: [...s2Loser] as [string, string],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'third_place',
      serveFirst: 1
    });
  }

  return results;
}

/**
 * Mexicano Logic
 * In Mexicano, players are paired based on their current standings.
 * After each round, players are re-ranked and assigned to courts.
 * Court 1: 1st, 4th vs 2nd, 3rd (Classic balanced pairing)
 */
export function generateMexicanoMatches(tournament: Tournament, roundIndex: number): Match[] {
  const { players, matches, courtsCount = 1 } = tournament;
  const numPlayers = players.length;
  if (numPlayers < 4) return [];

  const maxPossibleMatches = Math.floor(numPlayers / 4);
  const matchesToGenerate = Math.min(maxPossibleMatches, courtsCount);

  // If it's the first round, pairings are random (like Americano)
  if (roundIndex === 0) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newMatches: Match[] = [];
    for (let i = 0; i < matchesToGenerate; i++) {
      newMatches.push({
        id: Math.random().toString(36).slice(2, 9),
        round: 1,
        court: i + 1,
        team1: [shuffled[i * 4].id, shuffled[i * 4 + 1].id],
        team2: [shuffled[i * 4 + 2].id, shuffled[i * 4 + 3].id],
        score1: null,
        score2: null,
        serveFirst: Math.random() > 0.5 ? 1 : 2
      });
    }
    return newMatches;
  }

  // Subsequent rounds depend on current standings
  const standings = calculateStandings(tournament);
  
  // Handle resting players fairly: prioritize players who have played fewer matches
  const playersNeeded = matchesToGenerate * 4;
  let activeStandings = [...standings];
  
  if (standings.length > playersNeeded) {
    const sortedByParticipation = [...standings].sort((a, b) => {
      if (a.matchesPlayed !== b.matchesPlayed) return a.matchesPlayed - b.matchesPlayed;
      if (b.pointsWon !== a.pointsWon) return b.pointsWon - a.pointsWon;
      return b.pointsDifference - a.pointsDifference;
    });
    const selectedActive = sortedByParticipation.slice(0, playersNeeded);
    activeStandings = selectedActive.sort((a, b) => {
      if (b.pointsWon !== a.pointsWon) return b.pointsWon - a.pointsWon;
      if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
      return b.wins - a.wins;
    });
  }

  // Count past partnerships to avoid repeating partners within the court group
  const partnerCount: Record<string, Record<string, number>> = {};
  tournament.matches.forEach(m => {
    if (m.score1 !== null && m.score2 !== null) {
      const [t1a, t1b] = m.team1;
      const [t2a, t2b] = m.team2;
      partnerCount[t1a] = partnerCount[t1a] || {};
      partnerCount[t1a][t1b] = (partnerCount[t1a][t1b] || 0) + 1;
      partnerCount[t1b] = partnerCount[t1b] || {};
      partnerCount[t1b][t1a] = (partnerCount[t1b][t1a] || 0) + 1;
      partnerCount[t2a] = partnerCount[t2a] || {};
      partnerCount[t2a][t2b] = (partnerCount[t2a][t2b] || 0) + 1;
      partnerCount[t2b] = partnerCount[t2b] || {};
      partnerCount[t2b][t2a] = (partnerCount[t2b][t2a] || 0) + 1;
    }
  });

  const nextMatches: Match[] = [];

  for (let i = 0; i < matchesToGenerate; i++) {
    const base = i * 4;
    if (activeStandings.length < base + 4) break;

    const p1 = activeStandings[base].id;
    const p2 = activeStandings[base + 1].id;
    const p3 = activeStandings[base + 2].id;
    const p4 = activeStandings[base + 3].id;

    // Default Mexicano: 1&4 vs 2&3
    let team1: [string, string] = [p1, p4];
    let team2: [string, string] = [p2, p3];

    // If 1&4 have already partnered, try alternating combinations within this court
    const times14 = partnerCount[p1]?.[p4] || 0;
    const times13 = partnerCount[p1]?.[p3] || 0;
    const times12 = partnerCount[p1]?.[p2] || 0;

    if (times14 > 0 && times13 < times14) {
      team1 = [p1, p3];
      team2 = [p2, p4];
    } else if (times14 > 0 && times12 < times14) {
      team1 = [p1, p2];
      team2 = [p3, p4];
    }

    nextMatches.push({
      id: Math.random().toString(36).slice(2, 9),
      round: roundIndex + 1,
      court: i + 1,
      team1,
      team2,
      score1: null,
      score2: null,
      serveFirst: Math.random() > 0.5 ? 1 : 2
    });
  }

  return nextMatches;
}

/**
 * Rey de la Cancha (King of the Hill) Logic
 * In this mode, winners move up (to a lower court number) and losers move down.
 * Court 1 is the "King" court.
 */
export function generateKingMatches(tournament: Tournament, roundIndex: number): Match[] {
  const { players, matches, courtsCount = 1 } = tournament;
  const numPlayers = players.length;
  if (numPlayers < 4) return [];

  const maxPossibleMatches = Math.floor(numPlayers / 4);
  const matchesToGenerate = Math.min(maxPossibleMatches, courtsCount);

  // If it's the first round, pairings are random
  if (roundIndex === 0) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newMatches: Match[] = [];
    for (let i = 0; i < matchesToGenerate; i++) {
      newMatches.push({
        id: Math.random().toString(36).slice(2, 9),
        round: 1,
        court: i + 1,
        team1: [shuffled[i * 4].id, shuffled[i * 4 + 1].id],
        team2: [shuffled[i * 4 + 2].id, shuffled[i * 4 + 3].id],
        score1: null,
        score2: null,
        serveFirst: Math.random() > 0.5 ? 1 : 2
      });
    }
    return newMatches;
  }

  // Subsequent rounds depend on previous round results
  const prevRoundMatches = matches.filter(m => m.round === roundIndex);
  if (prevRoundMatches.length === 0) return [];

  // Count total matches played by each player across the tournament
  const matchesCount: Record<string, number> = {};
  players.forEach(p => { matchesCount[p.id] = 0; });
  matches.forEach(m => {
    if (m.score1 !== null && m.score2 !== null) {
      [...m.team1, ...m.team2].forEach(id => {
        matchesCount[id] = (matchesCount[id] || 0) + 1;
      });
    }
  });

  // Group winners and losers
  const courtResults: Record<number, { winners: string[], losers: string[] }> = {};
  prevRoundMatches.forEach(m => {
    if (m.score1 === null || m.score2 === null) return;
    if (m.score1 > m.score2) {
      courtResults[m.court] = { winners: [...m.team1], losers: [...m.team2] };
    } else if (m.score2 > m.score1) {
      courtResults[m.court] = { winners: [...m.team2], losers: [...m.team1] };
    } else {
      // Deterministic tie-breaker in King of the Court
      if (m.serveFirst === 1) {
        courtResults[m.court] = { winners: [...m.team1], losers: [...m.team2] };
      } else {
        courtResults[m.court] = { winners: [...m.team2], losers: [...m.team1] };
      }
    }
  });

  // Track resting players to rotate them in (prioritize those who played fewest matches)
  const prevRoundPlaying = new Set(prevRoundMatches.flatMap(m => [...m.team1, ...m.team2]));
  const restingPlayers = players
    .filter(p => !prevRoundPlaying.has(p.id))
    .map(p => p.id)
    .sort((a, b) => matchesCount[a] - matchesCount[b]);

  // Single court (4 players) case
  if (matchesToGenerate === 1) {
    const c1 = courtResults[1];
    if (!c1 || c1.winners.length < 2 || c1.losers.length < 2) return [];

    let t1: [string, string];
    let t2: [string, string];

    if (restingPlayers.length > 0) {
      // Sort losers so the one who played MORE matches rests first
      c1.losers.sort((a, b) => matchesCount[b] - matchesCount[a]);
      const restedIn = restingPlayers.slice(0, 2);
      if (restedIn.length === 1) {
        // One resting player enters, loser with lowest match count stays, loser with higher match count rests
        t1 = [c1.winners[0], restedIn[0]];
        t2 = [c1.winners[1], c1.losers[1]]; // c1.losers[1] has fewer matches played than c1.losers[0]
      } else {
        t1 = [c1.winners[0], restedIn[0]];
        t2 = [c1.winners[1], restedIn[1]];
      }
    } else {
      // Winners split and each pairs with one of the losers
      t1 = [c1.winners[0], c1.losers[0]];
      t2 = [c1.winners[1], c1.losers[1]];
    }

    return [{
      id: Math.random().toString(36).slice(2, 9),
      round: roundIndex + 1,
      court: 1,
      team1: t1,
      team2: t2,
      score1: null,
      score2: null,
      serveFirst: Math.random() > 0.5 ? 1 : 2
    }];
  }

  // Multiple courts
  const nextMatches: Match[] = [];

  for (let c = 1; c <= matchesToGenerate; c++) {
    let t1: string[] = [];
    let t2: string[] = [];

    if (c === 1) {
      // Court 1: Winners of Court 1 stay, Winners of Court 2 move up
      const w1 = courtResults[1]?.winners || [];
      const w2 = courtResults[2]?.winners || [];
      if (w1.length >= 2 && w2.length >= 2) {
        t1 = [w1[0], w2[0]];
        t2 = [w1[1], w2[1]];
      }
    } else if (c === matchesToGenerate) {
      // Last court: Losers of previous court move down.
      // If there are resting players, they enter the lowest court and losers rest.
      const lPrev = courtResults[c - 1]?.losers || [];
      const lLast = courtResults[c]?.losers || [];
      lLast.sort((a, b) => matchesCount[a] - matchesCount[b]); // Fewest matches stay in front
      
      if (restingPlayers.length > 0) {
        const substitutePlayers = [...restingPlayers, ...lLast];
        t1 = [lPrev[0], substitutePlayers[0]];
        t2 = [lPrev[1], substitutePlayers[1]];
      } else {
        t1 = [lLast[0], lPrev[0]];
        t2 = [lLast[1], lPrev[1]];
      }
    } else {
      // Middle court: Losers of Court C-1 move down, Winners of Court C+1 move up
      const wNext = courtResults[c + 1]?.winners || [];
      const lPrev = courtResults[c - 1]?.losers || [];
      t1 = [wNext[0], lPrev[0]];
      t2 = [wNext[1], lPrev[1]];
    }

    // Fallback validation
    if (t1.length < 2 || t2.length < 2 || t1.includes(undefined!) || t2.includes(undefined!)) {
      return []; 
    }

    nextMatches.push({
      id: Math.random().toString(36).slice(2, 9),
      round: roundIndex + 1,
      court: c,
      team1: [t1[0], t1[1]],
      team2: [t2[0], t2[1]],
      score1: null,
      score2: null,
      serveFirst: Math.random() > 0.5 ? 1 : 2
    });
  }

  return nextMatches;
}

export function normalizeTournament(raw: any): Tournament {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'invalid-id',
      name: 'Torneo sin nombre',
      type: 'americano',
      pointsPerMatch: 32,
      players: [],
      matches: [],
      createdAt: new Date(),
      status: 'active'
    };
  }

  const id = typeof raw.id === 'string' && raw.id ? raw.id : 'tourney-' + Math.random().toString(36).slice(2, 9);
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'Torneo Americano';
  const type = ['americano', 'mexicano', 'king'].includes(raw.type) ? raw.type : 'americano';
  const pointsPerMatch = typeof raw.pointsPerMatch === 'number' && raw.pointsPerMatch > 0 ? raw.pointsPerMatch : 32;
  const status = ['active', 'completed', 'draft'].includes(raw.status) ? raw.status : 'active';
  
  // Sanitize players
  const rawPlayers = Array.isArray(raw.players) ? raw.players : [];
  const players: Player[] = rawPlayers
    .filter((p: any) => p && typeof p === 'object')
    .map((p: any, idx: number) => ({
      id: typeof p.id === 'string' && p.id ? p.id : `player-${idx + 1}`,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : `Jugador ${idx + 1}`
    }));

  // Sanitize matches
  const rawMatches = Array.isArray(raw.matches) ? raw.matches : [];
  const matches: Match[] = rawMatches
    .filter((m: any) => m && typeof m === 'object')
    .map((m: any, idx: number) => {
      const team1 = Array.isArray(m.team1) && m.team1.length >= 2 ? [String(m.team1[0]), String(m.team1[1])] as [string, string] : ['p1', 'p2'] as [string, string];
      const team2 = Array.isArray(m.team2) && m.team2.length >= 2 ? [String(m.team2[0]), String(m.team2[1])] as [string, string] : ['p3', 'p4'] as [string, string];
      const matchObj: Match = {
        id: typeof m.id === 'string' && m.id ? m.id : `match-${idx + 1}`,
        round: typeof m.round === 'number' && m.round > 0 ? m.round : 1,
        court: typeof m.court === 'number' && m.court > 0 ? m.court : 1,
        team1,
        team2,
        score1: typeof m.score1 === 'number' && !isNaN(m.score1) ? m.score1 : null,
        score2: typeof m.score2 === 'number' && !isNaN(m.score2) ? m.score2 : null,
        isPlayoff: Boolean(m.isPlayoff)
      };
      if (m.playoffType && ['quarterfinal', 'semifinal', 'third_place', 'final'].includes(m.playoffType)) {
        matchObj.playoffType = m.playoffType;
      }
      if (m.serveFirst === 1 || m.serveFirst === 2) {
        matchObj.serveFirst = m.serveFirst;
      }
      return matchObj;
    });

  const normalized: Tournament = {
    ...raw,
    id,
    name,
    type,
    pointsPerMatch,
    players,
    matches,
    status,
    photos: Array.isArray(raw.photos) ? raw.photos.filter((url: any) => typeof url === 'string') : [],
    payments: typeof raw.payments === 'object' && raw.payments ? raw.payments : {},
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    createdAt: raw.createdAt || new Date(),
    updatedAt: raw.updatedAt || new Date()
  };

  if (typeof raw.ownerId === 'string' && raw.ownerId) normalized.ownerId = raw.ownerId;
  else delete normalized.ownerId;

  if (typeof raw.courtsCount === 'number' && !isNaN(raw.courtsCount)) normalized.courtsCount = raw.courtsCount;
  else delete normalized.courtsCount;

  if (typeof raw.totalCost === 'number' && !isNaN(raw.totalCost)) normalized.totalCost = raw.totalCost;
  else delete normalized.totalCost;

  if (typeof raw.winnersPhoto === 'string' && raw.winnersPhoto) normalized.winnersPhoto = raw.winnersPhoto;
  else delete normalized.winnersPhoto;

  return normalized;
}
