import assert from 'node:assert/strict';
import {
  generateAmericanoMatches,
  generateAdditionalAmericanoRounds,
  generatePlayoffMatches,
  generateSemisFromQuarters,
  generateFinalsFromSemis,
  calculateFairnessMetrics,
  calculateStandings,
  getTournamentState,
  canAddRegularRounds,
  getTournamentPodium,
  isTournamentCompleted,
  Tournament,
  Player,
  Match,
  PlayoffFormat
} from './tournament';

function createMockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Jugador ${i + 1}`
  }));
}

function runFairnessTests() {
  console.log('====================================================');
  console.log('RUNNING FAIRNESS & PLAYOFF SYSTEM TEST SUITE (PARTE Q)');
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

  // 1. Escenario: 5 jugadores, 1 cancha, 5 rondas
  test('Escenario 1: 5 jugadores, 1 cancha, 5 rondas (Diff = 0, 0 descansos consecutivos)', () => {
    const players = createMockPlayers(5);
    const matches = generateAmericanoMatches(players, 5, 1);
    const metrics = calculateFairnessMetrics({ players, matches }, 5);

    assert.equal(metrics.minMatches, 4);
    assert.equal(metrics.maxMatches, 4);
    assert.equal(metrics.matchDifference, 0, 'La diferencia debe ser exactamente 0 partidos');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos');
    Object.values(metrics.playerMetrics).forEach(p => {
      assert.equal(p.rests, 1, 'Cada jugador debe descansar exactamente 1 ronda');
      assert.equal(p.maxConsecutiveRests, 1);
    });
  });

  // 2. Escenario: 5 jugadores, 1 cancha, 6 rondas
  test('Escenario 2: 5 jugadores, 1 cancha, 6 rondas (Diff = 1)', () => {
    const players = createMockPlayers(5);
    const matches = generateAmericanoMatches(players, 6, 1);
    const metrics = calculateFairnessMetrics({ players, matches }, 6);

    assert.ok(metrics.matchDifference <= 1, 'Diferencia máxima debe ser <= 1');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos');
  });

  // 3. Escenario: 6 jugadores, 1 cancha, 6 rondas
  test('Escenario 3: 6 jugadores, 1 cancha, 6 rondas (Diff = 0, 0 descansos consecutivos)', () => {
    const players = createMockPlayers(6);
    const matches = generateAmericanoMatches(players, 6, 1);
    const metrics = calculateFairnessMetrics({ players, matches }, 6);

    assert.equal(metrics.minMatches, 4);
    assert.equal(metrics.maxMatches, 4);
    assert.equal(metrics.matchDifference, 0, 'Diferencia debe ser 0 cuando es divisible');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos');
  });

  // 4. Escenario: 7 jugadores, 1 cancha, 5 rondas
  test('Escenario 4: 7 jugadores, 1 cancha, 5 rondas (Diff <= 1, 0 descansos consecutivos)', () => {
    const players = createMockPlayers(7);
    const matches = generateAmericanoMatches(players, 5, 1);
    const metrics = calculateFairnessMetrics({ players, matches }, 5);

    assert.ok(metrics.matchDifference <= 1, 'Diferencia máxima debe ser 1');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos');
  });

  // 5. Escenario: 7 jugadores, 1 cancha, 7 rondas
  test('Escenario 5: 7 jugadores, 1 cancha, 7 rondas (Diff = 0)', () => {
    const players = createMockPlayers(7);
    const matches = generateAmericanoMatches(players, 7, 1);
    const metrics = calculateFairnessMetrics({ players, matches }, 7);

    assert.equal(metrics.minMatches, 4);
    assert.equal(metrics.maxMatches, 4);
    assert.equal(metrics.matchDifference, 0, '7 rondas x 4 slots = 28 / 7 = 4 exactos');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos');
  });

  // 6. Escenario: 9 jugadores, 2 canchas, 9 rondas
  test('Escenario 6: 9 jugadores, 2 canchas, 9 rondas (Diff = 0, descansos rotativos perfectos)', () => {
    const players = createMockPlayers(9);
    const matches = generateAmericanoMatches(players, 9, 2);
    const metrics = calculateFairnessMetrics({ players, matches }, 9);

    assert.equal(metrics.minMatches, 8);
    assert.equal(metrics.maxMatches, 8);
    assert.equal(metrics.matchDifference, 0);
    assert.equal(metrics.totalConsecutiveRests, 0);
  });

  // 7. Escenario: 10 jugadores, 2 canchas, 5 rondas (2 descansan por ronda)
  test('Escenario 7: 10 jugadores, 2 canchas, 5 rondas (Diff = 0, 0 descansos consecutivos)', () => {
    const players = createMockPlayers(10);
    const matches = generateAmericanoMatches(players, 5, 2);
    const metrics = calculateFairnessMetrics({ players, matches }, 5);

    assert.equal(metrics.minMatches, 4);
    assert.equal(metrics.maxMatches, 4);
    assert.equal(metrics.matchDifference, 0);
    assert.equal(metrics.totalConsecutiveRests, 0);
  });

  // 8. Escenario: 11 jugadores, 2 canchas, 11 rondas
  test('Escenario 8: 11 jugadores, 2 canchas, 11 rondas (Diff = 0, 0 descansos consecutivos)', () => {
    const players = createMockPlayers(11);
    const matches = generateAmericanoMatches(players, 11, 2);
    const metrics = calculateFairnessMetrics({ players, matches }, 11);

    assert.equal(metrics.minMatches, 8);
    assert.equal(metrics.maxMatches, 8);
    assert.equal(metrics.matchDifference, 0);
    assert.equal(metrics.totalConsecutiveRests, 0);
  });

  // 9. Escenario: AGREGAR RONDAS DINÁMICAMENTE (+3 rondas en un torneo en curso)
  test('Escenario 9: Agregar rondas dinámicamente preserva historial de equidad', () => {
    const players = createMockPlayers(7);
    const initialMatches = generateAmericanoMatches(players, 5, 1);
    const tourney: Tournament = {
      id: 't-add-rounds',
      name: 'Torneo Expansion',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: initialMatches,
      courtsCount: 1,
      status: 'active',
      createdAt: Date.now()
    };

    // Agregar 2 rondas para totalizar 7 rondas
    const additionalMatches = generateAdditionalAmericanoRounds(tourney, 2);
    assert.equal(additionalMatches.length, 2, 'Debe generar 2 partidos adicionales');
    assert.equal(additionalMatches[0].round, 6, 'El primer partido adicional debe ser de ronda 6');
    assert.equal(additionalMatches[1].round, 7, 'El segundo partido adicional debe ser de ronda 7');

    const totalMatches = [...initialMatches, ...additionalMatches];
    const metrics = calculateFairnessMetrics({ players, matches: totalMatches }, 7);

    assert.equal(metrics.matchDifference, 0, 'Con 7 rondas y 7 jugadores la diferencia debe ser exactamente 0');
    assert.equal(metrics.totalConsecutiveRests, 0, 'No debe haber descansos consecutivos en todo el torneo combinado');
  });

  // 10. Escenario: Playoff Top 4 (1&4 vs 2&3)
  test('Escenario 10: Playoff Top 4 genera final directa equilibrada', () => {
    const players = createMockPlayers(6);
    const matches = generateAmericanoMatches(players, 3, 1);
    // Simular puntajes
    matches[0].score1 = 20; matches[0].score2 = 12;
    matches[1].score1 = 18; matches[1].score2 = 14;
    matches[2].score1 = 16; matches[2].score2 = 16;

    const tourney: Tournament = {
      id: 't-playoff-4',
      name: 'Top 4 Cup',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches,
      status: 'active',
      createdAt: Date.now()
    };

    const standings = calculateStandings(tourney);
    const playoffMatches = generatePlayoffMatches(tourney, 'top4_14v23');

    assert.equal(playoffMatches.length, 1);
    const final = playoffMatches[0];
    assert.equal(final.isPlayoff, true);
    assert.equal(final.playoffType, 'final');
    assert.deepEqual(final.team1, [standings[0].id, standings[3].id], 'Team 1 debe ser Seed 1 y Seed 4');
    assert.deepEqual(final.team2, [standings[1].id, standings[2].id], 'Team 2 debe ser Seed 2 y Seed 3');
  });

  // 11. Escenario: Playoff Top 8 (Semifinales 1+8 vs 4+5, 2+7 vs 3+6, luego final y bronce)
  test('Escenario 11: Playoff Top 8 genera Semifinales balanceadas, luego Final y 3er puesto', () => {
    const players = createMockPlayers(10);
    const matches = generateAmericanoMatches(players, 5, 2);
    // Asignar scores
    matches.forEach((m, idx) => {
      m.score1 = 18 + (idx % 4);
      m.score2 = 14 - (idx % 4);
    });

    const tourney: Tournament = {
      id: 't-playoff-8',
      name: 'Top 8 Bracket',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches,
      courtsCount: 2,
      status: 'active',
      createdAt: Date.now()
    };

    const standings = calculateStandings(tourney);
    const semis = generatePlayoffMatches(tourney, 'top8_semis');
    assert.equal(semis.length, 2, 'Deben generarse 2 semifinales');

    const s1 = semis[0];
    const s2 = semis[1];
    assert.equal(s1.playoffType, 'semifinal');
    assert.equal(s2.playoffType, 'semifinal');

    // Semi 1: 1+8 vs 4+5
    assert.deepEqual(s1.team1, [standings[0].id, standings[7].id]);
    assert.deepEqual(s1.team2, [standings[3].id, standings[4].id]);

    // Semi 2: 2+7 vs 3+6
    assert.deepEqual(s2.team1, [standings[1].id, standings[6].id]);
    assert.deepEqual(s2.team2, [standings[2].id, standings[5].id]);

    // Simular que terminan las semifinales
    s1.score1 = 20; s1.score2 = 12; // Gana team1 (1+8)
    s2.score1 = 15; s2.score2 = 17; // Gana team2 (3+6)

    tourney.matches.push(...semis);

    // Generar finales a partir de semifinales
    const finals = generateFinalsFromSemis(tourney, true);
    assert.equal(finals.length, 2, 'Debe generar Gran Final y Partido de Bronce');

    const grandFinal = finals.find(m => m.playoffType === 'final')!;
    const bronzeMatch = finals.find(m => m.playoffType === 'third_place')!;

    assert.ok(grandFinal, 'Gran final debe existir');
    assert.ok(bronzeMatch, 'Partido 3er puesto debe existir');

    // Ganadores de semifinales en Gran Final
    assert.deepEqual(grandFinal.team1, s1.team1, 'Ganador SF1 a la final');
    assert.deepEqual(grandFinal.team2, s2.team2, 'Ganador SF2 a la final');

    // Perdedores de semifinales al Bronce
    assert.deepEqual(bronzeMatch.team1, s1.team2, 'Perdedor SF1 al bronce');
    assert.deepEqual(bronzeMatch.team2, s2.team1, 'Perdedor SF2 al bronce');

    // Simular scores de la final
    grandFinal.score1 = 21; grandFinal.score2 = 11;
    bronzeMatch.score1 = 18; bronzeMatch.score2 = 14;
    tourney.matches.push(grandFinal, bronzeMatch);

    assert.equal(isTournamentCompleted(tourney), true);
    const podium = getTournamentPodium(tourney);
    assert.ok(podium);
    assert.deepEqual(podium.gold, grandFinal.team1, 'Oro para el equipo ganador de la final');
    assert.deepEqual(podium.silver, grandFinal.team2, 'Plata para el subcampeón');
    assert.deepEqual(podium.bronze, bronzeMatch.team1, 'Bronce para el ganador del 3er puesto');
  });

  // 12. Escenario: Playoff Top 16 (Cuartos -> Semis -> Final)
  test('Escenario 12: Playoff Top 16 progresión completa de cuartos a final', () => {
    const players = createMockPlayers(16);
    const matches = generateAmericanoMatches(players, 4, 4);
    matches.forEach(m => { m.score1 = 16; m.score2 = 16; });

    const tourney: Tournament = {
      id: 't-playoff-16',
      name: 'Top 16 Championship',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches,
      courtsCount: 4,
      status: 'active',
      createdAt: Date.now()
    };

    const quarters = generatePlayoffMatches(tourney, 'top16_quarters');
    assert.equal(quarters.length, 4, 'Deben generarse 4 partidos de cuartos');

    quarters.forEach((q, i) => {
      q.score1 = 20;
      q.score2 = 12; // Team 1 gana todos
    });
    tourney.matches.push(...quarters);

    const semis = generateSemisFromQuarters(tourney);
    assert.equal(semis.length, 2, 'Deben generarse 2 semifinales a partir de los cuartos');
    assert.deepEqual(semis[0].team1, quarters[0].team1);
    assert.deepEqual(semis[0].team2, quarters[1].team1);
    assert.deepEqual(semis[1].team1, quarters[2].team1);
    assert.deepEqual(semis[1].team2, quarters[3].team1);
  });

  // 13. Escenario: Desempates y tieBreakReason
  test('Escenario 13: Desempate determinista con tieBreakReason explicativo', () => {
    const players = createMockPlayers(4);
    const m1: Match = {
      id: 'm1', round: 1, court: 1, team1: ['player-1', 'player-2'], team2: ['player-3', 'player-4'],
      score1: 20, score2: 12
    };
    const m2: Match = {
      id: 'm2', round: 2, court: 1, team1: ['player-1', 'player-3'], team2: ['player-2', 'player-4'],
      score1: 16, score2: 16
    };

    const tourney: Tournament = {
      id: 't-tiebreak',
      name: 'Tiebreak Test',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: [m1, m2],
      status: 'active',
      createdAt: Date.now()
    };

    const standings = calculateStandings(tourney);
    // player-1 y player-2 ganaron m1 juntos (score 20).
    // En m2 empataron 16-16.
    // player-1 y player-2 tienen 36 puntos cada uno, misma diferencia (+8).
    // Se desempatan de forma determinista y consistente.
    assert.equal(standings[0].pointsWon, 36);
    assert.equal(standings[1].pointsWon, 36);
    assert.ok(standings[0].tieBreakReason !== undefined, 'Debe incluir tieBreakReason para jugadores empatados');
  });

  // 14. Escenario: IRREVERSIBILIDAD DE PLAYOFFS
  test('Escenario 14: Irreversibilidad - Bloquea agregar rondas regulares una vez iniciados los playoffs', () => {
    const players = createMockPlayers(8);
    const regularMatches = generateAmericanoMatches(players, 4, 2);
    regularMatches.forEach(m => { m.score1 = 16; m.score2 = 16; });

    const tourney: Tournament = {
      id: 't-irreversible',
      name: 'Irreversible Playoff',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches: regularMatches,
      status: 'active',
      createdAt: Date.now()
    };

    // Antes de playoffs: Se permite agregar rondas
    const beforeCheck = canAddRegularRounds(tourney);
    assert.equal(beforeCheck.allowed, true);

    // Iniciar playoffs agregando un partido de semifinal
    tourney.matches.push({
      id: 'playoff-semi-1',
      round: 5,
      court: 1,
      team1: ['player-1', 'player-8'],
      team2: ['player-4', 'player-5'],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'semifinal'
    });

    // Después de que existen playoffs: BLOQUEO ESTRICTO
    const afterCheck = canAddRegularRounds(tourney);
    assert.equal(afterCheck.allowed, false);
    assert.equal(afterCheck.reason, 'Los playoffs ya comenzaron. No se pueden agregar rondas regulares.');

    assert.throws(() => {
      generateAdditionalAmericanoRounds(tourney, 2);
    }, /Los playoffs ya comenzaron/);
  });

  // 15. Escenario: STATE MACHINE TRANSITIONS
  test('Escenario 15: Máquina de estados del torneo (REGULAR -> REGULAR_COMPLETED -> PLAYOFFS -> COMPLETED)', () => {
    const players = createMockPlayers(4);
    const matches = generateAmericanoMatches(players, 2, 1);
    const tourney: Tournament = {
      id: 't-state',
      name: 'State Machine Test',
      type: 'americano',
      pointsPerMatch: 32,
      players,
      matches,
      status: 'active',
      createdAt: Date.now()
    };

    // Partidos sin jugar -> REGULAR
    assert.equal(getTournamentState(tourney), 'REGULAR');

    // Jugar todos los partidos regulares -> REGULAR_COMPLETED
    matches.forEach(m => { m.score1 = 16; m.score2 = 16; });
    assert.equal(getTournamentState(tourney), 'REGULAR_COMPLETED');

    // Agregar rondas regulares -> Vuelve a REGULAR
    const extraMatches = generateAdditionalAmericanoRounds(tourney, 1);
    tourney.matches.push(...extraMatches);
    assert.equal(getTournamentState(tourney), 'REGULAR');

    // Completar la ronda extra -> Vuelve a REGULAR_COMPLETED
    extraMatches[0].score1 = 16; extraMatches[0].score2 = 16;
    assert.equal(getTournamentState(tourney), 'REGULAR_COMPLETED');

    // Iniciar playoffs -> PLAYOFFS
    const playoff = generatePlayoffMatches(tourney, 'top4_14v23');
    tourney.matches.push(...playoff);
    assert.equal(getTournamentState(tourney), 'PLAYOFFS');

    // Completar el partido de la final -> COMPLETED
    playoff[0].score1 = 20; playoff[0].score2 = 12;
    assert.equal(getTournamentState(tourney), 'COMPLETED');
  });

  // 16. PROPERTY-BASED TESTING: 1,000+ Escenarios aleatorios
  test('Escenario 16: Property-Based Testing (1,000+ escenarios masivos)', () => {
    let tested = 0;
    const playerCounts = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const roundCounts = [3, 4, 5, 6, 7, 8, 10, 12];

    for (const n of playerCounts) {
      const players = createMockPlayers(n);
      const maxCourts = Math.min(4, Math.floor(n / 4));

      for (let c = 1; c <= maxCourts; c++) {
        for (const r of roundCounts) {
          // Run 5 randomized repetitions per configuration to reach 1,120 scenarios
          for (let rep = 0; rep < 5; rep++) {
            tested++;
            const matches = generateAmericanoMatches(players, r, c);
            const metrics = calculateFairnessMetrics({ players, matches }, r);

            assert.ok(
              metrics.matchDifference <= 1,
              `Fallo de equidad en N=${n}, C=${c}, R=${r}: diff=${metrics.matchDifference}`
            );

            // Si restingSlots <= playingSlots, no debe haber descansos consecutivos
            const restingPerRound = n - c * 4;
            if (restingPerRound > 0 && restingPerRound <= c * 4) {
              assert.equal(
                metrics.totalConsecutiveRests,
                0,
                `Descansos consecutivos evitables en N=${n}, C=${c}, R=${r}: ${metrics.totalConsecutiveRests}`
              );
            }
          }
        }
      }
    }
    console.log(`    (Probados ${tested} escenarios matemáticos masivos en profundidad)`);
    assert.ok(tested >= 1000, `Debe probar al menos 1000 escenarios, probó ${tested}`);
  });

  console.log('====================================================');
  console.log(`FAIRNESS SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    throw new Error(`${failed} fairness tests failed`);
  }
}

runFairnessTests();
