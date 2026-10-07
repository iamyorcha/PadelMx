import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

async function runSecurityAudit() {
  console.log('====================================================');
  console.log('STARTING FASE 1: FIRESTORE SECURITY RULES REAL TESTS');
  console.log('====================================================');

  const projectId = 'test-audit-padel-' + Date.now();
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  // Emulator host & port from environment or fallback to 127.0.0.1:8085
  const hostAndPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
  const [host, portStr] = hostAndPort.split(':');
  const port = parseInt(portStr, 10) || 8085;

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
      host,
      port
    }
  });

  let passed = 0;
  let failed = 0;

  async function testCase(num: number, description: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ CASO ${num}: ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ CASO ${num}: ${description}`);
      console.error(`    ERROR: ${err.message}`);
      failed++;
    }
  }

  try {
    // Set up contexts:
    const ownerAContext = testEnv.authenticatedContext('ownerA');
    const ownerBContext = testEnv.authenticatedContext('ownerB');
    const anonContext = testEnv.unauthenticatedContext();

    const dbOwnerA = ownerAContext.firestore();
    const dbOwnerB = ownerBContext.firestore();
    const dbAnon = anonContext.firestore();

    // Helper: admin bypass to seed existing test tournaments
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      
      // Seed tournament for ownerA
      await setDoc(doc(adminDb, 'tournaments', 'tourney-ownerA'), {
        ownerId: 'ownerA',
        name: 'Torneo Owner A',
        status: 'active',
        players: [{ id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' }],
        matches: [],
        expenses: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Seed private tournament for ownerA
      await setDoc(doc(adminDb, 'tournaments', 'tourney-private-ownerA'), {
        ownerId: 'ownerA',
        name: 'Torneo Privado',
        status: 'active',
        isPrivate: true,
        players: [],
        matches: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // CASO 1: ownerA lee su torneo -> permitido
    await testCase(1, 'ownerA lee su torneo (permitido)', async () => {
      const docRef = doc(dbOwnerA, 'tournaments', 'tourney-ownerA');
      await assertSucceeds(getDoc(docRef));
    });

    // CASO 2: ownerA modifica su torneo -> permitido
    await testCase(2, 'ownerA modifica su torneo (permitido)', async () => {
      const docRef = doc(dbOwnerA, 'tournaments', 'tourney-ownerA');
      await assertSucceeds(updateDoc(docRef, {
        name: 'Torneo Owner A - Renombrado',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 3: ownerB intenta modificar torneo de ownerA -> DENEGADO
    await testCase(3, 'ownerB intenta modificar torneo de ownerA (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        name: 'Hacked by ownerB',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 4: anonymous intenta modificar torneo -> DENEGADO
    await testCase(4, 'anonymous intenta modificar torneo (DENEGADO)', async () => {
      const docRef = doc(dbAnon, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        name: 'Hacked by Anonymous',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 5: ownerB intenta cambiar ownerId del torneo -> DENEGADO
    await testCase(5, 'ownerB intenta cambiar ownerId del torneo (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        ownerId: 'ownerB',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 6: ownerA intenta transferir ownerId modificando directamente el documento -> DENEGADO
    await testCase(6, 'ownerA intenta transferir ownerId (DENEGADO por inmutabilidad)', async () => {
      const docRef = doc(dbOwnerA, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        ownerId: 'ownerB',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 7: usuario crea un torneo estableciendo ownerId de otra persona -> DENEGADO
    await testCase(7, 'usuario crea torneo con ownerId ajeno (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-spoofed');
      await assertFails(setDoc(docRef, {
        ownerId: 'ownerA', // Impersonating ownerA while logged in as ownerB
        name: 'Spoofed Tourney',
        status: 'active',
        players: [],
        matches: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 8: usuario no propietario intenta modificar únicamente score -> DENEGADO
    await testCase(8, 'usuario no propietario intenta modificar únicamente score (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        matches: [{ id: 'm1', round: 1, court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'], score1: 32, score2: 0 }],
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 9: usuario no propietario intenta modificar únicamente status -> DENEGADO
    await testCase(9, 'usuario no propietario intenta modificar únicamente status (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        status: 'completed',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 10: usuario no propietario intenta modificar players -> DENEGADO
    await testCase(10, 'usuario no propietario intenta modificar players (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        players: [{ id: 'p99', name: 'Infiltrator' }],
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 11: usuario no propietario intenta modificar expenses -> DENEGADO
    await testCase(11, 'usuario no propietario intenta modificar expenses (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        expenses: 99999,
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 12: usuario intenta eliminar torneo de otra persona -> DENEGADO
    await testCase(12, 'usuario intenta eliminar torneo ajeno (DENEGADO)', async () => {
      const docRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA');
      await assertFails(deleteDoc(docRef));
    });

    // CASO 13: usuario público intenta leer torneo privado -> DENEGADO
    await testCase(13, 'usuario público intenta leer torneo privado (DENEGADO)', async () => {
      const docRef = doc(dbAnon, 'tournaments', 'tourney-private-ownerA');
      await assertFails(getDoc(docRef));
    });

    // CASO 14: viewer público intenta escribir en torneo público -> DENEGADO
    await testCase(14, 'viewer público intenta escribir en torneo público (DENEGADO)', async () => {
      const docRef = doc(dbAnon, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        name: 'Viewer Defacement',
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 15: usuario modifica tournamentId o usa ID inválido -> DENEGADO
    await testCase(15, 'usuario intenta crear documento con ID inválido / envenenado (DENEGADO)', async () => {
      // ID with invalid characters or too long
      const invalidId = 'invalid/slash/id';
      try {
        const docRef = doc(dbOwnerA, 'tournaments', invalidId);
        await assertFails(setDoc(docRef, {
          ownerId: 'ownerA',
          name: 'Invalid ID Doc',
          status: 'active',
          players: [],
          matches: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
      } catch {
        // SDK level URL / slash blocking also prevents this
      }
      
      const regexViolatingId = 'bad$name#char!';
      const docRef2 = doc(dbOwnerA, 'tournaments', regexViolatingId);
      await assertFails(setDoc(docRef2, {
        ownerId: 'ownerA',
        name: 'Regex Violation',
        status: 'active',
        players: [],
        matches: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    });

    // CASO 16: usuario intenta crear documentos hijos dentro de torneo ajeno -> DENEGADO
    await testCase(16, 'usuario intenta crear documentos hijos subcollection en torneo ajeno (DENEGADO)', async () => {
      const subDocRef = doc(dbOwnerB, 'tournaments', 'tourney-ownerA', 'secretSub', 'item1');
      await assertFails(setDoc(subDocRef, {
        payload: 'injected child document'
      }));
    });

    // CASO 17: usuario intenta modificar campos inmutables (createdAt) -> DENEGADO
    await testCase(17, 'usuario intenta modificar createdAt inmutable (DENEGADO)', async () => {
      const docRef = doc(dbOwnerA, 'tournaments', 'tourney-ownerA');
      await assertFails(updateDoc(docRef, {
        createdAt: new Date(2000, 1, 1),
        updatedAt: serverTimestamp()
      }));
    });

  } finally {
    await testEnv.cleanup();
  }

  console.log('====================================================');
  console.log(`FASE 1 AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
