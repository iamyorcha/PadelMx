/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Home } from './components/Home';
import { CreateTournament } from './components/CreateTournament';
import { TournamentDashboard } from './components/TournamentDashboard';
import { GlobalRankings } from './components/GlobalRankings';
import { AppContext, useStore } from './store';
import { AuthWrapper } from './components/AuthWrapper';
import { TVMode } from './components/TVMode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SyncStatusBanner } from './components/SyncStatusBanner';

function AppContent({ viewerId, isTV }: { viewerId?: string | null, isTV?: boolean }) {
  const store = useStore(viewerId);
  const [route, setRoute] = useState<string>(store.activeTournamentId ? 'tournament' : 'home');

  const handleNavigate = (newRoute: string) => {
    setRoute(newRoute);
  };

  if (isTV && viewerId) {
    return (
      <AppContext.Provider value={store}>
         <TVMode tournamentId={viewerId} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={store}>
      {route === 'tv' && store.activeTournamentId ? (
         <TVMode tournamentId={store.activeTournamentId} onNavigate={handleNavigate} />
      ) : (
        <div className="w-full h-screen bg-black overflow-hidden font-sans text-zinc-100 flex flex-col items-center relative">
          <div className="w-full h-full sm:max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-7xl relative bg-zinc-950 shadow-2xl flex flex-col sm:border-x sm:border-zinc-900 overflow-hidden">
            <SyncStatusBanner />
            {route === 'home' && <Home onNavigate={handleNavigate} />}
            {route === 'create' && <CreateTournament onNavigate={handleNavigate} />}
            {route === 'tournament' && <TournamentDashboard onNavigate={handleNavigate} />}
            {route === 'global-rankings' && <GlobalRankings onNavigate={handleNavigate} />}
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewerId = urlParams.get('viewer');
  const isTV = urlParams.get('tv') === 'true';

  return (
    <ErrorBoundary>
      <AuthWrapper onSharedView={() => <AppContent viewerId={viewerId} isTV={isTV} />}>
        {() => <AppContent />}
      </AuthWrapper>
    </ErrorBoundary>
  );
}
