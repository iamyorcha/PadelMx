import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Tournament, normalizeTournament } from './domain/tournament';
import { validateTournamentIntegrity } from './domain/integrity';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { reportError, trackEvent } from './utils/telemetry';
import { getHumanReadableErrorMessage } from './utils/userMessages';
import { sanitizeForFirestore } from './utils/firestoreSanitizer';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface AppStore {
  tournaments: Tournament[];
  activeTournamentId: string | null;
  theme: 'dark' | 'light';
  isViewer: boolean;
  isOnline: boolean;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastDeletedTournament: Tournament | null;
  clearSyncError: () => void;
  addTournament: (t: Tournament) => Promise<boolean>;
  updateTournament: (updated: Partial<Tournament> & { id: string }, operationLabel?: string) => Promise<void>;
  deleteTournament: (id: string, softDelete?: boolean) => Promise<void>;
  undoDeleteTournament: () => Promise<boolean>;
  revertLastTournamentState: (tournamentId: string) => Promise<boolean>;
  setActiveTournament: (id: string | null) => void;
  toggleTheme: () => void;
}

export const useStore = (viewerId?: string | null): AppStore => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('padel_theme') as 'dark' | 'light') || 'dark';
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastDeletedTournament, setLastDeletedTournament] = useState<Tournament | null>(null);

  // In-memory snapshot history for quick accidental rollback (e.g. accidental score edit or reset)
  const historySnapshots = useRef<Map<string, Tournament[]>>(new Map());

  const pushSnapshot = useCallback((tournament: Tournament) => {
    const history = historySnapshots.current.get(tournament.id) || [];
    const updatedHistory = [JSON.parse(JSON.stringify(tournament)), ...history.slice(0, 4)];
    historySnapshots.current.set(tournament.id, updatedHistory);
  }, []);

  const clearSyncError = useCallback(() => {
    setLastSyncError(null);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('synced');
      trackEvent('network_online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      trackEvent('network_offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('padel_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  const [tournaments, setTournaments] = useState<Tournament[]>(() => {
    try {
      const cached = localStorage.getItem('padel_tournaments_cache');
      return cached ? JSON.parse(cached).map(normalizeTournament) : [];
    } catch {
      return [];
    }
  });

  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(() => {
    if (viewerId) return viewerId;
    return localStorage.getItem('padel_active_id') || null;
  });

  // Sync tournaments to local cache for offline resilience and refresh recovery
  useEffect(() => {
    if (tournaments.length > 0) {
      try {
        localStorage.setItem('padel_tournaments_cache', JSON.stringify(tournaments));
      } catch (e) {
        console.warn('Failed to cache tournaments in localStorage', e);
      }
    }
  }, [tournaments]);

  useEffect(() => {
    if (activeTournamentId && !viewerId) {
      localStorage.setItem('padel_active_id', activeTournamentId);
    } else if (!viewerId) {
      localStorage.removeItem('padel_active_id');
    }
  }, [activeTournamentId, viewerId]);

  // Realtime Firestore listeners with health monitoring
  useEffect(() => {
    if (viewerId) {
      setSyncStatus('syncing');
      const unsub = onSnapshot(
        doc(db, 'tournaments', viewerId),
        (docSnap) => {
          if (docSnap.exists()) {
            const raw = { ...docSnap.data(), id: docSnap.id };
            const remoteTournament = normalizeTournament(raw);

            // Audit payload integrity
            const audit = validateTournamentIntegrity(remoteTournament);
            if (!audit.isValid) {
              reportError(new Error('Remote tournament payload integrity warning'), {
                operation: 'viewer_payload_audit',
                tournamentId: viewerId,
                extra: { errors: audit.errors }
              });
            }

            setTournaments([remoteTournament]);
            setSyncStatus('synced');
            setLastSyncError(null);
          } else {
            setSyncStatus('error');
            const notFoundMsg = 'El torneo solicitado no existe o ha sido eliminado.';
            setLastSyncError(notFoundMsg);
            reportError(new Error(notFoundMsg), {
              operation: 'viewer_tournament_not_found',
              tournamentId: viewerId
            });
          }
        },
        (error) => {
          const userMsg = getHumanReadableErrorMessage(error);
          setSyncStatus('error');
          setLastSyncError(userMsg);
          reportError(error, {
            operation: 'viewer_listener_error',
            tournamentId: viewerId
          });
        }
      );
      return unsub;
    } else {
      if (!auth.currentUser) {
        setSyncStatus('synced');
        return;
      }

      setSyncStatus('syncing');
      const q = query(collection(db, 'tournaments'), where('ownerId', '==', auth.currentUser.uid));

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const t: Tournament[] = [];
          snapshot.forEach((docSnap) => {
            t.push(normalizeTournament({ ...docSnap.data(), id: docSnap.id }));
          });
          const sorted = t.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt || 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt || 0;
            return timeB - timeA;
          });
          setTournaments(sorted);
          setSyncStatus('synced');
          setLastSyncError(null);

          // If active tournament was deleted or doesn't exist in fetched data, clear it
          if (activeTournamentId && snapshot.docs.length > 0 && !snapshot.docs.find((d) => d.id === activeTournamentId)) {
            setActiveTournamentId(null);
          }
        },
        (error) => {
          const userMsg = getHumanReadableErrorMessage(error);
          setSyncStatus('error');
          setLastSyncError(userMsg);
          reportError(error, {
            operation: 'user_tournaments_listener_error',
            extra: { userId: auth.currentUser?.uid }
          });
        }
      );
      return unsub;
    }
  }, [viewerId, auth.currentUser, activeTournamentId]);

  const addTournament = async (t: Tournament): Promise<boolean> => {
    // 1. Diagnostic pre-check
    const integrity = validateTournamentIntegrity(t);
    if (!integrity.isValid) {
      const err = new Error(`Integridad inválida: ${integrity.errors.join('. ')}`);
      reportError(err, { operation: 'create_tournament_validation', tournamentId: t.id });
      setLastSyncError(integrity.errors[0]);
      throw err;
    }

    const ownerId = auth.currentUser?.uid || 'guest-local-user';
    const dataToSave: Tournament = {
      ...t,
      ownerId,
      status: 'active',
      createdAt: (t.createdAt || Date.now()) as any,
      updatedAt: Date.now() as any
    };

    // Optimistic local state update
    setTournaments((prev) => [dataToSave, ...prev.filter((x) => x.id !== t.id)]);
    pushSnapshot(dataToSave);
    trackEvent('tournament_created', { format: t.type, playersCount: t.players.length });

    if (auth.currentUser) {
      setSyncStatus('syncing');
      const tournamentRef = doc(db, 'tournaments', t.id);
      try {
        await setDoc(
          tournamentRef,
          sanitizeForFirestore({
            ...dataToSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        );
        setSyncStatus('synced');
        setLastSyncError(null);
      } catch (e) {
        setSyncStatus('error');
        const userMsg = getHumanReadableErrorMessage(e, 'No se pudo guardar el nuevo torneo en la nube.');
        setLastSyncError(userMsg);
        reportError(e, {
          operation: 'create_tournament_firestore',
          tournamentId: t.id,
          tournamentFormat: t.type
        });
        throw new Error(userMsg);
      }
    }
    return true;
  };

  const updateTournament = async (
    updated: Partial<Tournament> & { id: string },
    operationLabel = 'update_tournament'
  ): Promise<void> => {
    if (viewerId) return;

    // Retrieve previous state for rollback guarantee
    const previousState = tournaments.find((t) => t.id === updated.id);
    if (previousState) {
      pushSnapshot(previousState);
    }

    // Optimistic local state update
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id === updated.id) {
          return { ...t, ...updated, updatedAt: Date.now() as any };
        }
        return t;
      })
    );

    if (auth.currentUser) {
      setSyncStatus('syncing');
      const tournamentRef = doc(db, 'tournaments', updated.id);
      try {
        await setDoc(
          tournamentRef,
          sanitizeForFirestore({
            ...updated,
            updatedAt: serverTimestamp()
          }),
          { merge: true }
        );
        setSyncStatus('synced');
        setLastSyncError(null);
        trackEvent(`mutation_${operationLabel}`, { tournamentId: updated.id });
      } catch (e) {
        // Rollback optimistic state on Firestore failure
        if (previousState) {
          setTournaments((prev) => prev.map((t) => (t.id === updated.id ? previousState : t)));
        }
        setSyncStatus('error');
        const userMsg = getHumanReadableErrorMessage(e, 'No se pudieron guardar los cambios en la nube. Se restauró el estado previo.');
        setLastSyncError(userMsg);
        reportError(e, {
          operation: operationLabel,
          tournamentId: updated.id
        });
        throw new Error(userMsg);
      }
    }
  };

  const deleteTournament = async (id: string, softDelete = false): Promise<void> => {
    const tournamentToDelete = tournaments.find((t) => t.id === id);
    if (tournamentToDelete) {
      setLastDeletedTournament(tournamentToDelete);
    }

    // Optimistic local removal
    setTournaments((prev) => prev.filter((t) => t.id !== id));
    if (activeTournamentId === id) setActiveTournamentId(null);

    if (auth.currentUser) {
      setSyncStatus('syncing');
      try {
        if (softDelete && tournamentToDelete) {
          // Soft delete flag
          await setDoc(
            doc(db, 'tournaments', id),
            sanitizeForFirestore({ isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
            { merge: true }
          );
        } else {
          await deleteDoc(doc(db, 'tournaments', id));
        }
        setSyncStatus('synced');
        setLastSyncError(null);
        trackEvent('tournament_deleted', { tournamentId: id, softDelete });
      } catch (e) {
        // Rollback removal
        if (tournamentToDelete) {
          setTournaments((prev) => [tournamentToDelete, ...prev]);
        }
        setSyncStatus('error');
        const userMsg = getHumanReadableErrorMessage(e, 'No se pudo eliminar el torneo en la nube.');
        setLastSyncError(userMsg);
        reportError(e, {
          operation: 'delete_tournament_firestore',
          tournamentId: id
        });
        throw new Error(userMsg);
      }
    }
  };

  const undoDeleteTournament = async (): Promise<boolean> => {
    if (!lastDeletedTournament) return false;
    const restored = { ...lastDeletedTournament };
    setLastDeletedTournament(null);
    return addTournament(restored);
  };

  const revertLastTournamentState = async (tournamentId: string): Promise<boolean> => {
    const history = historySnapshots.current.get(tournamentId);
    if (!history || history.length === 0) return false;
    const previous = history.shift()!;
    await updateTournament(previous, 'revert_snapshot');
    return true;
  };

  return {
    tournaments,
    activeTournamentId,
    theme,
    isViewer: Boolean(viewerId),
    isOnline,
    syncStatus,
    lastSyncError,
    lastDeletedTournament,
    clearSyncError,
    addTournament,
    updateTournament,
    deleteTournament,
    undoDeleteTournament,
    revertLastTournamentState,
    setActiveTournament: setActiveTournamentId,
    toggleTheme
  };
};

export const AppContext = createContext<AppStore | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
