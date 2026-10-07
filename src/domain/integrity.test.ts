import { validateTournamentIntegrity, TOURNAMENT_LIMITS } from './integrity';
import { Tournament } from './tournament';

function runIntegrityTests() {
  console.log('====================================================');
  console.log('RUNNING TOURNAMENT INTEGRITY DIAGNOSTIC TEST SUITE');
  console.log('====================================================');

  const validTournament: Tournament = {
    id: 't-valid-1',
    name: 'Gran Torneo Padel',
    type: 'americano',
    pointsPerMatch: 32,
    status: 'active',
    players: [
      { id: 'p1', name: 'Alejandro Galán' },
      { id: 'p2', name: 'Juan Lebrón' },
      { id: 'p3', name: 'Agustín Tapia' },
      { id: 'p4', name: 'Arturo Coello' }
    ],
    matches: [
      {
        id: 'm1',
        round: 1,
        court: 1,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        score1: 18,
        score2: 14
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // 1. Valid tournament passes
  const res1 = validateTournamentIntegrity(validTournament);
  if (!res1.isValid || res1.errors.length > 0) {
    throw new Error(`Valid tournament failed integrity: ${res1.errors.join(', ')}`);
  }
  console.log('  ✓ Valid tournament passes all integrity checks');

  // 2. Duplicate player in match fails
  const corruptMatchTournament: Tournament = {
    ...validTournament,
    matches: [
      {
        id: 'm-corrupt',
        round: 1,
        court: 1,
        team1: ['p1', 'p2'],
        team2: ['p1', 'p3'], // p1 is in both teams!
        score1: 16,
        score2: 16
      }
    ]
  };
  const res2 = validateTournamentIntegrity(corruptMatchTournament);
  if (res2.isValid || !res2.errors.some(e => e.includes('repetido en la misma pista'))) {
    throw new Error('Failed to detect duplicate player in match');
  }
  console.log('  ✓ Rejects match with duplicate player on the same court');

  // 3. Match referencing non-existent player fails
  const phantomPlayerTournament: Tournament = {
    ...validTournament,
    matches: [
      {
        id: 'm-phantom',
        round: 1,
        court: 1,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p999_phantom'],
        score1: 10,
        score2: 22
      }
    ]
  };
  const res3 = validateTournamentIntegrity(phantomPlayerTournament);
  if (res3.isValid || !res3.errors.some(e => e.includes('no figura en la lista de jugadores'))) {
    throw new Error('Failed to detect ghost player in match reference');
  }
  console.log('  ✓ Rejects match with non-existent player ID reference');

  // 4. Incomplete score (score1 without score2) fails
  const incompleteScoreTournament: Tournament = {
    ...validTournament,
    matches: [
      {
        id: 'm-incomplete',
        round: 1,
        court: 1,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        score1: 16,
        score2: null
      }
    ]
  };
  const res4 = validateTournamentIntegrity(incompleteScoreTournament);
  if (res4.isValid || !res4.errors.some(e => e.includes('marcador incompleto'))) {
    throw new Error('Failed to detect half-entered match score');
  }
  console.log('  ✓ Rejects match with half-entered score');

  // 5. Insufficient players (< 4) fails
  const tooFewPlayersTournament: Tournament = {
    ...validTournament,
    players: [
      { id: 'p1', name: 'Jugador 1' },
      { id: 'p2', name: 'Jugador 2' }
    ]
  };
  const res5 = validateTournamentIntegrity(tooFewPlayersTournament);
  if (res5.isValid || !res5.errors.some(e => e.includes('al menos 4 jugadores'))) {
    throw new Error('Failed to reject tournament with less than 4 players');
  }
  console.log('  ✓ Enforces minimum player threshold (>= 4)');

  // 6. Excessive name lengths
  const longNameTournament: Tournament = {
    ...validTournament,
    name: 'A'.repeat(TOURNAMENT_LIMITS.MAX_TOURNAMENT_NAME_LENGTH + 10)
  };
  const res6 = validateTournamentIntegrity(longNameTournament);
  if (res6.isValid || !res6.errors.some(e => e.includes('no puede superar'))) {
    throw new Error('Failed to reject oversized tournament name');
  }
  console.log('  ✓ Enforces maximum tournament name boundary');

  console.log('====================================================');
  console.log('INTEGRITY TEST RESULTS: ALL 6 TESTS PASSED');
  console.log('====================================================\n');
}

runIntegrityTests();
