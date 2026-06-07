# -*- coding: utf-8 -*-
"""
Configuração do pipeline do Galo Scout.
Ajuste aqui o que quiser sem mexer no código principal.
"""
import os

# --- Onde escrever os JSON (a pasta public/ do app React) ---
# Por padrão grava em ../public/data relativo a este arquivo.
OUTPUT_DIR = os.environ.get(
    "GS_OUTPUT_DIR",
    os.path.join(os.path.dirname(__file__), "..", "public", "data"),
)

# --- Serviço de valores de mercado (transfermarkt-api self-hosted) ---
# Suba o serviço com Docker (porta 8000) antes de rodar. Veja o README.
TM_BASE = os.environ.get("TM_BASE", "http://localhost:8000")
TM_DELAY = float(os.environ.get("TM_DELAY", "1.2"))   # pausa entre chamadas (s) — seja educado
TM_TIMEOUT = 30

# --- Clube do coração ---
GALO_TM_ID = "330"     # Atlético Mineiro no Transfermarkt

# --- Competições no escopo ---
# (codigo_tm, season_id_tm, rótulo_de_mercado, liga_no_FBref_ou_None)
# season_id no Transfermarkt = ano de início da temporada.
#   Europa 2025/26 -> 2025 | Brasileirão 2026 (ano-calendário) -> 2026
# A liga do FBref precisa existir no soccerdata (as 5 grandes já vêm prontas).
# O Brasileirão exige adicionar uma liga customizada — veja o README.
COMPETITIONS = [
    ("BRA1", "2026", "Brasileirão",   "BRA-Série A"),       # Galo + Série A
    ("GB1",  "2025", "Europa",        "ENG-Premier League"),
    ("ES1",  "2025", "Europa",        "ESP-La Liga"),
    ("IT1",  "2025", "Europa",        "ITA-Serie A"),
    ("L1",   "2025", "Europa",        "GER-Bundesliga"),
    ("FR1",  "2025", "Europa",        "FRA-Ligue 1"),
    # Ligas individuais (não o "Big 5 combinado"): a página combinada do FBref
    # dispara o anti-bot/CAPTCHA. As individuais funcionam e já estão em cache.
    # Para incluir Sul-América depois, ex.: ("AR1N","2025","América do Sul", None),
]

# Temporada correspondente no soccerdata/FBref (formato aceito pela lib).
# Europa: "2025-2026" | ligas de ano-calendário (Brasil): "2026".
FBREF_SEASON_EURO = os.environ.get("FBREF_SEASON_EURO", "2025-2026")
FBREF_SEASON_BR = os.environ.get("FBREF_SEASON_BR", "2026")

# --- Mapa de posições do Transfermarkt -> os 8 códigos do dashboard ---
# Ajuste conforme sua leitura tática (ex.: Central Midfield como VOL ou MEI).
TM_POSITION_MAP = {
    "Goalkeeper": "GOL",
    "Centre-Back": "ZAG", "Left Centre-Back": "ZAG", "Right Centre-Back": "ZAG",
    "Right-Back": "LD", "Left-Back": "LE",
    "Defensive Midfield": "VOL",
    "Central Midfield": "VOL",
    "Attacking Midfield": "MEI",
    "Left Midfield": "MEI", "Right Midfield": "MEI",
    "Left Winger": "PON", "Right Winger": "PON",
    "Second Striker": "ATA", "Centre-Forward": "ATA",
}

# Nacionalidade -> código curto exibido no dashboard (fallback: 3 primeiras letras).
NAT_CODE = {
    "Brazil": "BRA", "Argentina": "ARG", "Uruguay": "URU", "Colombia": "COL",
    "Chile": "CHI", "Paraguay": "PAR", "Spain": "ESP", "Portugal": "POR",
    "France": "FRA", "Germany": "GER", "England": "ENG", "Italy": "ITA",
    "Netherlands": "NED", "Belgium": "BEL",
}