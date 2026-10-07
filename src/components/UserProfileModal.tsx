import React, { useState, useEffect } from 'react';
import { X, QrCode, Edit2, Check, Loader2, Camera, User as UserIcon, Shield } from 'lucide-react';
import { User, updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import QRCode from 'react-qr-code';

import { compressImage } from '../utils/imageUtils';

interface UserProfileModalProps {
  user: any;
  onClose: () => void;
}

export function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [level, setLevel] = useState('Intermedio');
  const [side, setSide] = useState('Ambos');
  const [racket, setRacket] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(true);

  useEffect(() => {
    async function fetchUserDoc() {
      if (user.uid?.startsWith('guest-')) {
        try {
          const saved = localStorage.getItem('padel_guest_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.name) setDisplayName(parsed.name);
            if (parsed.level) setLevel(parsed.level);
            if (parsed.side) setSide(parsed.side);
            if (parsed.racket) setRacket(parsed.racket);
          }
        } catch (e) {
          console.error("Error reading guest profile", e);
        }
        setLoadingDoc(false);
        return;
      }
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.level) setLevel(data.level);
          if (data.side) setSide(data.side);
          if (data.racket) setRacket(data.racket);
        }
      } catch (err) {
        console.error("Error fetching user data", err);
      } finally {
        setLoadingDoc(false);
      }
    }
    fetchUserDoc();
  }, [user.uid]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      
      // Compress to blob
      const blob = await compressImage(file, 400, 400, 0.8);
      
      const storageRef = ref(storage, `profile_images/${user.uid}/${Date.now()}_img.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      
      // Reset input
      if (event.target) event.target.value = '';
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Hubo un error subiendo la imagen. Por favor, asegúrate de estar autenticado y vuelve a intentarlo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      if (user.uid?.startsWith('guest-')) {
        localStorage.setItem('padel_guest_profile', JSON.stringify({
          name: displayName.trim(),
          photoURL: photoURL.trim() || null,
          level,
          side,
          racket: racket.trim()
        }));
      } else {
        await updateProfile(user, {
          displayName: displayName.trim(),
          photoURL: photoURL.trim() || null
        });
        
        await setDoc(doc(db, 'users', user.uid), {
           name: displayName.trim(),
           photoURL: photoURL.trim() || null,
           level,
           side,
           racket: racket.trim(),
           email: user.email || null,
           lastLogin: new Date()
        }, { merge: true });
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile", error);
    } finally {
      setSaving(false);
    }
  };

   return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-sm flex flex-col items-center p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
         <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800 z-10">
           <X className="w-5 h-5" />
         </button>
         
         {!isEditing ? (
           <>
             <button 
                onClick={() => setIsEditing(true)} 
                className="absolute top-4 left-4 text-zinc-400 hover:text-yellow-500 p-2 rounded-full bg-zinc-800 transition-colors z-10"
                title="Editar Perfil"
             >
               <Edit2 className="w-5 h-5" />
             </button>
             <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-800 mb-3 bg-zinc-950 shadow-xl relative z-0 mt-4">
                {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-black text-3xl">
                       {user.displayName?.substring(0,2).toUpperCase() || 'U'}
                    </div>
                )}
             </div>
             
             <div className="flex items-center gap-2 mb-1">
               <h2 className="text-2xl font-black text-white text-center">{user.displayName || 'Sin Nombre'}</h2>
               {level === 'Competición' && <span title="Competición"><Shield className="w-5 h-5 text-yellow-500" /></span>}
             </div>
             
             <div className="flex flex-wrap justify-center gap-2 mb-6 mt-2">
                <span className="bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full font-bold border border-zinc-700/50">
                   Nivel: <strong className="text-yellow-500">{level || '-'}</strong>
                </span>
                <span className="bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full font-bold border border-zinc-700/50">
                   Lado: <strong className="text-white">{side || '-'}</strong>
                </span>
             </div>
             
             <div className="w-full bg-zinc-950 rounded-2xl p-4 border border-zinc-800/80 mb-6">
               <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <UserIcon className="w-3 h-3" /> Información del Jugador
               </h4>
               <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Pala</span>
                    <span className="text-white font-bold">{racket || 'No especificada'}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Email</span>
                    <span className="text-white font-medium text-xs truncate max-w-[150px]" title={user.email || ''}>{user.email || '-'}</span>
                 </div>
               </div>
             </div>
             
             <div className="bg-white p-3 rounded-2xl w-48 h-48 mb-2 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                   <QrCode className="w-20 h-20" />
                </div>
                <QRCode 
                  value={JSON.stringify({ action: 'add_player', uid: user.uid, name: user.displayName || 'Invitado' })} 
                  size={160}
                  className="z-10"
                />
             </div>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-3 text-center">Código para el organizador</p>

             <button
               onClick={async () => {
                 localStorage.removeItem('padel_guest_session');
                 try {
                   await auth.signOut();
                 } catch (e) {
                   console.error('Sign out error', e);
                 }
                 window.location.reload();
               }}
               className="mt-6 w-full py-3 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700/50 hover:border-red-500/30 rounded-xl transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
             >
               Cerrar Sesión
             </button>
           </>
         ) : (
           <div className="w-full flex flex-col items-center">
             <h3 className="text-xl font-black text-yellow-500 mb-6 uppercase tracking-widest">Editar Perfil</h3>
             
             <div className="relative group mb-6">
               <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-yellow-500/50 bg-zinc-800 flex-shrink-0 relative">
                  {uploadingImage ? (
                      <div className="w-full h-full flex items-center justify-center">
                         <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                      </div>
                  ) : photoURL ? (
                      <img src={photoURL} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-2xl">
                         {displayName?.substring(0,2).toUpperCase() || 'U'}
                      </div>
                  )}
               </div>
               <label className="absolute bottom-0 right-0 bg-yellow-500 text-black p-2 rounded-full hover:bg-yellow-400 transition-colors shadow-lg cursor-pointer transform translate-x-1 translate-y-1">
                 {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                 <input 
                   type="file" 
                   onChange={handleImageUpload} 
                   accept="image/*" 
                   className="hidden" 
                 />
               </label>
             </div>
             
             <div className="w-full space-y-4 mb-8">
               <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block pl-2">Tu Nombre</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none transition-colors font-bold"
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block pl-2">Lado preferido</label>
                      <select 
                        value={side} 
                        onChange={(e) => setSide(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none transition-colors appearance-none font-medium"
                      >
                         <option value="Revés">Revés</option>
                         <option value="Drive">Drive</option>
                         <option value="Ambos">Ambos</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block pl-2">Nivel</label>
                      <select 
                        value={level} 
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none transition-colors appearance-none font-medium"
                      >
                         <option value="Iniciación">Iniciación</option>
                         <option value="Intermedio">Intermedio</option>
                         <option value="Avanzado">Avanzado</option>
                         <option value="Competición">Competición</option>
                      </select>
                  </div>
               </div>

               <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block pl-2">Pala que usas</label>
                  <input 
                    type="text" 
                    value={racket}
                    onChange={(e) => setRacket(e.target.value)}
                    placeholder="Ej: Babolat Technical Viper"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none transition-colors font-medium"
                  />
               </div>
             </div>
             
             <div className="flex gap-3 w-full mt-auto">
               <button 
                 onClick={() => setIsEditing(false)} 
                 className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-xs"
                 disabled={saving || uploadingImage}
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleSave} 
                 className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs"
                 disabled={saving || !displayName.trim() || uploadingImage}
               >
                 {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Guardar</>}
               </button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
