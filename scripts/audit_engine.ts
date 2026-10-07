import { 
  generateAmericanoMatches, 
  generateMexicanoMatches, 
  generateKingMatches, 
  calculateStandings, 
  Tournament, 
  Player, 
  Match 
} from '../src/domain/tournament';

interface AmericanoStats {
  players: number;
  courts: number;
  rounds: number;
  maxPlayed: number;
  minPlayed: number;
  diffPlayed: number;
  maxRested: number;
  minRested: number;
  diffRested: number;
  repeatedPartners: number;
  repeatedRivals: number;
  maxConsecutiveRests: number;
  maxConsecutiveMatches: number;
  invariantsPassed: boolean;
  errors: string[];
}

function testAmericano(numPlayers: number, numRounds: number, courtsCount?: number): AmericanoStats {
  const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`
  }));

  const matches = generateAmericanoMatches(players, numRounds, courtsCount);
  const errors: string[] = [];

  // Invariant checks
  const matchIds = new Set<string>();
  const matchesByRound: Record<number, Match[]> = {};

  for (const m of matches) {
    if (matchIds.has(m.id)) {
      errors.push(`Duplicate match ID: ${m.id}`);
    }
    matchIds.add(m.id);

    // Exactly 4 players
    const matchPlayers = [...m.team1, ...m.team2];
    if (matchPlayers.length !== 4) {
      errors.push(`Match ${m.id} has ${matchPlayers.length} players, expected 4`);
    }
    const uniquePlayersInMatch = new Set(matchPlayers);
    if (uniquePlayersInMatch.size !== 4) {
      errors.push(`Match ${m.id} has duplicate players within same match: ${matchPlayers.join(',')}`);
    }

    if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
    matchesByRound[m.round].push(m);
  }

  // Check that no player plays on two courts in the same round
  for (const [roundNum, rMatches] of Object.entries(matchesByRound)) {
    const playersInRound: string[] = [];
    for (const m of rMatches) {
      playersInRound.push(...m.team1, ...m.team2);
    }
    const uniqueInRound = new Set(playersInRound);
    if (uniqueInRound.size !== playersInRound.length) {
      errors.push(`Round ${roundNum} has players appearing in multiple matches simultaneously!`);
    }
  }

  // Play and rest counts
  const matchesPlayed: Record<string, number> = {};
  const restsCount: Record<string, number> = {};
  const consecutiveMatches: Record<string, number> = {};
  const maxConsecutiveMatches: Record<string, number> = {};
  const consecutiveRests: Record<string, number> = {};
  const maxConsecutiveRests: Record<string, number> = {};

  const partnerCount: Record<string, Record<string, number>> = {};
  const rivalCount: Record<string, Record<string, number>> = {};

  players.forEach(p => {
    matchesPlayed[p.id] = 0;
    restsCount[p.id] = 0;
    consecutiveMatches[p.id] = 0;
    maxConsecutiveMatches[p.id] = 0;
    consecutiveRests[p.id] = 0;
    maxConsecutiveRests[p.id] = 0;
    partnerCount[p.id] = {};
    rivalCount[p.id] = {};
  });

  for (let r = 1; r <= numRounds; r++) {
    const roundMatches = matchesByRound[r] || [];
    const playing = new Set<string>();
    for (const m of roundMatches) {
      const [t1a, t1b] = m.team1;
      const [t2a, t2b] = m.team2;
      playing.add(t1a); playing.add(t1b); playing.add(t2a); playing.add(t2b);

      // Track partners
      partnerCount[t1a][t1b] = (partnerCount[t1a][t1b] || 0) + 1;
      partnerCount[t1b][t1a] = (partnerCount[t1b][t1a] || 0) + 1;
      partnerCount[t2a][t2b] = (partnerCount[t2a][t2b] || 0) + 1;
      partnerCount[t2b][t2a] = (partnerCount[t2b][t2a] || 0) + 1;

      // Track rivals
      for (const p1 of m.team1) {
        for (const p2 of m.team2) {
          rivalCount[p1][p2] = (rivalCount[p1][p2] || 0) + 1;
          rivalCount[p2][p1] = (rivalCount[p2][p1] || 0) + 1;
        }
      }
    }

    players.forEach(p => {
      if (playing.has(p.id)) {
        matchesPlayed[p.id]++;
        consecutiveMatches[p.id]++;
        consecutiveRests[p.id] = 0;
        if (consecutiveMatches[p.id] > maxConsecutiveMatches[p.id]) {
          maxConsecutiveMatches[p.id] = consecutiveMatches[p.id];
        }
      } else {
        restsCount[p.id]++;
        consecutiveRests[p.id]++;
        consecutiveMatches[p.id] = 0;
        if (consecutiveRests[p.id] > maxConsecutiveRests[p.id]) {
          maxConsecutiveRests[p.id] = consecutiveRests[p.id];
        }
      }
    });
  }

  const playedVals = Object.values(matchesPlayed);
  const restVals = Object.values(restsCount);

  let repeatedPartners = 0;
  for (const p1 in partnerCount) {
    for (const p2 in partnerCount[p1]) {
      if (p1 < p2 && partnerCount[p1][p2] > 1) {
        repeatedPartners += (partnerCount[p1][p2] - 1);
      }
    }
  }

  let repeatedRivals = 0;
  for (const p1 in rivalCount) {
    for (const p2 in rivalCount[p1]) {
      if (p1 < p2 && rivalCount[p1][p2] > 1) {
        repeatedRivals += (rivalCount[p1][p2] - 1);
      }
    }
  }

  const maxPlayed = Math.max(...playedVals);
  const minPlayed = Math.min(...playedVals);
  const maxRested = Math.max(...restVals);
  const minRested = Math.min(...restVals);

  return {
    players: numPlayers,
    courts: courtsCount || Math.floor(numPlayers / 4),
    rounds: numRounds,
    maxPlayed,
    minPlayed,
    diffPlayed: maxPlayed - minPlayed,
    maxRested,
    minRested,
    diffRested: maxRested - minRested,
    repeatedPartners,
    repeatedRivals,
    maxConsecutiveRests: Math.max(...Object.values(maxConsecutiveRests)),
    maxConsecutiveMatches: Math.max(...Object.values(maxConsecutiveMatches)),
    invariantsPassed: errors.length === 0,
    errors
  };
}

// Run Americano tests for 4 to 16 players
console.log('=== AMERICANO NUMERICAL AUDIT MATRIX ===');
const playerCounts = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const results: AmericanoStats[] = [];

for (const n of playerCounts) {
  const courts = Math.floor(n / 4);
  const rounds = n <= 8 ? 7 : 5;
  const res = testAmericano(n, rounds, courts);
  results.push(res);
}

console.table(results.map(r => ({
  'Players': r.players,
  'Courts': r.courts,
  'Rounds': r.rounds,
  'MaxPlay': r.maxPlayed,
  'MinPlay': r.minPlayed,
  'DiffPlay': r.diffPlayed,
  'MaxRest': r.maxRested,
  'MinRest': r.minRested,
  'DiffRest': r.diffRested,
  'RepPart': r.repeatedPartners,
  'MaxConsecRest': r.maxConsecutiveRests,
  'Invariants': r.invariantsPassed ? 'PASS' : 'FAIL',
  'Errors': r.errors.length
})));
