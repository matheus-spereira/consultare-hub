'use client';

import React, { useEffect, useState } from 'react';
import { FinancialKPIs } from './components/FinancialKPIs';
import { HistoryTable } from './components/HistoryTable';
import { GroupList } from './components/GroupList';
import { HistoryChart } from './components/HistoryChart';

export default function FinancialPage() {
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [daily, setDaily] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [totals, setTotals] = useState({ total: 0, qtd: 0 });

  const fetchData = async (group: string) => {
    setLoading(true);
    try {
        const res = await fetch(`/api/admin/financial/history?group=${encodeURIComponent(group)}`);
        const data = await res.json();
        
        if (data && !data.error) {
            setDaily(data.daily?.map((d: any) => ({
                label: d.d?.split('-').reverse().slice(0, 2).join('/') || '?',
                total: d.total || 0,
                qtd: d.qtd || 0
            })) || []);
            
            setMonthly(data.monthly?.map((m: any) => ({
                label: m.m || '-',
                total: m.total || 0,
                qtd: m.qtd || 0
            })) || []);
            
            setGroups(data.groups || []);
            setTotals(data.totals || { total: 0, qtd: 0 });
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(selectedGroup); }, [selectedGroup]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      <FinancialKPIs data={totals} />
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <GroupList groups={groups} selected={selectedGroup} onSelect={setSelectedGroup} />
          <div className="xl:col-span-3 space-y-6">
              <HistoryChart title="Mensal" data={monthly} color="#1e3a8a" />
              <HistoryChart title="Diário" data={daily} color="#0ea5e9" />
          </div>
      </div>
    </div>
  );
}