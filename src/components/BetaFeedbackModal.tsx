import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { APP_VERSION, BUILD_ID } from '../version';
import { trackEvent, reportError } from '../utils/telemetry';
import { getHumanReadableErrorMessage } from '../utils/userMessages';
import { MessageSquare, Bug, Split, Award, Layout, Sparkles, X, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournamentFormat?: string;
  route?: string;
}

type FeedbackType = 'bug' | 'pairing' | 'ranking' | 'ui' | 'feature' | 'other';

export const BetaFeedbackModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tournamentFormat,
  route
}) => {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(auth.currentUser?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const feedbackPayload = {
      type,
      message: message.trim().slice(0, 2000),
      contactEmail: email.trim().slice(0, 100) || null,
      appVersion: APP_VERSION,
      buildId: BUILD_ID,
      tournamentFormat: tournamentFormat || 'none',
      route: route || (typeof window !== 'undefined' ? window.location.pathname : '/'),
      userId: auth.currentUser?.uid || 'guest',
      createdAt: serverTimestamp()
    };

    try {
      // Save directly to Firestore beta_feedback collection
      const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const feedbackRef = doc(db, 'beta_feedback', feedbackId);
      await setDoc(feedbackRef, feedbackPayload);

      trackEvent('beta_feedback_submitted', { type, hasEmail: Boolean(email) });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      reportError(err, { operation: 'submit_beta_feedback', extra: { type } });
      // Fallback: save to localStorage so no user feedback is ever lost
      try {
        const stored = JSON.parse(localStorage.getItem('padel_offline_feedback') || '[]');
        stored.push({ ...feedbackPayload, createdAt: new Date().toISOString() });
        localStorage.setItem('padel_offline_feedback', JSON.stringify(stored));
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setMessage('');
          onClose();
        }, 2000);
      } catch {
        setErrorMessage(getHumanReadableErrorMessage(err, 'No se pudo enviar el comentario. Inténtalo de nuevo.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Feedback Beta Pública</h2>
            <p className="text-xs text-zinc-400">Versión {APP_VERSION} ({BUILD_ID})</p>
          </div>
        </div>

        {submitted ? (
          <div className="py-8 text-center flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">¡Gracias por tu ayuda!</h3>
            <p className="text-xs text-zinc-400">Tu reporte nos ayuda a perfeccionar la app para el lanzamiento.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Categoría
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bug', label: 'Error / Bug', icon: Bug },
                  { id: 'pairing', label: 'Cruces', icon: Split },
                  { id: 'ranking', label: 'Puntuación', icon: Award },
                  { id: 'ui', label: 'Diseño / UI', icon: Layout },
                  { id: 'feature', label: 'Idea nueva', icon: Sparkles },
                  { id: 'other', label: 'Otro', icon: MessageSquare },
                ].map(cat => {
                  const Icon = cat.icon;
                  const isSelected = type === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id as FeedbackType)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-yellow-500/15 border-yellow-500 text-yellow-400 font-bold'
                          : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Descripción
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Cuéntanos qué sucedió o qué podemos mejorar..."
                rows={4}
                required
                maxLength={2000}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Email de contacto (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                maxLength={100}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
              />
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="flex-1 py-2.5 px-4 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Enviar Reporte</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
