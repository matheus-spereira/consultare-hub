'use client';

import React, { useEffect, useState } from 'react';
import { UserCheck, Calendar, Trophy, Percent, Info, MapPin, Users, Search, HelpCircle } from 'lucide-react';

export default function ProductivityPage() {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); // NOVO: Estado para busca
    
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    
    const [rankingData, setRankingData] = useState<any[]>([]);
    const [unitData, setUnitData] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end });
            const res = await fetch(`/api/admin/produtividade?${params.toString()}`);
            const data = await res.json();
            
            if (data.userStats) processRanking(data.userStats);
            if (data.unitStats) setUnitData(data.unitStats);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const processRanking = (stats: any[]) => {
        const grouped: Record<string, any> = {};
        stats.forEach(item => {
            if (!grouped[item.user]) {
                grouped[item.user] = { 
                    user: item.user, 
                    total: 0, 
                    confirmed: 0,
                    noshow: 0,    // NOVO: Contar faltas (Status 6)
                    canceled: 0   // NOVO: Contar cancelamentos (11, 22, etc)
                };
            }
            grouped[item.user].total += item.qtd;
            
            // Sucesso: 7 (Confirmado) ou 3 (Atendido)
            if ([7, 3].includes(item.status_id)) grouped[item.user].confirmed += item.qtd;
            
            // Falha: 6 (Falta)
            if (item.status_id === 6) grouped[item.user].noshow += item.qtd;
            
            // Cancelado: 11 (Desmarcado), 22 (Cancelado)
            if ([11, 22, 15, 16].includes(item.status_id)) grouped[item.user].canceled += item.qtd;
        });
        setRankingData(Object.values(grouped).sort((a:any, b:any) => b.total - a.total));
    };

    useEffect(() => { fetchData(); }, [dateRange]);

    // LÓGICA DE FILTRO DA PESQUISA
    const filteredUsers = rankingData.filter(u => 
        u.user.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="p-3 bg-blue-600 text-white rounded-lg shadow-md">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Produtividade & Qualidade</h1>
                        <p className="text-slate-500 text-xs">Monitoramento de performance por Unidade e Equipe</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full md:w-auto">
                    <Calendar size={16} className="text-slate-500" />
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-transparent text-sm outline-none w-32"
                    />
                    <span className="text-slate-400">até</span>
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-transparent text-sm outline-none w-32"
                    />
                </div>
            </div>

            {/* SEÇÃO 1: UNIDADES */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <MapPin size={18} className="text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Performance por Unidade</h2>
                </div>
                <div className="flex flex-col md:flex-row gap-4 w-full">
                    {unitData.map((unit) => {
                        const rate = unit.total_agendado > 0 ? ((unit.confirmados / unit.total_agendado) * 100).toFixed(1) : '0.0';
                        const isGood = Number(rate) > 70; 
                        return (
                            <div key={unit.unit_name} className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-w-[250px]">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-700 text-sm truncate pr-2" title={unit.unit_name}>{unit.unit_name}</span>
                                    <span className={`text-xl font-extrabold ${isGood ? 'text-emerald-600' : 'text-amber-500'}`}>{rate}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                                    <div className={`h-2 rounded-full transition-all duration-1000 ${isGood ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${rate}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Tx. Confirmação</span>
                                    <span>{unit.confirmados} / {unit.total_agendado}</span>
                                </div>
                            </div>
                        );
                    })}
                    {unitData.length === 0 && !loading && (
                         <div className="w-full bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">
                            Sem dados de unidade no período.
                         </div>
                    )}
                </div>
            </div>

            {/* SEÇÃO 2: USUÁRIOS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                    <div className="flex items-center gap-2">
                        <Trophy size={20} className="text-amber-500" />
                        <h2 className="font-bold text-slate-700">Produtividade Individual</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* NOVO: CAMPO DE BUSCA */}
                        <div className="relative group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Buscar usuário..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 w-full sm:w-48 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                            <Info size={16} className="text-blue-500 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-blue-700 leading-tight">
                                <strong>Sucesso =</strong> Confirmado (7) + Atendido (3).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredUsers.map((u, idx) => {
                        const rate = u.total > 0 ? ((u.confirmed / u.total) * 100).toFixed(0) : 0;
                        const isTop3 = idx < 3 && searchTerm === ''; // Só mostra troféu se não estiver filtrando

                        return (
                            <div 
                                key={u.user} 
                                className={`
                                    group relative flex flex-col p-3 rounded-lg border transition-all hover:shadow-md
                                    ${isTop3 ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-slate-100 hover:border-blue-200'}
                                `}
                            >
                                {/* TOOLTIP NATIVO SIMPLES (Title) PARA DETALHES RÁPIDOS */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="cursor-help" title={`Faltas: ${u.noshow} | Cancelados: ${u.canceled}`}>
                                        <HelpCircle size={14} className="text-slate-300 hover:text-blue-500" />
                                    </div>
                                </div>

                                <div className="flex items-start justify-between mb-2 gap-2 pr-4">
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <span className={`
                                            w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                                            ${isTop3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}
                                        `}>
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-700 break-words leading-tight">
                                            {u.user}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                        <span>Sucesso: {u.confirmed}</span>
                                        <span>Total: {u.total}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                            {/* Parte Verde: Sucesso */}
                                            <div className="bg-emerald-500 h-full" style={{ width: `${rate}%` }} />
                                            {/* Parte Vermelha: Faltas (Visualização avançada) */}
                                            <div className="bg-red-300 h-full" style={{ width: `${(u.noshow / u.total) * 100}%` }} />
                                        </div>
                                        <span className={`text-xs font-bold ${Number(rate) > 60 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {rate}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {filteredUsers.length === 0 && !loading && (
                    <div className="text-center text-slate-400 py-12">
                        <Users size={48} className="mx-auto mb-2 opacity-20" />
                        <p>{searchTerm ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum dado encontrado no período.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}