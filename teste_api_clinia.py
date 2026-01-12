import os
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("CLINIA_API_KEY")
BASE_URL = "https://dashboard.clinia.io/api/clinia/v1"

"""
users-group: https://dashboard.clinia.io/api/users-group
modelod de enpoint de informações do chat: https://dashboard.clinia.io/api/whatsapp/chat/5519982953098@s.whatsapp.net
jid: 5519982953098@s.whatsapp.net

ENPOINTS: 
- Estatísticas do grupo por group_id (histórico): https://dashboard.clinia.io/api/statistics/group/card?type=this-week&startDate=2026-01-12T20:20:26.571Z&endDate=2026-01-12T20:20:26.571Z&search=last
- Estatísticas do grupo por group_id (current): https://dashboard.clinia.io/api/statistics/group/card?type=this-week&startDate=2026-01-12T20:20:26.571Z&endDate=2026-01-12T20:20:26.571Z&search=current
- Detalhes do grupo: https://dashboard.clinia.io/api/statistics/group/chart?type=this-week&startDate=2026-01-01T20:20:26.571Z&endDate=2026-01-12T20:20:26.571Z

- Confirmações agendamento: https://dashboard.clinia.io/api/statistics/appointments?type=this-week&startDate=2026-01-12T20:20:26.571Z&endDate=2026-01-12T20:20:26.571Z
- NPS: https://dashboard.clinia.io/api/statistics/nps?type=this-week&startDate=2026-01-12T20:20:26.571Z&endDate=2026-01-12T20:20:26.571Z

* type muda o período filtrado
- Endpoint de período específico (Agendamentos): https://dashboard.clinia.io/api/statistics/appointments?type=specific&startDate=2026-01-01T03:00:00.000Z&endDate=2026-01-12T20:20:26.571Z
- Endpoint de período específico (whatsapp) *retorna dados de todos os grupos: https://dashboard.clinia.io/api/statistics/group/chart?type=specific&startDate=2026-01-01T03:00:00.000Z&endDate=2026-01-12T20:20:26.571Z

appointmentsCreatedByBot - Dado de agendamentos feitos pela automação
"""

def monitorar_fila_precisa():
    headers = {
        "api_key": API_KEY,
        "Content-Type": "application/json"
    }
    
    page = 1
    fila_real = []
    
    print("Iniciando auditoria da fila (Verificando status de fechamento)...")
    agora = datetime.now()

    while True:
        # 1. LISTAGEM GERAL
        url_list = f"{BASE_URL}/chats?page={page}"
        
        try:
            response = requests.get(url_list, headers=headers)
            if response.status_code != 200:
                print(f"Erro na API de listagem: {response.status_code}")
                break
            
            data = response.json()
            lista_chats = data.get("chats", [])
            
            if not lista_chats:
                break 
            
            for chat in lista_chats:
                # Primeiro filtro: Tem mensagem não lida?
                unread = chat.get("unread_count")
                if unread is None: unread = 0
                
                if unread > 0:
                    fone = chat.get("phone")
                    
                    # 2. CONSULTA "TIRA-TEIMA" (O Endpoint que você achou)
                    # Buscamos o histórico para ver se está CLOSED
                    url_history = f"{BASE_URL}/chats/phone/{fone}/conversations"
                    resp_hist = requests.get(url_history, headers=headers)
                    
                    esta_aberto = False # Por segurança, assumimos falso até provar que está aberto
                    
                    if resp_hist.status_code == 200:
                        dados_hist = resp_hist.json()
                        conversas = dados_hist.get("conversations", [])
                        
                        if conversas:
                            # Pega a conversa mais recente (assumindo que a API ordena ou é a primeira)
                            # Se a API não ordenar, idealmente ordenamos pela 'created_at'
                            ultima_conversa = conversas[0] 
                            
                            data_fechamento = ultima_conversa.get("closed_at")
                            
                            # A REGRA DE OURO:
                            # Se closed_at for None (vazio), o chat está ABERTO.
                            if data_fechamento is None:
                                esta_aberto = True
                            else:
                                # Se tem data, está fechado (é um zumbi)
                                esta_aberto = False
                    
                    # Se confirmou que está aberto, adiciona na estatística
                    if esta_aberto:
                        # Cálculo do tempo (igual anterior)
                        str_data = chat.get("conversation_timestamp")
                        minutos_espera = 0
                        
                        if str_data:
                            try:
                                data_limpa = str_data.split(".")[0].replace("T", " ")
                                data_msg = datetime.strptime(data_limpa, "%Y-%m-%d %H:%M:%S")
                                diferenca = agora - data_msg
                                minutos_espera = diferenca.total_seconds() / 60
                            except:
                                pass

                        nome = chat.get("name") or "Cliente"
                        fila_real.append(minutos_espera)
                        print(f" -> [CONFIRMADO] {nome}: {int(minutos_espera)} min na fila")

            if len(lista_chats) < 50:
                break
                
            page += 1
            
        except Exception as e:
            print(f"Erro: {e}")
            break

    # RESULTADOS
    qtd = len(fila_real)
    media = sum(fila_real) / qtd if qtd > 0 else 0
    
    return qtd, media

if __name__ == "__main__":
    qtd, media = monitorar_fila_precisa()
    print("\n" + "="*40)
    print(f"FILA REAL (Validade pelo closed_at)")
    print(f"Pessoas aguardando: {qtd}")
    print(f"Tempo Médio: {media:.1f} minutos")
    print("="*40)