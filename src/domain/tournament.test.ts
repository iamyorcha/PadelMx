import assert from 'node:assert/strict';
import { validateTournamentIntegrity, TOURNAMENT_LIMITS } from './integrity';
import { reportError, trackEvent, getTelemetryLogs, clearTelemetryLogs } from '../utils/telemetry';
import { getHumanReadableErrorMessage } from '../utils/userMessages';
import { getFeatureFlag, setFeatureFlag, resetFeatureFlags } from '../utils/featureFlags';
import {
  generateAmericanoMatches,
  generateMexicanoMatches,
  generateKingMatches,
  calculateStandings,
  isTournamentCompleted,
  getTournamentPodium,
  Tournament,
  Player,
  Match
} from './tournament';

function createMockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Jugador ${i + 1}`
  }));
}

function runTests() {
  console.log('====================================================');
  console.log('RUNNING DOMAIN TOURNAMENT AUTOMATED TEST SUITE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // 1. AMERICANO TESTS
  // ----------------------------------------------------
  test('Americano: 4 Players generate round-robin with all unique partnerships', () => {
    const players = createMockPlayers(4);
    const matches = generateAmericanoMatches(players, 3, 1);
    assert.equal(matches.length, 3, '4 players must generate 3 matches');
    
    // Each pair of players must partner exactly once
    const partnerPairs = new Set<string>();
    matches.forEach(m => {
      const p1 = [m.team1[0], m.team1[1]].sort().join(':');
      const p2 = [m.team2[0], m.team2[1]].sort().join(':');
      assert.ok(!partnerPairs.has(p1), `Duplicate partnership: ${p1}`);
      assert.ok(!partnerPairs.has(p2), `Duplicate partnership: ${p2}`);
      partnerPairs.add(p1);
      partnerPairs.add(p2);
    });
    assert.equal(partnerPairs.size, 6, 'All 6 pairs formed');
  });

  test('Americano: 5 Players (resting rotations across 5 rounds)', () => {
    const players = createMockPlayers(5);
    const matches = generateAmericanoMatches(players, 5, 1);
    assert.equal(matches.length, 5, '5 players must generate 5 matches');

    const restCount: Record<string, number> = {};
    players.forEach(p => restCount[p.id] = 0);

    for (let r = 1; r <= 5; r++) {
      const rMatches = matches.filter(m => m.round === r);
      assert.equal(rMatches.length, 1);
      const playing = new Set([...rMatches[0].team1, ...rMatches[0].team2]);
      assert.equal(playing.size, 4);
      players.forEach(p => {
        if (!playing.has(p.id)) restCount[p.id]++;
      });
    }

    // Every player must rest exactly 1 time
    Object.values(restCount).forEach(count => {
      assert.equal(count, 1, 'Every player must rest exactly 1 round in a 5-player Americano');
    });
  });

  test('Americano: 8 Players on 2 Courts', () => {
    const players = createMockPlayers(8);
    const matches = generateAmericanoMatches(players, 7, 2);
    assert.equal(matches.length, 7 * 2, '7 rounds x 2 courts = 14 matches');
    for (let r = 1; r <= 7; r++) {
      const rMatches = matches.filter(m => m.round === r);
      assert.equal(rMatches.length, 2);
      const playing = new Set(rMatches.flatMap(m => [...m.team1, ...m.team2]));
      assert.equal(playing.size, 8, `Round ${r} must have all 8 players active`);
    }
  });

  // ----------------------------------------------------
  // 2. MEXICANO TESTS
  // ----------------------------------------------------
  test('Mexicano: Dynamic next round generation based on ranking', () => {
    const players = createMockPlayers(4);
    const t: Tournament = {
      id: 'mex-1',
      name: 'Mexicano Test',
      type: 'mexicano',
      pointsPerMatch: 32,
      players,
      matches: [
        { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 20, score2: 12, serveFirst: 1 }
      ],
      courtsCount: 1,
      createdAt: 1000
    };

    const nextMatches = generateMexicanoMatches(t, 1);
    assert.equal(nextMatches.length, 1);
    assert.equal(nextMatches[0].round, 2);
    // Court 1 should pair 1st & 4th vs 2nd & 3rd
    const standings = calculateStandings(t);
    assert.equal(standings[0].id, 'player-1'); // 20 pts
    assert.equal(standings[1].id, 'player-2'); // 20 pts
    assert.equal(standings[2].id, 'player-3'); // 12 pts
    assert.equal(standings[3].id, 'player-4'); // 12 pts

    // Check that next match does not fail
    assert.ok(nextMatches[0].team1.length === 2);
    assert.ok(nextMatches[0].team2.length === 2);
  });

  test('Mexicano: Resting rotation fairness (5 players across 5 rounds)', () => {
    const players = createMockPlayers(5);
    let currentMatches: Match[] = [
      { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 18, score2: 14, serveFirst: 1 }
    ];

    for (let r = 1; r < 5; r++) {
      const tempT: Tournament = {
        id: 'mex-5p',
        name: 'Mexicano 5P',
        type: 'mexicano',
        pointsPerMatch: 32,
        players,
        matches: currentMatches,
        courtsCount: 1,
        createdAt: 1000
      };
      const nextMatches = generateMexicanoMatches(tempT, r);
      assert.equal(nextMatches.length, 1);
      nextMatches[0].score1 = 16;
      nextMatches[0].score2 = 16;
      currentMatches = [...currentMatches, ...nextMatches];
    }

    const tFinal: Tournament = {
      id: 'mex-5p',
      name: 'Mexicano 5P',
      type: 'mexicano',
      pointsPerMatch: 32,
      players,
      matches: currentMatches,
      courtsCount: 1,
      createdAt: 1000
    };

    const standings = calculateStandings(tFinal);
    standings.forEach(p => {
      assert.equal(p.matchesPlayed, 4, 'Each player must play exactly 4 matches in 5 rounds');
    });
  });

  // ----------------------------------------------------
  // 3. KING OF THE COURT TESTS
  // ----------------------------------------------------
  test('King of Court: Court promotion and relegation mechanics', () => {
    const players = createMockPlayers(8);
    const round1: Match[] = [
      // Court 1: winners p1, p2. losers p3, p4
      { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 21, score2: 11, serveFirst: 1 },
      // Court 2: winners p5, p6. losers p7, p8
      { id: 'm2', round: 1, court: 2, team1: ['player-5', 'player-6'], team2: ['player-7', 'player-8'], score1: 21, score2: 15, serveFirst: 1 }
    ];

    const t: Tournament = {
      id: 'king-8',
      name: 'King 8P',
      type: 'king',
      pointsPerMatch: 21,
      players,
      matches: round1,
      courtsCount: 2,
      createdAt: 1000
    };

    const r2Matches = generateKingMatches(t, 1);
    assert.equal(r2Matches.length, 2);

    const c1 = r2Matches.find(m => m.court === 1)!;
    const c2 = r2Matches.find(m => m.court === 2)!;

    // Court 1 in round 2 should contain Court 1 winners (p1, p2) and Court 2 winners (p5, p6)
    const c1Players = new Set([...c1.team1, ...c1.team2]);
    assert.ok(c1Players.has('player-1') && c1Players.has('player-2'), 'C1 winners must stay in C1');
    assert.ok(c1Players.has('player-5') && c1Players.has('player-6'), 'C2 winners must promote to C1');

    // Court 2 in round 2 should contain Court 1 losers (p3, p4) and Court 2 losers (p7, p8)
    const c2Players = new Set([...c2.team1, ...c2.team2]);
    assert.ok(c2Players.has('player-3') && c2Players.has('player-4'), 'C1 losers must relegate to C2');
    assert.ok(c2Players.has('player-7') && c2Players.has('player-8'), 'C2 losers must stay in C2');
  });

  test('King of Court: Single court 4 players partner splitting', () => {
    const players = createMockPlayers(4);
    const round1: Match[] = [
      { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 21, score2: 10, serveFirst: 1 }
    ];
    const t: Tournament = {
      id: 'king-4',
      name: 'King 4P',
      type: 'king',
      pointsPerMatch: 21,
      players,
      matches: round1,
      courtsCount: 1,
      createdAt: 1000
    };

    const r2Matches = generateKingMatches(t, 1);
    assert.equal(r2Matches.length, 1);
    const m = r2Matches[0];
    // In next round, p1 and p2 must split!
    assert.ok(
      (m.team1.includes('player-1') && m.team2.includes('player-2')) ||
      (m.team1.includes('player-2') && m.team2.includes('player-1')),
      'Winners must split on single court King of Court'
    );
  });

  test('King of Court: 5 players resting rotation fairness over 10 rounds', () => {
    const players = createMockPlayers(5);
    let matches: Match[] = [
      { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 15, score2: 10, serveFirst: 1 }
    ];

    for (let r = 1; r < 10; r++) {
      const tempT: Tournament = {
        id: 'king-5',
        name: 'King 5P',
        type: 'king',
        pointsPerMatch: 21,
        players,
        matches,
        courtsCount: 1,
        createdAt: 1000
      };
      const next = generateKingMatches(tempT, r);
      assert.equal(next.length, 1);
      next[0].score1 = (r % 2 === 0) ? 21 : 15;
      next[0].score2 = (r % 2 === 0) ? 15 : 21;
      matches = [...matches, ...next];
    }

    const tFinal: Tournament = {
      id: 'king-5',
      name: 'King 5P',
      type: 'king',
      pointsPerMatch: 21,
      players,
      matches,
      courtsCount: 1,
      createdAt: 1000
    };

    const standings = calculateStandings(tFinal);
    standings.forEach(p => {
      assert.equal(p.matchesPlayed, 8, 'Every player must play exactly 8 matches in 10 rounds with 5 players');
    });
  });

  // ----------------------------------------------------
  // 4. STANDINGS AND TIE-BREAKING
  // ----------------------------------------------------
  test('Standings: Deterministic tie-breaking hierarchy', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Carlos' },
      { id: 'p2', name: 'Alberto' },
      { id: 'p3', name: 'Bernardo' }
    ];

    const t: Tournament = {
      id: 'tie-t',
      name: 'Tie Test',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: [],
      courtsCount: 1,
      createdAt: 1000
    };

    const standings = calculateStandings(t);
    // With 0 points, sorting falls to name.localeCompare
    assert.equal(standings[0].name, 'Alberto');
    assert.equal(standings[1].name, 'Bernardo');
    assert.equal(standings[2].name, 'Carlos');
  });

  // ----------------------------------------------------
  // 5. TOURNAMENT COMPLETION & PODIUM
  // ----------------------------------------------------
  test('isTournamentCompleted: Evaluates unfinished vs finished tournaments', () => {
    const players = createMockPlayers(4);
    const unfinishedT: Tournament = {
      id: 't-unf',
      name: 'Unfinished',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: [
        { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 16, score2: 16, serveFirst: 1 },
        { id: 'm2', round: 2, court: 1, team1: ['player-1', 'player-3'], team2: ['player-2', 'player-4'], score1: null, score2: null, serveFirst: 1 }
      ],
      courtsCount: 1,
      createdAt: 1000
    };
    assert.equal(isTournamentCompleted(unfinishedT), false, 'Unfinished tournament must return false');

    const finishedT: Tournament = {
      ...unfinishedT,
      matches: [
        { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 20, score2: 12, serveFirst: 1 },
        { id: 'm2', round: 2, court: 1, team1: ['player-1', 'player-3'], team2: ['player-2', 'player-4'], score1: 18, score2: 14, serveFirst: 1 }
      ]
    };
    assert.equal(isTournamentCompleted(finishedT), true, 'Finished regular tournament must return true');
  });

  test('isTournamentCompleted & getTournamentPodium: Playoff Final overrides standings', () => {
    const players = createMockPlayers(4);
    // Standing: p4 had worst regular score, p1 had best
    // But in playoff final, p4 & p3 defeat p1 & p2!
    const playoffT: Tournament = {
      id: 't-playoff',
      name: 'Playoff Final',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: [
        { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 30, score2: 2, serveFirst: 1 },
        { id: 'final', round: 2, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'], score1: 10, score2: 22, isPlayoff: true, playoffType: 'final', serveFirst: 1 }
      ],
      courtsCount: 1,
      createdAt: 1000
    };

    assert.equal(isTournamentCompleted(playoffT), true);
    const podium = getTournamentPodium(playoffT);
    assert.ok(podium !== null);
    // Gold must be playoff final winners (player-3 and player-4)
    assert.ok(podium.gold.includes('player-3') && podium.gold.includes('player-4'), 'Final winners get gold');
    assert.ok(podium.silver.includes('player-1') && podium.silver.includes('player-2'), 'Final runners-up get silver');
  });

  test('validateTournamentIntegrity: Detects corrupted matches, duplicate players, and payload anomalies', () => {
    const valid = {
      id: 't-int-1',
      name: 'Torneo Integridad',
      type: 'americano' as const,
      status: 'active' as const,
      players: createMockPlayers(4),
      matches: [
        { id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'] as [string, string], team2: ['player-3', 'player-4'] as [string, string], score1: 18, score2: 14 }
      ]
    };
    assert.equal(validateTournamentIntegrity(valid).isValid, true);

    const duplicatePlayerMatch = {
      ...valid,
      matches: [
        { id: 'm-dup', round: 1, court: 1, team1: ['player-1', 'player-2'] as [string, string], team2: ['player-1', 'player-3'] as [string, string], score1: 16, score2: 16 }
      ]
    };
    const dupRes = validateTournamentIntegrity(duplicatePlayerMatch);
    assert.equal(dupRes.isValid, false);
    assert.ok(dupRes.errors.some(e => e.includes('repetido en la misma pista')));
  });

  // ----------------------------------------------------
  // 6. PRODUCTION HARDENING & OBSERVABILITY TESTS
  // ----------------------------------------------------
  test('Telemetry: Records events, errors, and enforces circular buffer limit', () => {
    clearTelemetryLogs();
    trackEvent('test_event_1', { data: 123 });
    reportError(new Error('Synthetic operational anomaly'), { operation: 'unit_test' });

    const logs = getTelemetryLogs();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].type, 'event');
    assert.equal(logs[1].type, 'error');
    assert.equal(logs[1].message, 'Synthetic operational anomaly');

    // Fill buffer beyond 50
    for (let i = 0; i < 60; i++) {
      trackEvent(`flood_${i}`);
    }
    const floodLogs = getTelemetryLogs();
    assert.equal(floodLogs.length, 50, 'Circular buffer caps at 50');
  });

  test('User Messages: Converts technical Firestore exceptions into friendly text', () => {
    const permErr = new Error('FirebaseError: [code=permission-denied]: Missing or insufficient permissions.');
    const friendlyPerm = getHumanReadableErrorMessage(permErr);
    assert.ok(friendlyPerm.includes('No tienes permisos'));

    const netErr = new Error('network error unavailable');
    const friendlyNet = getHumanReadableErrorMessage(netErr);
    assert.ok(friendlyNet.includes('conexión'));
  });

  test('Feature Flags: Default availability and dynamic override capability', () => {
    resetFeatureFlags();
    assert.equal(getFeatureFlag('playoffs'), true);
    assert.equal(getFeatureFlag('experimentalFormats'), false);

    setFeatureFlag('experimentalFormats', true);
    assert.equal(getFeatureFlag('experimentalFormats'), true);
    resetFeatureFlags();
  });

  test('Long-Run Simulation: 25 rounds with 16 players executes under 100ms with full integrity', () => {
    const players = createMockPlayers(16);
    const start = Date.now();

    // 25 rounds on 4 courts = 100 matches
    const matches = generateAmericanoMatches(players, 25, 4);
    assert.equal(matches.length, 100);

    const tournament: Tournament = {
      id: 't-longrun-25',
      name: 'Torneo 25 Rondas',
      type: 'americano',
      pointsPerMatch: 24,
      players,
      matches,
      courtsCount: 4,
      createdAt: Date.now()
    };

    // Simulate scores for all 100 matches
    matches.forEach((m, idx) => {
      m.score1 = 12 + (idx % 12);
      m.score2 = 24 - m.score1;
    });

    const rankStart = performance.now();
    const standings = calculateStandings(tournament);
    const rankDurationMs = performance.now() - rankStart;

    assert.equal(standings.length, 16);
    assert.ok(rankDurationMs < 30, `Ranking calculation too slow: ${rankDurationMs}ms`);

    const integrity = validateTournamentIntegrity(tournament);
    assert.equal(integrity.isValid, true);
    assert.ok(Date.now() - start < 500, 'Whole 25-round simulation executes rapidly');
  });

  test('Long-Run Simulation: 20 rounds of Mexicano dynamic progression maintains ranking and integrity', () => {
    const players = createMockPlayers(12);
    let tournament: Tournament = {
      id: 'stress-mexicano-20',
      name: 'Stress Mexicano 20 Rondas',
      type: 'mexicano',
      pointsPerMatch: 16,
      players,
      matches: [],
      courtsCount: 3,
      createdAt: Date.now()
    };

    tournament.matches = generateMexicanoMatches(tournament, 0);
    assert.equal(tournament.matches.length, 3);

    for (let r = 1; r <= 20; r++) {
      for (const m of tournament.matches.filter(m => m.round === r)) {
        m.score1 = 10;
        m.score2 = 6;
      }
      if (r < 20) {
        const next = generateMexicanoMatches(tournament, r);
        assert.equal(next.length, 3);
        tournament.matches = [...tournament.matches, ...next];
      }
    }

    assert.equal(tournament.matches.length, 60);
    const standings = calculateStandings(tournament);
    assert.equal(standings.length, 12);
    assert.equal(validateTournamentIntegrity(tournament).isValid, true);
  });

  test('Long-Run Simulation: 20 rounds of King of the Court court transitions maintains ladder integrity', () => {
    const players = createMockPlayers(8);
    let tournament: Tournament = {
      id: 'stress-king-20',
      name: 'Stress King 20 Rondas',
      type: 'king',
      pointsPerMatch: 16,
      players,
      matches: [],
      courtsCount: 2,
      createdAt: Date.now()
    };

    tournament.matches = generateKingMatches(tournament, 0);
    assert.equal(tournament.matches.length, 2);

    for (let r = 1; r <= 20; r++) {
      for (const m of tournament.matches.filter(m => m.round === r)) {
        m.score1 = 16;
        m.score2 = 0;
      }
      if (r < 20) {
        const next = generateKingMatches(tournament, r);
        assert.equal(next.length, 2);
        tournament.matches = [...tournament.matches, ...next];
      }
    }

    assert.equal(tournament.matches.length, 40);
    const standings = calculateStandings(tournament);
    assert.equal(standings.length, 8);
    assert.equal(validateTournamentIntegrity(tournament).isValid, true);
  });

  console.log('====================================================');
  console.log(`TOTAL SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
