import { getDbConnection } from '@/lib/db';

interface KpiResult {
  currentValue: number;
  lastUpdated: string;
}

interface KpiOptions {
    group_filter?: string;
}

interface KpiHistoryItem {
    date: string;
    value: number;
}

// Helper: Converte 'DD/MM/YYYY' para 'YYYY-MM-DD' diretamente no SQL
// Usamos a coluna 'data' que é o padrão gerado pelo seu scraper atual
const SQL_CONVERT_DATE = `substr(data, 7, 4) || '-' || substr(data, 4, 2) || '-' || substr(data, 1, 2)`;

export async function getKpiHistory(
  kpiId: string, 
  startDate: string, 
  endDate: string,
  options?: KpiOptions
): Promise<KpiHistoryItem[]> {
  const db = getDbConnection();
  
  const groupClause = (options?.group_filter && options.group_filter !== 'all') 
    ? `AND grupo = '${options.group_filter}'` 
    : '';

  try {
    let query = '';
    
    switch (kpiId) {
        case 'revenue_total':
            // IMPORTANTE: No WHERE, usamos a expressão completa, não o alias
            query = `
                SELECT ${SQL_CONVERT_DATE} as d, SUM(total_pago) as val 
                FROM faturamento_analitico 
                WHERE ${SQL_CONVERT_DATE} >= ? AND ${SQL_CONVERT_DATE} <= ? 
                AND total_pago > 0 ${groupClause}
                GROUP BY d ORDER BY d ASC
            `;
            break;
        
        case 'appointments_realized':
            query = `
                SELECT ${SQL_CONVERT_DATE} as d, COUNT(*) as val 
                FROM faturamento_analitico 
                WHERE ${SQL_CONVERT_DATE} >= ? AND ${SQL_CONVERT_DATE} <= ? 
                ${groupClause}
                GROUP BY d ORDER BY d ASC
            `;
            break;

        default: return [];
    }

    const rows = db.prepare(query).all(startDate, endDate) as { d: string, val: number }[];
    return rows.map(r => ({ date: r.d, value: r.val }));
  } catch (error) {
    console.error(`[KPI HISTORY ERROR] ${kpiId}:`, error);
    return [];
  }
}

export async function calculateKpi(
  kpiId: string, 
  startDate: string, 
  endDate: string,
  options?: KpiOptions
): Promise<KpiResult> {
  const db = getDbConnection();
  const groupClause = (options?.group_filter && options.group_filter !== 'all') 
    ? `AND grupo = '${options.group_filter}'` 
    : '';

  try {
    let value = 0;
    switch (kpiId) {
      case 'revenue_total':
        const rowRev = db.prepare(`
            SELECT SUM(total_pago) as total 
            FROM faturamento_analitico 
            WHERE ${SQL_CONVERT_DATE} >= ? AND ${SQL_CONVERT_DATE} <= ? ${groupClause}
        `).get(startDate, endDate) as { total: number };
        value = rowRev?.total || 0;
        break;

      case 'ticket_average':
        const rowT = db.prepare(`
            SELECT SUM(total_pago) as t, COUNT(*) as q FROM faturamento_analitico 
            WHERE ${SQL_CONVERT_DATE} >= ? AND ${SQL_CONVERT_DATE} <= ? ${groupClause}
        `).get(startDate, endDate) as { t: number, q: number };
        value = (rowT && rowT.q > 0) ? (rowT.t / rowT.q) : 0;
        break;

      case 'appointments_realized':
        const rowR = db.prepare(`
            SELECT COUNT(*) as total FROM faturamento_analitico 
            WHERE ${SQL_CONVERT_DATE} >= ? AND ${SQL_CONVERT_DATE} <= ? ${groupClause}
        `).get(startDate, endDate) as { total: number };
        value = rowR?.total || 0;
        break;

      default: value = 0;
    }

    return { currentValue: Number(value.toFixed(2)), lastUpdated: new Date().toISOString() };
  } catch (error) {
    console.error(`[KPI ERROR] ${kpiId}:`, error);
    return { currentValue: 0, lastUpdated: new Date().toISOString() };
  }
}