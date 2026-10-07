import { 
  generateAmericanoMatches, 
  generateMexicanoMatches, 
  generateKingMatches, 
  calculateStandings, 
  Tournament, 
  Player, 
  Match 
} from '../src/domain/tournament';

console.log('====================================================');
console.log('STARTING COMPREHENSIVE ADVERSARIAL AUDIT TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
  } else {
    failedTests++;
    const msg = `FAIL: [${testName}] ${detail || ''}`;
    failureDetails.push(msg);
    console.error(`❌ ${msg}`);
  }
}

// ----------------------------------------------------
// 1. TIE BREAKER DETERMINISM TEST
// ----------------------------------------------------
console.log('--- 1. Testing Standings Deterministic Tie-Breaking ---');
{
  const players: Player[] = [
    { id: 'p1', name: 'Carlos' },
    { id: 'p2', name: 'Alberto' },
    { id: 'p3', name: 'Bernardo' },
    { id: 'p4', name: 'David' }
  ];

  // Identical stats tournament (no matches played yet)
  const tourney: Tournament = {
    id: 't_tie',
    name: 'Tie Test',
    type: 'mexicano',
    pointsPerMatch: 24,
    players,
    matches: [],
    createdAt: new Date()
  };

  const standings1 = calculateStandings(tourney);
  const standings2 = calculateStandings(tourney);

  const order1 = standings1.map(s => s.id).join(',');
  const order2 = standings2.map(s => s.id).join(',');

  assert(order1 === order2, 'Deterministic order on identical stats');
  // Check if tie breaker breaks alphabetically or consistently
  console.log('Tie breaker order on identical stats:', standings1.map(s => `${s.name}(${s.id})`).join(' > '));
}

// ----------------------------------------------------
// 2. MEXICANO EXTENSIVE SIMULATIONS
// ----------------------------------------------------
console.log('\n--- 2. Testing Mexicano Across Multiple Rondas & Player Counts ---');
const mexPlayerCounts = [4, 5, 6, 7, 8, 9, 10, 12, 16];
const mexResults: any[] = [];

for (const n of mexPlayerCounts) {
  const courts = Math.max(1, Math.floor(n / 4));
  const players: Player[] = Array.from({ length: n }, (_, i) => ({
    id: `p_${i + 1}`,
    name: `Jugador ${i + 1}`
  }));

  const tournament: Tournament = {
    id: `mex_${n}`,
    name: `Mexicano ${n}`,
    type: 'mexicano',
    pointsPerMatch: 24,
    players,
    matches: [],
    courtsCount: courts,
    createdAt: new Date()
  };

  let errorCount = 0;
  const numRounds = 6;
  const matchesPlayed: Record<string, number> = {};
  players.forEach(p => { matchesPlayed[p.id] = 0; });

  for (let r = 0; r < numRounds; r++) {
    const roundMatches = generateMexicanoMatches(tournament, r);
    if (roundMatches.length === 0) {
      errorCount++;
      failureDetails.push(`Mexicano N=${n} returned 0 matches in round ${r + 1}`);
      break;
    }

    // Validate invariants for this round
    const inRoundPlayers: string[] = [];
    for (const m of roundMatches) {
      if (m.team1.length !== 2 || m.team2.length !== 2) {
        errorCount++;
        failureDetails.push(`Mexicano N=${n} round ${r + 1} match has invalid team size`);
      }
      if (m.team1.some(p => !p) || m.team2.some(p => !p)) {
        errorCount++;
        failureDetails.push(`Mexicano N=${n} round ${r + 1} match has undefined player`);
      }
      const mPlayers = [...m.team1, ...m.team2];
      if (new Set(mPlayers).size !== 4) {
        errorCount++;
        failureDetails.push(`Mexicano N=${n} round ${r + 1} match has duplicates within same match`);
      }
      inRoundPlayers.push(...mPlayers);
    }

    if (new Set(inRoundPlayers).size !== inRoundPlayers.length) {
      errorCount++;
      failureDetails.push(`Mexicano N=${n} round ${r + 1} has player playing on multiple courts`);
    }

    // Simulate scores: simulate varying scores to change standings
    roundMatches.forEach(m => {
      // Simulate non-trivial scores
      const s1 = Math.floor(Math.random() * 10) + 12;
      const s2 = 24 - s1;
      m.score1 = s1;
      m.score2 = s2;
      m.team1.forEach(pid => { matchesPlayed[pid] = (matchesPlayed[pid] || 0) + 1; });
      m.team2.forEach(pid => { matchesPlayed[pid] = (matchesPlayed[pid] || 0) + 1; });
    });

    tournament.matches.push(...roundMatches);
  }

  const playedVals = Object.values(matchesPlayed);
  const maxPlay = Math.max(...playedVals);
  const minPlay = Math.min(...playedVals);
  const diffPlay = maxPlay - minPlay;

  mexResults.push({
    Players: n,
    Courts: courts,
    Rounds: numRounds,
    MaxPlay: maxPlay,
    MinPlay: minPlay,
    DiffPlay: diffPlay,
    Errors: errorCount,
    Result: errorCount === 0 && diffPlay <= 1 ? 'PASS' : (errorCount === 0 ? 'WARN (DiffPlay>1)' : 'FAIL')
  });

  assert(errorCount === 0, `Mexicano N=${n} Invariants`, `Encountered ${errorCount} errors`);
  assert(diffPlay <= 2, `Mexicano N=${n} Fair Resting`, `Difference in played matches is ${diffPlay}`);
}

