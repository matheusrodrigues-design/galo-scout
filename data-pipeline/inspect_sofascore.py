# -*- coding: utf-8 -*-
"""
inspect_sofascore.py — valida a extração do Sofascore antes de a gente automatizar.

Uso:
  python inspect_sofascore.py "Atletico Mineiro"   # acha o ID do time pelo nome
  python inspect_sofascore.py 1977                  # valida a extração desse ID

Mostra: torneio/temporada resolvidos, tamanho do elenco e as estatísticas reais
de alguns jogadores (com os nomes originais), indicando o que já está mapeado.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sofascore_client as S  # noqa: E402

arg = sys.argv[1] if len(sys.argv) > 1 else "Atletico Mineiro"
sc = S.Sofascore(delay=0.7)
print(f"(modo de conexão: {sc._mode})\n")

if not arg.isdigit():
    print(f"Buscando times com nome '{arg}'...\n")
    for t in sc.search(arg, "team"):
        print(f"   ID {t['id']:>8}  {t['name']}  ({t.get('country')})")
    print("\nRode de novo com o ID desejado:  python inspect_sofascore.py <id>")
    sys.exit(0)

team_id = int(arg)

# sonda crua: mostra status HTTP e um trecho da resposta de /team/{id}
print("Sondando /team/%d ...\n" % team_id)
raw = sc.get(f"/team/{team_id}", debug=True)
print(f"   status HTTP: {sc.last_status}")
if raw is None:
    print("   resposta vazia/bloqueada. Se o status for 403, é anti-bot — me avise")
    print("   que partimos pro plano B (navegador headless do soccerdata).")
    sys.exit(1)
print("   chaves no topo:", list(raw.keys())[:8])
team_obj = raw.get("team", {})
print("   chaves em 'team':", list(team_obj.keys())[:12], "\n")

ut_id, team_name = sc.team_tournament(team_id)
print(f"Time: {team_name} (id {team_id})")
print(f"Torneio principal (unique tournament): {ut_id}")
season_id = sc.current_season(ut_id) if ut_id else None
print(f"Temporada vigente: {season_id}\n")
if not (ut_id and season_id):
    print("Não resolveu torneio/temporada. Cole a saída aqui que eu ajusto.")
    sys.exit(1)

squad = sc.squad(team_id)
print(f"Elenco: {len(squad)} jogadores\n")

shown = 0
for item in squad:
    p = item.get("player", item) or {}
    pid, name = p.get("id"), p.get("name")
    if not pid or not name:
        continue
    stats = sc.player_season(pid, ut_id, season_id)
    if not stats:
        continue
    print(f"=== {name}  (pos {p.get('position')}, id {pid}) ===")
    for k in sorted(stats):
        v = stats[k]
        if isinstance(v, (int, float)):
            mapped = S.STAT_MAP.get(k, "")
            flag = f"   -> {mapped}" if mapped else ""
            print(f"   {k}: {v}{flag}")
    shown += 1
    if shown >= 2:
        break

print("\nDica: se algum campo importante (ex.: expectedGoals) aparecer sem '-> campo',")
print("copie o nome exato e me mande — ajusto o STAT_MAP no sofascore_client.py.")

sc.close()