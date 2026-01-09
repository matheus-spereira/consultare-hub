import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

interface DbRow {
  hash_id: string;
  unidade_nome: string;
  paciente: string;
  especialidade: string;
  profissional: string;
  hora_agendada: string;
  status: string;
  dt_chegada: string;
  dt_atendimento: string | null;
  idade?: string;
}

function calculateWaitTime(dt_chegada: string): number {
  if (!dt_chegada) return 0;
  try {
    const arrival = new Date(dt_chegada);
    const now = new Date();
    const diffMs = now.getTime() - arrival.getTime();
    return Math.floor(diffMs / 60000);
  } catch (e) {
    return 0;
  }
}

function formatTime(dt_chegada: string): string {
  if (!dt_chegada) return '--:--';
  try {
    const parts = dt_chegada.split(' ');
    return parts.length > 1 ? parts[1].substring(0, 5) : dt_chegada;
  } catch {
    return '--:--';
  }
}

export async function GET() {
  try {
    const db = getDbConnection();
    const today = new Date().toISOString().split('T')[0];

    const EXPECTED_UNITS = [
      { id: "Ouro Verde", label: "OURO VERDE" },
      { id: "Centro Cambui", label: "CENTRO CAMBUÍ" },
      { id: "Campinas Shopping", label: "CAMPINAS SHOPPING" }
    ];

    const unitsMap = new Map<string, any>();
    EXPECTED_UNITS.forEach(u => {
      unitsMap.set(u.id, {
        id: u.id,
        name: u.label,
        patients: [],
        totalAttended: 0,
        averageWaitDay: 0 // Nova métrica: média do dia
      });
    });

    // 1. Busca FILA ATUAL (Espera + Em Atendimento)
    const queueStmt = db.prepare(`
      SELECT * FROM espera_medica_historico 
      WHERE status NOT IN ('Atendido_Inferido', 'Cancelado', 'Finalizado')
      AND dia_referencia = ?
      ORDER BY dt_chegada ASC
    `);
    const queueRows = queueStmt.all(today) as DbRow[];

    queueRows.forEach((row) => {
      const rawUnitName = row.unidade_nome || 'Desconhecida';
      if (!unitsMap.has(rawUnitName)) {
        unitsMap.set(rawUnitName, { id: rawUnitName, name: rawUnitName.toUpperCase(), patients: [], totalAttended: 0, averageWaitDay: 0 });
      }

      const statusFront = row.status === 'Espera' ? 'waiting' : 'in_service';

      unitsMap.get(rawUnitName).patients.push({
        id: row.hash_id,
        name: row.paciente,
        service: row.especialidade || '',
        professional: row.profissional || '',
        arrival: formatTime(row.dt_chegada),
        waitTime: calculateWaitTime(row.dt_chegada),
        status: statusFront,
        priority: {
            isElderly: (row.paciente?.toLowerCase().includes('idoso')) || (row.idade && parseInt(row.idade) >= 60),
            isWheelchair: row.paciente?.toLowerCase().includes('cadeirante'),
            isPregnant: row.paciente?.toLowerCase().includes('gestante')
        }
      });
    });

    // 2. Calcula MÉTRICAS DO DIA (Total e Média de quem já foi atendido)
    const statsStmt = db.prepare(`
      SELECT 
        unidade_nome, 
        COUNT(*) as total,
        AVG((strftime('%s', dt_atendimento) - strftime('%s', dt_chegada)) / 60) as media_minutos
      FROM espera_medica_historico 
      WHERE status IN ('Atendido_Inferido', 'Finalizado')
      AND dia_referencia = ?
      AND dt_atendimento IS NOT NULL
      GROUP BY unidade_nome
    `);
    const statsRows = statsStmt.all(today) as { unidade_nome: string, total: number, media_minutos: number }[];

    statsRows.forEach(stat => {
      if (unitsMap.has(stat.unidade_nome)) {
        const unit = unitsMap.get(stat.unidade_nome);
        unit.totalAttended = stat.total;
        unit.averageWaitDay = Math.round(stat.media_minutos || 0);
      }
    });

    return NextResponse.json({ 
      status: 'success', 
      data: Array.from(unitsMap.values()), 
      timestamp: new Date().toISOString() 
    });
    
  } catch (error) {
    console.error('Erro ao ler banco de médicos:', error);
    return NextResponse.json({ error: 'Falha ao buscar fila médica' }, { status: 500 });
  }
}