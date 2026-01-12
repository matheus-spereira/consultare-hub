'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, AlertCircle, WifiOff, MessageCircle, Smartphone } from 'lucide-react';
import { UnitData, ReceptionResponse } from './types';
import { UnitCard } from './components/UnitCard';
import { formatMinutesToHours } from '@/lib/utils';

// Mapeamento Nome (Médico) -> ID (Recepção)
const MEDIC_TO_RECEPTION_MAP: Record<string, string> = {
  "Ouro Verde": "2",
  "Centro Cambui": "3", 
  "Campinas Shopping": "12",
};

// Interface para o dado do WhatsApp
interface WhatsAppData {
  queue: number;
  avgWaitSeconds: number;
}

export default function MonitorPage() {
  const [medicData, setMedicData] = useState<UnitData[]>([]);
  const [receptionData, setReceptionData] = useState<ReceptionResponse | null>(null);
  const [whatsAppData, setWhatsAppData] = useState<WhatsAppData | null>(null); // NOVO
  
  const [loading, setLoading] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date | null>(null);
  const [lastUpdatedString, setLastUpdatedString] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDataStale, setIsDataStale] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Adicionado o fetch do WhatsApp
      const [resMedic, resRecep, resWhats] = await Promise.all([
        fetch('/api/queue/medic', { cache: 'no-store' }),
        fetch('/api/queue/reception', { cache: 'no-store' }),
        fetch('/api/queue/whatsapp', { cache: 'no-store' })
      ]);

      if (resMedic.ok) {
        const jsonMedic = await resMedic.json();
        const data = Array.isArray(jsonMedic) ? jsonMedic : (jsonMedic?.data || []);
        setMedicData(data);
      }

      if (resRecep.ok) {
        const jsonRecep = await resRecep.json();
        setReceptionData(jsonRecep.data || jsonRecep || null);
      }

      // Processa WhatsApp
      if (resWhats.ok) {
        const jsonWhats = await resWhats.json();
        setWhatsAppData(jsonWhats.data);
      }

      if (!resMedic.ok && !resRecep.ok) throw new Error('Falha parcial');

      const now = new Date();
      setLastUpdatedTime(now);
      setLastUpdatedString(now.toLocaleTimeString('pt-BR'));
      setError(null);
      setIsDataStale(false);
    } catch (err) {
      console.error(err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 15000);
    const staleId = setInterval(() => {
        if (lastUpdatedTime && (new Date().getTime() - lastUpdatedTime.getTime()) > 300000) {
            setIsDataStale(true);
        }
    }, 5000);
    return () => { clearInterval(intervalId); clearInterval(staleId); };
  }, [fetchData, lastUpdatedTime]);

  // Formata o tempo médio do WhatsApp (minutos)
  const whatsAvgMinutes = whatsAppData ? Math.round(whatsAppData.avgWaitSeconds / 60) : 0;
  const isWhatsHigh = (whatsAppData?.queue || 0) > 10;

  return (
    <div className={`p-4 min-h-screen transition-colors duration-500 ${isDataStale ? 'bg-red-50' : 'bg-slate-100'}`}>
      <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        
        {/* Bloco Título */}
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
             {isDataStale ? <WifiOff className="text-red-600 animate-pulse" /> : <Clock className="text-blue-600" />}
             {isDataStale ? <span className="text-red-600">DADOS DESATUALIZADOS</span> : <span>Painel Integrado</span>}
           </h1>
           <p className={`text-sm mt-1 font-medium ${isDataStale ? 'text-red-500' : 'text-slate-500'}`}>
             Monitoramento Unificado: Recepção &rarr; Médico &rarr; Digital
           </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            
            {/* --- NOVO: STATUS DO WHATSAPP (DIGITAL) --- */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border shadow-sm transition-colors ${isWhatsHigh ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <div className={`p-2 rounded-full ${isWhatsHigh ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    <MessageCircle size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fila Digital</span>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                           <span className={`text-lg font-bold ${isWhatsHigh ? 'text-red-700' : 'text-slate-700'}`}>
                             {whatsAppData?.queue ?? '-'}
                           </span>
                           <span className="text-xs text-slate-400">aguardando</span>
                        </div>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <div className="flex items-center gap-1">
                           <Clock size={12} className="text-slate-400" />
                           <span className={`text-sm font-bold ${whatsAvgMinutes > 15 ? 'text-amber-600' : 'text-slate-600'}`}>
                             {formatMinutesToHours(whatsAvgMinutes)}
                           </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status de Conexão */}
            <div className={`flex items-center gap-2 text-xs transition-colors ${isDataStale ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDataStale ? 'bg-red-400' : 'bg-green-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isDataStale ? 'bg-red-500' : 'bg-green-500'}`}></span>
                </span>
                {lastUpdatedString || '--:--:--'}
            </div>
            
            <button onClick={fetchData} disabled={loading} className="p-2 bg-white hover:bg-slate-50 rounded-lg border shadow-sm active:scale-95 transition-all">
                <RefreshCw size={14} className={loading ? "animate-spin text-slate-400" : "text-slate-700"} />
            </button>
        </div>
      </header>

      {loading && medicData.length === 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-[500px] bg-slate-200 rounded-lg animate-pulse" />)}
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {medicData.map((unit, idx) => {
                const receptionId = MEDIC_TO_RECEPTION_MAP[unit.id] || "0";
                const unitReceptionStats = receptionData?.por_unidade?.[receptionId];
                return (
                    <UnitCard 
                        key={`unit-${unit.id || idx}`} 
                        unit={unit} 
                        receptionStats={unitReceptionStats} 
                    />
                );
            })}
        </div>
      )}
    </div>
  );
}