console.table(mexResults);

// ----------------------------------------------------
// 3. MEXICANO RANKING REORGANIZATION & DYNAMIC POSITION TEST
// ----------------------------------------------------
console.log('\n--- 3. Testing Mexicano Ranking Grouping Dynamics ---');
{
  const players: Player[] = [
    { id: 'p1', name: 'Elite 1' },
    { id: 'p2', name: 'Elite 2' },
    { id: 'p3', name: 'Elite 3' },
    { id: 'p4', name: 'Elite 4' },
    { id: 'p5', name: 'Mid 1' },
    { id: 'p6', name: 'Mid 2' },
    { id: 'p7', name: 'Mid 3' },
    { id: 'p8', name: 'Mid 4' }
  ];

  const tournament: Tournament = {
    id: 'mex_dyn',
    name: 'Mexicano Dynamic',
    type: 'mexicano',
    pointsPerMatch: 24,
    players,
    matches: [],
    courtsCount: 2,
    createdAt: new Date()
  };

  // Round 0
  const r1 = generateMexicanoMatches(tournament, 0);
  r1[0].score1 = 24; r1[0].score2 = 0; // p1 and partner get +24
  r1[1].score1 = 12; r1[1].score2 = 12;
  tournament.matches.push(...r1);

  // Round 1
  const r2 = generateMexicanoMatches(tournament, 1);
  const c1Players = [...r2[0].team1, ...r2[0].team2];
  const c2Players = [...r2[1].team1, ...r2[1].team2];

  // The top 4 players from round 1 should be on Court 1!
  const currentStandings = calculateStandings(tournament);
  const top4 = currentStandings.slice(0, 4).map(s => s.id);
  const allTopOnC1 = top4.every(id => c1Players.includes(id));
  assert(allTopOnC1, 'Mexicano Court 1 contains the top 4 ranked players', `C1: ${c1Players}, Top4: ${top4}`);
}

// ----------------------------------------------------
// 4. KING OF THE COURT EXTENSIVE SIMULATIONS
// ----------------------------------------------------
console.log('\n--- 4. Testing King of the Court (1 to 4 Courts, 4 to 16 Players) ---');
const kingConfigs = [
  { players: 4, courts: 1, rounds: 10 },
  { players: 5, courts: 1, rounds: 10 },
  { players: 8, courts: 2, rounds: 10 },
  { players: 9, courts: 2, rounds: 10 },
  { players: 12, courts: 3, rounds: 10 },
  { players: 13, courts: 3, rounds: 10 },
  { players: 16, courts: 4, rounds: 10 }
];

const kingResults: any[] = [];

