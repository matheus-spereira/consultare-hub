import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || startDate;
    
    const db = getDbConnection();

    // 1. RANKING DE USUÁRIOS (Agendamentos por status)
    const userStats = db.prepare(`
        SELECT 
            scheduled_by as user,
            status_id,
            COUNT(*) as qtd,
            SUM(value) as total_valor
        FROM feegow_appointments
        WHERE date BETWEEN ? AND ?
        AND scheduled_by IS NOT NULL AND scheduled_by != '' AND scheduled_by != 'Sistema'
        GROUP BY scheduled_by, status_id
        ORDER BY qtd DESC
    `).all(startDate, endDate);

    // 2. TAXA DE CONFIRMAÇÃO POR UNIDADE
    // Considera: Total = Todos os agendamentos | Confirmados = Status 7
    const unitStats = db.prepare(`
        SELECT 
            unit_name,
            COUNT(*) as total_agendado,
            SUM(CASE WHEN status_id = 7 THEN 1 ELSE 0 END) as confirmados
        FROM feegow_appointments
        WHERE date BETWEEN ? AND ?
        AND unit_name IS NOT NULL
        GROUP BY unit_name
        ORDER BY total_agendado DESC
    `).all(startDate, endDate);

    return NextResponse.json({ 
        userStats, 
        unitStats
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}