import React, { useState, useMemo } from 'react';
import { X, Receipt, CheckCircle, Circle, Save, Plus, Trash2, Users, Share2, Loader2 } from 'lucide-react';
import { Expense, Tournament } from '../domain/tournament';

interface SplitBillModalProps {
  tournament: Tournament;
  onClose: () => void;
  onSave: (totalCost: number, payments: Record<string, boolean>, expenses: Expense[]) => void;
}

export function SplitBillModal({ tournament, onClose, onSave }: SplitBillModalProps) {
  const [totalCost, setTotalCost] = useState<number>(tournament.totalCost || 0);
  const [payments, setPayments] = useState<Record<string, boolean>>(tournament.payments || {});
  const [expenses, setExpenses] = useState<Expense[]>(tournament.expenses || []);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const playerCount = tournament.players.length;

  const handleAddExpense = () => {
    const newExpense = {
      id: Math.random().toString(36).slice(2, 9),
      description: '',
      amount: 0,
      playersAppliesTo: tournament.players.map(p => p.id)
    };
    setExpenses([...expenses, newExpense]);
    setExpandedExpense(newExpense.id);
  };

  const handleUpdateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const toggleExpensePlayer = (expenseId: string, playerId: string) => {
    setExpenses(expenses.map(e => {
      if (e.id === expenseId) {
        if (e.playersAppliesTo.includes(playerId)) {
          return { ...e, playersAppliesTo: e.playersAppliesTo.filter(id => id !== playerId) };
        } else {
          return { ...e, playersAppliesTo: [...e.playersAppliesTo, playerId] };
        }
      }
      return e;
    }));
  };

  const togglePayment = (playerId: string) => {
    setPayments(prev => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  // Calculate per-player totals
  const playerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    tournament.players.forEach(p => {
      totals[p.id] = 0;
    });

    const basePerPerson = totalCost / (playerCount || 1);
    tournament.players.forEach(p => {
      totals[p.id] += basePerPerson;
    });

    expenses.forEach(e => {
      const applicablePlayers = e.playersAppliesTo.length;
      if (applicablePlayers > 0 && e.amount > 0) {
        const costPerPerson = e.amount / applicablePlayers;
        e.playersAppliesTo.forEach(pid => {
          if (totals[pid] !== undefined) {
             totals[pid] += costPerPerson;
          }
        });
      }
    });

    return totals;
  }, [totalCost, expenses, tournament.players]);

  const totalExpected = (Object.values(playerTotals) as number[]).reduce((a, b) => a + b, 0);

  let totalCollected = 0;
  tournament.players.forEach(p => {
    if (payments[p.id]) {
        totalCollected += playerTotals[p.id];
    }
  });

  const remaining = totalExpected - totalCollected;

  const handleExportWhatsApp = () => {
    let text = `💸 *ESTADO DE CUENTA:* \n*${tournament.name.toUpperCase()}*\n`;
    text += `📅 _${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}_\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    text += `💰 *TOTAL A RECAUDAR:* *$${totalExpected.toFixed(2)}*\n`;
    if (remaining > 0) {
      text += `⏳ *RESTA COBRAR:* *$${remaining.toFixed(2)}*\n`;
    } else {
      text += `✅ *¡TODO RECAUDADO!*\n`;
    }
    text += `\n👤 *RESUMEN POR JUGADOR:*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    
    tournament.players.forEach(p => {
       const amount = playerTotals[p.id];
       const hasPaid = payments[p.id];
       const status = hasPaid ? '✅ *¡LISTO!*' : '⏳ *PENDIENTE*';
       text += `🔹 *${p.name}:* $${amount.toFixed(1)} \n   ↳  ${status}\n\n`;
    });

    const pendingPlayers = tournament.players.filter(p => !payments[p.id]);
    if (pendingPlayers.length > 0 && remaining > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `⚠️ *ACCIONES PENDIENTES:*\n`;
      text += `Los siguientes ${pendingPlayers.length} jugadores aún deben regularizar su saldo:\n`;
      pendingPlayers.forEach(p => {
        text += `• ${p.name}\n`;
      });
      text += `\n`;
    }
    
    if (expenses.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📑 *DETALLE DE GASTOS:*\n`;
      text += `🏟️ Cancha: $${totalCost.toFixed(1)}\n`;
      expenses.forEach(e => {
        text += `🛒 ${e.description}: $${e.amount.toFixed(1)}\n`;
      });
    }
    
    text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📱 *Revisa todos los detalles y fotos en:* \n${window.location.origin}/?viewer=${tournament.id}\n\n`;
    text += `_Generado automágicamente con Machos Padel_ 🎾`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md flex flex-col p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto no-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full bg-zinc-800 z-10 w-8 h-8 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <Receipt className="w-10 h-10 text-green-500 mb-3" />
          <h3 className="text-xl font-black text-white mb-1 text-center leading-tight tracking-tight">Cuentas y Pagos</h3>
          <p className="text-xs text-zinc-400 text-center px-4">
            Separa consumos y divide los costos fácilmente.
          </p>
        </div>

        <div className="w-full space-y-5">
          {/* Base Cost */}
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Costo Base (Cancha)</label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-zinc-400">$</span>
              <input 
                type="number"
                value={totalCost === 0 ? '' : totalCost}
                onChange={e => setTotalCost(Number(e.target.value) || 0)}
                placeholder="0"
                className="bg-transparent border-none text-2xl font-black text-white w-full focus:outline-none"
              />
            </div>
            <div className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
               <Users className="w-3 h-3" /> {playerCount} jugadores (Dividido equitativamente)
            </div>
          </div>

          {/* Expenses */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Consumos Extra</label>
                <button onClick={handleAddExpense} className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-zinc-700 transition-colors">
                  <Plus className="w-3 h-3" /> Añadir
                </button>
             </div>

             {expenses.length === 0 ? (
               <div className="text-center p-4 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-xs">
                 Sin consumos extras registrados.
               </div>
             ) : (
               expenses.map((expense) => {
                 const isExpanded = expandedExpense === expense.id;
                 return (
                   <div key={expense.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden transition-all">
                      <div className="p-3 flex items-center gap-2">
                        <input 
                          type="text"
                          value={expense.description}
                          onChange={e => handleUpdateExpense(expense.id, { description: e.target.value })}
                          placeholder="Ej: Cervezas..."
                          className="flex-1 min-w-0 bg-transparent border-none text-sm font-bold text-white focus:outline-none placeholder:text-zinc-600 truncate"
                        />
                        <div className="flex items-center gap-1 bg-zinc-900 rounded-xl px-2 py-1 border border-zinc-800 shrink-0">
                          <span className="text-sm font-bold text-zinc-400">$</span>
                          <input 
                            type="number"
                            value={expense.amount === 0 ? '' : expense.amount}
                            onChange={e => handleUpdateExpense(expense.id, { amount: Number(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-14 bg-transparent border-none text-sm font-bold text-white focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                          />
                        </div>
                        <button onClick={() => setExpandedExpense(isExpanded ? null : expense.id)} className={`shrink-0 p-2 rounded-lg transition-colors ${isExpanded ? 'bg-yellow-500/20 text-yellow-500' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                           <Users className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemoveExpense(expense.id)} className="shrink-0 p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {isExpanded && (
                         <div className="p-3 bg-zinc-900/50 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-200">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Aplica a:</div>
                            <div className="flex flex-wrap gap-1.5">
                               {tournament.players.map(p => {
                                 const isIncluded = expense.playersAppliesTo.includes(p.id);
                                 return (
                                   <button 
                                      key={p.id}
                                      onClick={() => toggleExpensePlayer(expense.id, p.id)}
                                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                                        isIncluded ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                      }`}
                                   >
                                     {p.name}
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                      )}
                   </div>
                 );
               })
             )}
          </div>

          <div className="h-px w-full bg-zinc-800 my-2" />

          {/* Totals Summary */}
          <div className="flex justify-between items-center p-2 text-xs">
            <span className="text-zinc-400">Total General: <span className="text-white font-bold">${totalExpected.toFixed(2)}</span></span>
            <span className="text-zinc-400">Recaudado: <span className="text-green-500 font-bold">${totalCollected.toFixed(2)}</span></span>
            <span className="text-zinc-400">Falta: <span className="text-red-400 font-bold">${remaining.toFixed(2)}</span></span>
          </div>

          {/* Players to Pay */}
          <div className="bg-black/50 p-2 rounded-2xl border border-zinc-800/50 space-y-1">
            {tournament.players.map(p => {
              const hasPaid = payments[p.id] || false;
              const amountOwed = playerTotals[p.id];
              return (
                <button 
                  key={p.id}
                  onClick={() => togglePayment(p.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    hasPaid ? 'bg-green-500/10 hover:bg-green-500/20' : 'hover:bg-zinc-800'
                  }`}
                >
                  <span className={`font-semibold ${hasPaid ? 'text-green-500' : 'text-zinc-300'}`}>{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${hasPaid ? 'text-green-500' : 'text-white'}`}>${amountOwed.toFixed(1)}</span>
                    {hasPaid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button 
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave(totalCost, payments, expenses);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="w-full bg-white text-black font-black text-[13px] py-4 px-6 rounded-2xl shadow-lg transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Cuentas'}
          </button>

          <button 
            onClick={handleExportWhatsApp}
            className="w-full bg-emerald-600 text-white font-black text-[13px] py-3 px-6 rounded-2xl shadow-lg transition-all uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Share2 className="w-4 h-4" />
            Compartir en WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
