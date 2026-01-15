import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupFilter = searchParams.get('group');
    const db = getDbConnection();

    // Verificação dinâmica para evitar o erro de "no such column"
    const info = db.prepare("PRAGMA table_info(faturamento_analitico)").all() as any[];
    const dateCol = info.find(c => c.name === 'data' || c.name === 'data_vencimento')?.name || 'data';

    const filterSQL = groupFilter && groupFilter !== 'all' ? `AND grupo = '${groupFilter}'` : '';
    const sqlDate = `substr(${dateCol}, 7, 4) || '-' || substr(${dateCol}, 4, 2) || '-' || substr(${dateCol}, 1, 2)`;

    const daily = db.prepare(`
        SELECT ${sqlDate} as d, SUM(total_pago) as total, COUNT(*) as qtd
        FROM faturamento_analitico
        WHERE ${sqlDate} >= date('now', '-30 days') ${filterSQL}
        GROUP BY d ORDER BY d DESC
    `).all() || [];

    const monthly = db.prepare(`
        SELECT substr(${dateCol}, 7, 4) || '-' || substr(${dateCol}, 4, 2) as m, SUM(total_pago) as total
        FROM faturamento_analitico
        WHERE ${sqlDate} >= date('now', '-12 months') ${filterSQL}
        GROUP BY m ORDER BY m DESC
    `).all() || [];

    // Busca os nomes dos GRUPOS extraídos pelo scraper
    const groups = db.prepare(`
        SELECT grupo as procedure_group, SUM(total_pago) as total
        FROM faturamento_analitico
        WHERE grupo IS NOT NULL AND grupo != ''
        GROUP BY grupo ORDER BY total DESC
    `).all() || [];

    const totals = db.prepare(`
        SELECT SUM(total_pago) as total, COUNT(*) as qtd
        FROM faturamento_analitico
        WHERE substr(${dateCol}, 7, 4) || '-' || substr(${dateCol}, 4, 2) = strftime('%Y-%m', 'now')
        ${filterSQL}
    `).get() as { total: number, qtd: number } || { total: 0, qtd: 0 };

    return NextResponse.json({ daily, monthly, groups, totals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}