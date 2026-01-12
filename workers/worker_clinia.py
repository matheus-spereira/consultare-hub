import requests
import sqlite3
import datetime
import os
import time

# --- CONFIGURAÇÕES ---
DB_PATH = os.path.join(os.path.dirname(__file__), '../data/dados_clinica.db')

# URLs Oficiais
API_URL_CHAT = "https://dashboard.clinia.io/api/statistics/group/chart"
API_URL_APPOINTMENTS = "https://dashboard.clinia.io/api/statistics/appointments"

# --- HEADERS EXTRAÍDOS DO SEU CURL ---
# O segredo está no 'Cookie'. Se parar de funcionar no futuro, 
# você precisará pegar um novo cURL e atualizar esta string 'Cookie'.
HEADERS = {
    "accept": "application/json",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "referer": "https://dashboard.clinia.io/statistics",
    "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    # O COOKIE DE SESSÃO ESTÁ AQUI ABAIXO:
    "cookie": "_hjSessionUser_5172862=eyJpZCI6IjFkNzg0YmM4LWQ2ZmUtNTQxNC1hNWRlLWNjOTM5ODJlNTkyZCIsImNyZWF0ZWQiOjE3Njc3MDc0NTQyNTYsImV4aXN0aW5nIjp0cnVlfQ==; _gcl_au=1.1.2106454193.1767788884; _ga=GA1.1.1855253267.1767788884; _fbp=fb.1.1767788884415.997373546558420173; _ga_NKRK03SR2L=GS2.1.s1767791522$o2$g1$t1767791691$j32$l0$h355565389; __Host-next-auth.csrf-token=6742b8785587b091b48b20be4b3064f9222e095eb99a5b799cbc4b448036bc90%7C4ed542cf42453fea07bf9fc8d0b51036dcdc139ca8297fedc835acc8c00f3b2b; __Secure-next-auth.callback-url=https%3A%2F%2Fdashboard.clinia.io%2F%2F; _hjSession_5172862=eyJpZCI6ImRlMWUxN2UzLTNhOTMtNGI0Ni04MTA3LTgwNzMxOTdiOWZiMCIsImMiOjE3NjgyNDYwMTQxMzYsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; __Secure-next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..yOtb9D8ph6k5IU8q.t4iSOylteTkj4UzpgVd9WARoxsYnSW--k8Nc1bmgKQK8_SNstKatRFfOgnWHb5rSzRaoS_2dDOYPOC_c-E54ZOPtrPeCkCXjzup8AGP_eyXYDFZRqgTZ54vj0zHmVF9cPVE8xfv7jEQRddbaRZnaytelJXfBNjNeidTcuAcWqN6-WyB4KDj4-a8Y12KmdGrKZTK3HF4DfC7olx7T-enBt-uKaSxBsQewUq-gBNiJhnyLwrou-CdI-sDVoEZMR9Ttc9anWrNLNNCI6ywJL9zVZI478wkvX2FkKyc8btMSaFawP5q1OFiGGDc9-Dc24qS6NN_4b5IUeje2ZdLds10TJPQ9zBUV8EqLuksZSF1YasWD7vvfIKbewVejrSOaT-lcRsUdE6FH8XQ.gznwRM2Ijc_5HeXf1lHGCA"
}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_today_params():
    """Garante que buscaremos apenas os dados de HOJE (00:00 até agora)"""
    today_str = datetime.datetime.now().strftime('%Y-%m-%d')
    start_date = f"{today_str}T00:00:00.000Z"
    end_date = f"{today_str}T23:59:59.999Z"
    
    return {
        "type": "specific",
        "startDate": start_date,
        "endDate": end_date
    }

def fetch_clinia_data(url, label="Dados"):
    params = get_today_params()
    try:
        # Passamos cookies e headers completos
        response = requests.get(url, params=params, headers=HEADERS, timeout=20)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"--- ERRO {label} ---")
        if 'response' in locals():
            print(f"Status: {response.status_code}")
            # Se for 401 ou 403, o cookie venceu
            if response.status_code in [401, 403]:
                print("TOKEN EXPIRADO: É necessário atualizar o cookie no script.")
        print(f"Detalhe: {e}")
        return None