for (const cfg of kingConfigs) {
  const players: Player[] = Array.from({ length: cfg.players }, (_, i) => ({
    id: `k_${i + 1}`,
    name: `Player ${i + 1}`
  }));

  const tournament: Tournament = {
    id: `king_${cfg.players}`,
    name: `King ${cfg.players}`,
    type: 'king',
    pointsPerMatch: 24,
    players,
    matches: [],
    courtsCount: cfg.courts,
    createdAt: new Date()
  };

  let errors = 0;
  const matchesPlayed: Record<string, number> = {};
  players.forEach(p => { matchesPlayed[p.id] = 0; });

  for (let r = 0; r < cfg.rounds; r++) {
    const roundMatches = generateKingMatches(tournament, r);
    if (roundMatches.length !== cfg.courts) {
      errors++;
      failureDetails.push(`King N=${cfg.players} C=${cfg.courts} R=${r + 1} generated ${roundMatches.length} matches, expected ${cfg.courts}`);
      break;
    }

    const inRoundPlayers: string[] = [];
    for (const m of roundMatches) {
      if (m.team1.length !== 2 || m.team2.length !== 2) {
        errors++;
        failureDetails.push(`King N=${cfg.players} invalid team sizes`);
      }
      if (m.team1.includes(undefined!) || m.team2.includes(undefined!)) {
        errors++;
        failureDetails.push(`King N=${cfg.players} undefined player in team`);
      }
      const mPlayers = [...m.team1, ...m.team2];
      if (new Set(mPlayers).size !== 4) {
        errors++;
        failureDetails.push(`King N=${cfg.players} duplicates within same match: ${mPlayers.join(',')}`);
      }
      inRoundPlayers.push(...mPlayers);
    }

    if (new Set(inRoundPlayers).size !== inRoundPlayers.length) {
      errors++;
      failureDetails.push(`King N=${cfg.players} round ${r + 1} has player playing on multiple courts`);
    }

    // Simulate scores with clear winners
    roundMatches.forEach((m, idx) => {
      // Alternate which team wins to test ascents and descents
      if ((r + idx) % 2 === 0) {
        m.score1 = 15;
        m.score2 = 9;
      } else {
        m.score1 = 8;
        m.score2 = 16;
      }
      m.team1.forEach(pid => { matchesPlayed[pid] = (matchesPlayed[pid] || 0) + 1; });
      m.team2.forEach(pid => { matchesPlayed[pid] = (matchesPlayed[pid] || 0) + 1; });
    });

    tournament.matches.push(...roundMatches);
  }

  const playedVals = Object.values(matchesPlayed);
  const maxPlay = Math.max(...playedVals);
  const minPlay = Math.min(...playedVals);
  const diffPlay = maxPlay - minPlay;

  kingResults.push({
    Players: cfg.players,
    Courts: cfg.courts,
    Rounds: cfg.rounds,
    MaxPlay: maxPlay,
    MinPlay: minPlay,
    DiffPlay: diffPlay,
    Errors: errors,
    Result: errors === 0 ? 'PASS' : 'FAIL'
  });

  assert(errors === 0, `King N=${cfg.players} C=${cfg.courts} Invariants`, `Encountered ${errors} errors`);
}

console.table(kingResults);

// ----------------------------------------------------
// 5. KING OF THE COURT 1 COURT DEEP ROTATION TEST
// ----------------------------------------------------
console.log('\n--- 5. Testing King of the Court Single Court (4 & 5 players) No-Stall ---');
{
  // 4 players, 1 court, 10 rounds:
  // Check that winners separate in each round and no 2 identical consecutive matches occur
  const players4: Player[] = [
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }
  ];
  const t4: Tournament = {
    id: 'k4_1', name: 'K4', type: 'king', pointsPerMatch: 24, players: players4, matches: [], courtsCount: 1, createdAt: new Date()
  };

  let identicalConsecutive = 0;
  let prevTeams = '';

  for (let r = 0; r < 10; r++) {
    const rm = generateKingMatches(t4, r);
    const m = rm[0];
    const currentTeams = `${[...m.team1].sort().join('-')} vs ${[...m.team2].sort().join('-')}`;
    if (currentTeams === prevTeams) {
      identicalConsecutive++;
    }
    prevTeams = currentTeams;

    // Team 1 wins
    m.score1 = 16;
    m.score2 = 8;
    t4.matches.push(m);
  }

  assert(identicalConsecutive === 0, 'King 4 players 1 court: no identical consecutive matches');

  // 5 players, 1 court, 10 rounds:
  // Check that the resting player rotates and no player is permanently resting
  const players5: Player[] = [
    { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }, { id: 'p3', name: 'P3' }, { id: 'p4', name: 'P4' }, { id: 'p5', name: 'P5' }
  ];
  const t5: Tournament = {
    id: 'k5_1', name: 'K5', type: 'king', pointsPerMatch: 24, players: players5, matches: [], courtsCount: 1, createdAt: new Date()
  };

  const playCounts: Record<string, number> = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
  for (let r = 0; r < 10; r++) {
    const rm = generateKingMatches(t5, r);
    const m = rm[0];
    [...m.team1, ...m.team2].forEach(p => { playCounts[p]++; });
    m.score1 = 15;
    m.score2 = 9;
    t5.matches.push(m);
  }

  const allPlayedAtLeastOnce = Object.values(playCounts).every(c => c >= 6);
  assert(allPlayedAtLeastOnce, 'King 5 players: all players rotated into court fairly', JSON.stringify(playCounts));
}

