'use client';

import React, { useState, useEffect } from 'react';
import { GoalHeader } from './components/GoalHeader';
import { GoalModal } from './components/GoalModal';
import { GoalTable } from './components/GoalTable';
import { GoalDetailsModal } from './components/GoalDetailsModal';
import { GoalTabs } from './components/GoalTabs';

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(undefined);
  const [detailsGoal, setDetailsGoal] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
        const resGoals = await fetch('/api/admin/goals', { cache: 'no-store' });
        const goalsList = await resGoals.json();
        setGoals(Array.isArray(goalsList) ? goalsList : []);

        const resDash = await fetch('/api/admin/goals/dashboard', { 
            cache: 'no-store'
        });
        
        if (resDash.ok) {
            const dashList = await resDash.json();
            // CORREÇÃO: Garante que dashList é uma lista válida antes de reduzir
            if (Array.isArray(dashList)) {
                const dashMap = dashList.reduce((acc, item) => {
                    if (item && item.goal_id) acc[item.goal_id] = item;
                    return acc;
                }, {} as Record<number, any>);
                setDashboardData(dashMap);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const sectorCounts = goals.reduce((acc, goal) => {
      const sec = goal.sector || 'Outros';
      acc[sec] = (acc[sec] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  const filteredGoals = goals.filter(g => {
      if (activeTab !== 'all' && g.sector !== activeTab) return false;
      const now = new Date().toISOString().split('T')[0];
      if (statusFilter === 'active') return now >= g.start_date && now <= g.end_date;
      if (statusFilter === 'future') return now < g.start_date;
      if (statusFilter === 'past') return now > g.end_date;
      return true; 
  });

  const handleSave = async (goal: any) => {
      await fetch('/api/admin/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...goal, target_value: Number(goal.target_value) || 0 })
      });
      setIsModalOpen(false);
      fetchData(); 
  };

  const handleDelete = async (id: number) => {
      if(!confirm('Deseja realmente excluir esta meta?')) return;
      await fetch(`/api/admin/goals?id=${id}`, { method: 'DELETE' });
      fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white px-6 py-4 border-b border-slate-200">
          <GoalHeader 
            onNew={() => { setEditingGoal(undefined); setIsModalOpen(true); }} 
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            sectorFilter="all" setSectorFilter={() => {}} 
          />
      </div>

      <GoalTabs activeTab={activeTab} onChange={setActiveTab} counts={sectorCounts} />

      <div className="p-6 flex-1">
        {loading ? (
            <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>)}
            </div>
        ) : filteredGoals.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500 font-medium mb-2">Nenhuma meta encontrada.</p>
            </div>
        ) : (
            <GoalTable 
                goals={filteredGoals}
                dashboardData={dashboardData} 
                onEdit={(g) => { setEditingGoal(g); setIsModalOpen(true); }} 
                onDelete={handleDelete} 
                onViewDetails={(g) => setDetailsGoal(g)}
            />
        )}
      </div>

      <GoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingGoal} />
      <GoalDetailsModal goal={detailsGoal} onClose={() => setDetailsGoal(null)} currentValue={detailsGoal ? (dashboardData[detailsGoal.id!]?.current || 0) : 0} />
    </div>
  );
}