def process_and_save():
    print(f"--- Atualizando Clinia (Grupos Detalhados): {datetime.datetime.now()} ---")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Tabela para o Relatório Diário (Mantida)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clinia_chat_stats (
            date TEXT PRIMARY KEY,
            total_conversations INTEGER DEFAULT 0,
            total_without_response INTEGER DEFAULT 0,
            avg_wait_seconds INTEGER DEFAULT 0,
            updated_at DATETIME
        )
    ''')

    # 2. NOVA TABELA: Snapshot por Grupo (Para o Monitor em Tempo Real)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clinia_group_snapshots (
            group_id TEXT PRIMARY KEY,
            group_name TEXT,
            queue_size INTEGER DEFAULT 0, -- Sem resposta
            avg_wait_seconds INTEGER DEFAULT 0,
            updated_at DATETIME
        )
    ''')

    # 3. Tabela Agendamentos (Mantida)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clinia_appointment_stats (
            date TEXT PRIMARY KEY,
            total_appointments INTEGER DEFAULT 0,
            bot_appointments INTEGER DEFAULT 0,
            crc_appointments INTEGER DEFAULT 0,
            updated_at DATETIME
        )
    ''')
    
    today_str = datetime.datetime.now().strftime('%Y-%m-%d')

    # --- PROCESSA CHAT ---
    chat_data = fetch_clinia_data(API_URL_CHAT, "CHAT")
    
    if chat_data and 'groups' in chat_data:
        # Variáveis para o agregado (Relatório)
        total_conv = 0
        total_no_resp = 0
        total_wait = 0
        count_groups_with_wait = 0

        # Limpa snapshots antigos para garantir que grupos removidos sumam
        cursor.execute("DELETE FROM clinia_group_snapshots")

        for group in chat_data['groups']:
            g_id = group.get('group_id')
            g_name = group.get('group_name', 'Grupo Desconhecido')
            
            # Métricas individuais
            g_conv = group.get('number_of_group_conversations', 0)
            g_no_resp = group.get('number_of_without_responses', 0) # Isso é a Fila
            g_wait = group.get('avg_waiting_time') or 0

            # Salva Snapshot Individual (Para o Monitor)
            cursor.execute('''
                INSERT INTO clinia_group_snapshots (group_id, group_name, queue_size, avg_wait_seconds, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            ''', (g_id, g_name, g_no_resp, int(g_wait)))

            # Soma para o Agregado
            total_conv += g_conv
            total_no_resp += g_no_resp
            if g_wait > 0:
                total_wait += g_wait
                count_groups_with_wait += 1
        
        # Salva Agregado (Para Relatório)
        avg_wait_final = int(total_wait / count_groups_with_wait) if count_groups_with_wait > 0 else 0
        cursor.execute('''
            INSERT INTO clinia_chat_stats (date, total_conversations, total_without_response, avg_wait_seconds, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(date) DO UPDATE SET
                total_conversations = excluded.total_conversations,
                total_without_response = excluded.total_without_response,
                avg_wait_seconds = excluded.avg_wait_seconds,
                updated_at = excluded.updated_at
        ''', (today_str, total_conv, total_no_resp, avg_wait_final))
        
        print(f"Chat atualizado: {len(chat_data['groups'])} grupos processados.")

    # --- PROCESSA AGENDAMENTOS (Mantido igual) ---
    appt_data = fetch_clinia_data(API_URL_APPOINTMENTS, "AGENDAMENTOS")
    if appt_data and 'current' in appt_data:
        curr = appt_data['current']
        total_appts = curr.get('appointmentsTotal', 0)
        bot_appts = curr.get('appointmentsCreatedByBot', 0)
        crc_appts = total_appts - bot_appts 
        if crc_appts < 0: crc_appts = 0

        cursor.execute('''
            INSERT INTO clinia_appointment_stats (date, total_appointments, bot_appointments, crc_appointments, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(date) DO UPDATE SET
                total_appointments = excluded.total_appointments,
                bot_appointments = excluded.bot_appointments,
                crc_appointments = excluded.crc_appointments,
                updated_at = excluded.updated_at
        ''', (today_str, total_appts, bot_appts, crc_appts))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    process_and_save()