// ----------------------------------------------------
// 6. PROPERTY-BASED TESTING (500 RANDOMIZED CONFIGURATIONS)
// ----------------------------------------------------
console.log('\n--- 6. Property-Based Stress Testing (500 Combinations) ---');
let pbtErrors = 0;

for (let iter = 0; iter < 500; iter++) {
  const n = Math.floor(Math.random() * 13) + 4; // 4 to 16 players
  const maxCourts = Math.floor(n / 4);
  const courts = Math.max(1, Math.floor(Math.random() * maxCourts) + 1);
  const type = ['americano', 'mexicano', 'king'][Math.floor(Math.random() * 3)] as 'americano' | 'mexicano' | 'king';
  const roundsToTest = Math.floor(Math.random() * 4) + 2;

  const players: Player[] = Array.from({ length: n }, (_, i) => ({
    id: `rand_${i + 1}`,
    name: `Rnd ${i + 1}`
  }));

  const tourney: Tournament = {
    id: `pbt_${iter}`,
    name: `PBT ${iter}`,
    type,
    pointsPerMatch: 24,
    players,
    matches: [],
    courtsCount: courts,
    createdAt: new Date()
  };

  try {
    if (type === 'americano') {
      const matches = generateAmericanoMatches(players, roundsToTest, courts);
      for (const m of matches) {
        if (!m.id || m.team1.length !== 2 || m.team2.length !== 2 || m.team1.includes(undefined!) || m.team2.includes(undefined!)) {
          pbtErrors++;
          failureDetails.push(`PBT Americano invalid match on iter ${iter}`);
        }
      }
    } else if (type === 'mexicano') {
      for (let r = 0; r < roundsToTest; r++) {
        const roundMatches = generateMexicanoMatches(tourney, r);
        for (const m of roundMatches) {
          if (!m.id || m.team1.length !== 2 || m.team2.length !== 2 || m.team1.includes(undefined!) || m.team2.includes(undefined!)) {
            pbtErrors++;
            failureDetails.push(`PBT Mexicano invalid match on iter ${iter} round ${r}`);
          }
          m.score1 = Math.floor(Math.random() * 25);
          m.score2 = 24 - m.score1;
        }
        tourney.matches.push(...roundMatches);
      }
    } else if (type === 'king') {
      for (let r = 0; r < roundsToTest; r++) {
        const roundMatches = generateKingMatches(tourney, r);
        for (const m of roundMatches) {
          if (!m.id || m.team1.length !== 2 || m.team2.length !== 2 || m.team1.includes(undefined!) || m.team2.includes(undefined!)) {
            pbtErrors++;
            failureDetails.push(`PBT King invalid match on iter ${iter} round ${r}`);
          }
          m.score1 = Math.floor(Math.random() * 25);
          m.score2 = m.score1 === 12 ? 13 : (24 - m.score1); // avoid exact tie for king
        }
        tourney.matches.push(...roundMatches);
      }
    }
  } catch (err) {
    pbtErrors++;
    failureDetails.push(`PBT Exception on iter ${iter} (${type}, N=${n}, C=${courts}): ${String(err)}`);
  }
}

assert(pbtErrors === 0, 'Property-Based Testing 500 configurations passed without exception or invariant violation', `Errors: ${pbtErrors}`);

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  console.log('\nFAILURE DETAILS:');
  failureDetails.forEach(f => console.log(' - ' + f));
  process.exit(1);
} else {
  console.log('ALL ENGINE ADVERSARIAL TESTS PASSED CONCRETELY.');
  process.exit(0);
}
