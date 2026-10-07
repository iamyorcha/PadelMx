import assert from 'node:assert/strict';
import { sanitizeForFirestore } from './firestoreSanitizer';
import { normalizeTournament } from '../domain/tournament';

function runTests() {
  console.log('RUNNING FIRESTORE SANITIZER TESTS');

  // Test 1: Remove undefined properties from an object
  {
    const input = {
      id: '123',
      name: 'Test Tournament',
      ownerId: undefined,
      courtsCount: undefined,
      active: true,
      score: 0
    };

    const sanitized = sanitizeForFirestore(input);

    assert.deepEqual(sanitized, {
      id: '123',
      name: 'Test Tournament',
      active: true,
      score: 0
    });
    assert.equal('ownerId' in sanitized, false);
    assert.equal('courtsCount' in sanitized, false);
  }

  // Test 2: Remove undefined properties deeply from nested objects and arrays
  {
    const input = {
      id: 'tourney-1',
      matches: [
        {
          id: 'm1',
          round: 1,
          court: 1,
          team1: ['p1', 'p2'] as [string, string],
          team2: ['p3', 'p4'] as [string, string],
          score1: 16,
          score2: 16,
          isPlayoff: false,
          playoffType: undefined,
          serveFirst: undefined
        },
        {
          id: 'm2',
          round: 1,
          court: 2,
          team1: ['p5', 'p6'] as [string, string],
          team2: ['p7', 'p8'] as [string, string],
          score1: null,
          score2: null,
          isPlayoff: true,
          playoffType: 'final' as const,
          serveFirst: 1 as const
        }
      ]
    };

    const sanitized = sanitizeForFirestore(input);

    assert.deepEqual(sanitized.matches[0], {
      id: 'm1',
      round: 1,
      court: 1,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 16,
      score2: 16,
      isPlayoff: false
    });
    assert.equal('playoffType' in (sanitized.matches[0] as any), false);
    assert.equal('serveFirst' in (sanitized.matches[0] as any), false);

    assert.deepEqual(sanitized.matches[1], {
      id: 'm2',
      round: 1,
      court: 2,
      team1: ['p5', 'p6'],
      team2: ['p7', 'p8'],
      score1: null,
      score2: null,
      isPlayoff: true,
      playoffType: 'final',
      serveFirst: 1
    });
  }

  // Test 3: Preserve Date instances and Firestore FieldValue sentinels
  {
    const now = new Date();
    const fakeSentinel = { _methodName: 'serverTimestamp' };
    const fakeTimestamp = { toMillis: () => 123456789, isEqual: () => true };

    const input = {
      createdAt: now,
      updatedAt: fakeSentinel,
      stamp: fakeTimestamp,
      other: undefined
    };

    const sanitized = sanitizeForFirestore(input);
    assert.equal(sanitized.createdAt, now);
    assert.equal(sanitized.updatedAt, fakeSentinel);
    assert.equal(sanitized.stamp, fakeTimestamp);
    assert.equal('other' in sanitized, false);
  }

  // Test 4: normalizeTournament undefined safety
  {
    const raw = {
      id: '5o5n0ys',
      name: 'Americano 8 Jugadores',
      type: 'americano',
      pointsPerMatch: 32,
      players: [
        { id: 'p1', name: 'Jugador 1' },
        { id: 'p2', name: 'Jugador 2' }
      ],
      matches: [
        {
          id: 'm1',
          round: 1,
          court: 1,
          team1: ['p1', 'p2'],
          team2: ['p3', 'p4'],
          score1: 16,
          score2: 16,
          isPlayoff: false
        }
      ]
    };

    const normalized = normalizeTournament(raw);

    for (const [key, value] of Object.entries(normalized)) {
      assert.notEqual(value, undefined, `Tournament property ${key} is undefined`);
    }

    for (const match of normalized.matches) {
      for (const [key, value] of Object.entries(match)) {
        assert.notEqual(value, undefined, `Match property ${key} is undefined`);
      }
    }
  }

  console.log('ALL FIRESTORE SANITIZER TESTS PASSED');
}

runTests();
