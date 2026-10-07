import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Trophy, Network, BarChart2, Users } from 'lucide-react';

export function AuthWrapper({ children, onSharedView }: { 
  children: (user: User) => React.ReactNode, 
  onSharedView: () => React.ReactNode 
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const isViewerMode = new URLSearchParams(window.location.search).has('viewer');
  const isGuestMode = new URLSearchParams(window.location.search).has('guest') || 
                      new URLSearchParams(window.location.search).has('test_user') ||
                      localStorage.getItem('padel_guest_session') === 'true';

  const [guestUser, setGuestUser] = useState<User | null>(() => {
    if (isGuestMode) {
      return {
        uid: 'guest-local-user',
        displayName: 'Organizador Invitado',
        email: 'invitado@padel.local',
        photoURL: ''
      } as unknown as User;
    }
    return null;
  });

  useEffect(() => {
    if (isViewerMode) {
      setLoading(false);
      return;
    }
    if (guestUser) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Cree el perfil si el usuario se acaba de loguear
      if (u) {
        try {
          await setDoc(doc(db, 'users', u.uid), {
             name: u.displayName || 'Jugador',
             email: u.email || null,
             photoURL: u.photoURL || null,
             lastLogin: serverTimestamp()
          }, { merge: true });
        } catch(e) {
          console.error("Error creating user profile", e);
        }
      }
      
      setLoading(false);
    });
    return unsubscribe;
  }, [isViewerMode, guestUser]);

  const handleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Error logging in', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError('El proceso de inicio de sesión fue cancelado.');
      } else if (error.code === 'auth/blocked-by-popup-presenter' || error.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes e inténtalo de nuevo.');
      } else {
        setError('Ocurrió un error al iniciar sesión. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('padel_guest_session', 'true');
    setGuestUser({
      uid: 'guest-local-user',
      displayName: 'Organizador Invitado',
      email: 'invitado@padel.local',
      photoURL: ''
    } as unknown as User);
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mb-4" />
        <p className="text-zinc-500 font-medium tracking-widest text-sm uppercase">Cargando...</p>
      </div>
    );
  }

  if (isViewerMode) {
    return <>{onSharedView()}</>;
  }

  if (!user && !guestUser) {
    return (
      <div className="w-full min-h-screen bg-black font-sans text-white flex flex-col items-center justify-center relative overflow-hidden overflow-y-auto">
        {/* Background Effects */}
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-red-600/20 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-yellow-600/10 to-transparent pointer-events-none"></div>
        
        <div className="flex z-10 flex-col items-center justify-center w-full max-w-2xl px-6 py-12">
            <img src="/logo.png" alt="Machos Padel" className="w-[320px] md:w-[400px] object-contain mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.2)]" />
            
            <div className="text-center mb-16 px-4">
                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-tight">
                   <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500">COMPITE.</span><br/>
                   <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-300">CONECTA.</span><br/>
                   <span className="text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700">GANA.</span>
                </h1>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 w-full mb-16 text-center">
                {/* Feature 1 */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border border-yellow-500/30 flex items-center justify-center mb-3 bg-yellow-500/10 text-yellow-500">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-yellow-500 tracking-wider mb-2 uppercase">Crea Torneos</h3>
                    <p className="text-[10px] text-zinc-400">Organiza torneos en minutos y administra todo fácilmente.</p>
                </div>
                {/* Feature 2 */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border border-red-500/30 flex items-center justify-center mb-3 bg-red-500/10 text-red-500">
                        <Network className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-red-500 tracking-wider mb-2 uppercase">Lleva Puntajes</h3>
                    <p className="text-[10px] text-zinc-400">Actualiza resultados en tiempo real y lleva el control de cada partido.</p>
                </div>
                {/* Feature 3 */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border border-emerald-500/30 flex items-center justify-center mb-3 bg-emerald-500/10 text-emerald-500">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-emerald-500 tracking-wider mb-2 uppercase">Estadísticas</h3>
                    <p className="text-[10px] text-zinc-400">Analiza tu rendimiento y mejora tu juego con estadísticas detalladas.</p>
                </div>
                {/* Feature 4 */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border border-zinc-300/30 flex items-center justify-center mb-3 bg-white/5 text-white">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-xs font-bold text-white tracking-wider mb-2 uppercase">Comunidad</h3>
                    <p className="text-[10px] text-zinc-400">Conecta con jugadores, equipos y clubes que viven el pádel como tú.</p>
                </div>
            </div>
            
            {error && (
              <div className="w-full max-w-sm mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-500 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className={`w-full relative group overflow-hidden max-w-sm bg-transparent border-2 border-yellow-500 text-yellow-500 hover:text-black font-black text-sm py-5 px-6 rounded-[32px] transition-all flex items-center justify-center gap-3 uppercase tracking-widest shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="absolute inset-0 bg-yellow-500 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin relative z-10" />
              ) : (
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="currentColor"
                  />
                </svg>
              )}
              <span className="relative z-10">{isLoggingIn ? 'Iniciando sesión...' : 'Entrar / Registrarse'}</span>
            </button>
            
            <button
              onClick={handleGuestLogin}
              disabled={isLoggingIn}
              id="guest-login-btn"
              className="mt-4 text-xs font-bold text-zinc-400 hover:text-white transition-colors tracking-widest uppercase underline py-2 px-4 rounded-xl hover:bg-zinc-900"
            >
              Continuar como Invitado (Modo Local)
            </button>
            
            <div className="mt-10 text-center">
                 <p className="text-[10px] tracking-[0.3em] font-medium text-zinc-500 uppercase">Más que un deporte,</p>
                 <p className="text-[10px] tracking-[0.3em] font-medium text-yellow-600 uppercase mt-1">Un estilo de vida.</p>
            </div>
        </div>
      </div>
    );
  }

  return <>{children((user || guestUser)!)}</>;
}
