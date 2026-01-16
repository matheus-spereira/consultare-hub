import sys
import os
import sqlite3
import time
import datetime
import pandas as pd

# Garante que o diretório atual está no path
sys.path.append(os.path.dirname(__file__))

try:
    from feegow_client import fetch_financial_data
except ImportError as e:
    print(f"ERRO CRÍTICO: Não foi possível importar 'feegow_client'.\nDetalhe: {e}")
    sys.exit(1)

DB_PATH = os.path.join(os.path.dirname(__file__), '../data/dados_clinica.db')

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def create_table_if_not_exists():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # CRIAÇÃO DA TABELA (Com novas colunas scheduled_by e unit_name)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS feegow_appointments (
            appointment_id INTEGER PRIMARY KEY,
            date TEXT,
            status_id INTEGER,
            value REAL,
            specialty TEXT,
            professional_name TEXT,
            procedure_group TEXT,
            scheduled_by TEXT,
            unit_name TEXT,
            updated_at TEXT
        )
    ''')
    
    # Índices para performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_date ON feegow_appointments(date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user ON feegow_appointments(scheduled_by)')
    
    conn.commit()
    conn.close()

def clean_currency(value_str):
    if pd.isna(value_str) or value_str == '':
        return 0.0
    if isinstance(value_str, (int, float)):
        return float(value_str)
    try:
        s = str(value_str).replace('R$', '').replace(' ', '').strip()
        s = s.replace('.', '').replace(',', '.')
        return float(s)
    except Exception:
        return 0.0

def update_financial_data():
    print(f"--- Worker Feegow (Produtividade & Confirmação): {datetime.datetime.now().strftime('%H:%M:%S')} ---")
    
    # Janela de 30 dias para trás e 30 para frente
    now = datetime.datetime.now()
    start_date = (now - datetime.timedelta(days=30)).strftime('%d-%m-%Y')
    end_date = (now + datetime.timedelta(days=30)).strftime('%d-%m-%Y')
    
    print(f" > Buscando dados de {start_date} até {end_date}...")
    
    try:
        df = fetch_financial_data(start_date=start_date, end_date=end_date)
    except Exception as e:
        print(f"❌ Erro na conexão com Feegow: {e}")
        return

    if df.empty:
        print("⚠️ Nenhum dado retornado do Feegow.")
        return

    col_status = 'status_id' if 'status_id' in df.columns else 'status'
    if col_status not in df.columns:
        print(f"❌ Coluna de status '{col_status}' não encontrada.")
        return

    # Status Válidos
    valid_statuses = [1, 2, 3, 4, 6, 7, 11, 15, 16, 22]

    df[col_status] = pd.to_numeric(df[col_status], errors='coerce').fillna(0).astype(int)
    df_to_save = df[df[col_status].isin(valid_statuses)].copy()

    create_table_if_not_exists()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # --- MIGRAÇÃO AUTOMÁTICA DE COLUNAS (Caso o banco já exista) ---
    try:
        cursor.execute("ALTER TABLE feegow_appointments ADD COLUMN scheduled_by TEXT")
        print("ℹ️ Coluna 'scheduled_by' adicionada com sucesso.")
    except: pass
    
    try:
        cursor.execute("ALTER TABLE feegow_appointments ADD COLUMN unit_name TEXT")
        print("ℹ️ Coluna 'unit_name' adicionada com sucesso.")
    except: pass
    # ---------------------------------------------------------------

    saved = 0
    errors = 0
    
    for _, row in df_to_save.iterrows():
        try:
            app_id = int(row.get('agendamento_id') or row.get('id') or 0)
            
            # Data ISO
            raw_date = row.get('data') or row.get('data_agendamento')
            iso_date = datetime.datetime.now().strftime("%Y-%m-%d")
            if raw_date:
                clean_date = str(raw_date)[:10]
                try:
                    fmt = "%d-%m-%Y" if '-' in clean_date else "%d/%m/%Y"
                    iso_date = datetime.datetime.strptime(clean_date, fmt).strftime("%Y-%m-%d")
                except: pass

            val = clean_currency(row.get('valor') or row.get('valor_total_agendamento'))
            spec = row.get('especialidade') or row.get('nome_especialidade') or 'Geral'
            prof = row.get('nome_profissional') or row.get('profissional') or 'Desconhecido'
            pg = str(row.get('procedure_group') or row.get('grupo_procedimento') or 'Geral').strip()
            
            # --- NOVOS CAMPOS ---
            # Pega 'agendado_por' do JSON
            user_sched = str(row.get('agendado_por') or 'Sistema').strip()
            # Pega 'nome_fantasia' do JSON
            unit_name = str(row.get('nome_fantasia') or 'Matriz').strip()

            st_id = int(row.get(col_status))

            if app_id > 0:
                cursor.execute('''
                    INSERT INTO feegow_appointments (
                        appointment_id, date, status_id, value, 
                        specialty, professional_name, procedure_group, 
                        scheduled_by, unit_name, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(appointment_id) DO UPDATE SET
                        status_id = excluded.status_id,
                        value = excluded.value,
                        procedure_group = excluded.procedure_group,
                        scheduled_by = excluded.scheduled_by,
                        unit_name = excluded.unit_name,
                        updated_at = excluded.updated_at
                ''', (app_id, iso_date, st_id, val, spec, prof, pg, user_sched, unit_name))
                saved += 1
            
        except Exception as e:
            errors += 1

    conn.commit()
    conn.close()
    print(f"✅ Sucesso: {saved} registros atualizados com Produtividade.")

if __name__ == "__main__":
    update_financial_data()