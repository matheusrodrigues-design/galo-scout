# -*- coding: utf-8 -*-
"""
inspect_fbref.py — lista TODAS as estatísticas que o FBref (via soccerdata)
disponibiliza para uma liga/temporada, com a contagem de jogadores e o nome
exato de cada coluna (Grupo + Métrica).

Use para descobrir o que dá pra adicionar ao pipeline.

Exemplos:
    python inspect_fbref.py "BRA-Série A"
    python inspect_fbref.py "ENG-Premier League"
    python inspect_fbref.py                       (usa BRA-Série A por padrão)

Lê do cache local do soccerdata, então é rápido se você já rodou o pipeline.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config as C  # noqa: E402
import soccerdata as sd  # noqa: E402

LEAGUE = sys.argv[1] if len(sys.argv) > 1 else "BRA-Série A"
SEASON = C.FBREF_SEASON_BR if LEAGUE.startswith("BRA") else C.FBREF_SEASON_EURO

# tipos que o soccerdata 1.9.0 aceita para stats de jogador por temporada
STAT_TYPES = ["standard", "shooting", "keeper", "playing_time", "misc"]

print(f"\n=========================================================")
print(f" FBref — {LEAGUE}  (temporada {SEASON})")
print(f"=========================================================\n")

fb = sd.FBref(leagues=LEAGUE, seasons=SEASON)

for st in STAT_TYPES:
    try:
        df = fb.read_player_season_stats(stat_type=st)
    except Exception as e:
        print(f"### stat_type='{st}': indisponível ({type(e).__name__})\n")
        continue

    print(f"### stat_type='{st}'  —  {df.shape[0]} jogadores, {df.shape[1]} colunas")
    for col in df.columns:
        if isinstance(col, tuple):
            grp = " / ".join(str(x) for x in col[:-1] if x and "Unnamed" not in str(x))
            leaf = col[-1]
        else:
            grp, leaf = "", col
        tag = f"   ↳ grupo: {grp}" if grp else ""
        print(f"    • {leaf}{tag}")
    print()

print("Dica: o nome em '• X' é o que você usa no extrator do build_snapshot.py")
print("(função fetch_fbref), e o 'grupo' ajuda a desambiguar colunas repetidas.\n")