# -*- coding: utf-8 -*-
"""
add_team.py — acrescenta um time ao banco SEM apagar o que já existe.
É o coração do modelo sob demanda: cada rumor vira um time guardado pra sempre.

Uso:
  python add_team.py 1977            # adiciona o time de ID 1977 ao catálogo
  python add_team.py 1977 3001 44    # vários de uma vez

O catálogo fica em ../public/data/pool.json (o mesmo que o dashboard lê).
Jogadores são deduplicados por id; rodar de novo apenas atualiza os números.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sofascore_client as S  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.normpath(os.path.join(HERE, "..", "public", "data", "pool.json"))

# schema final (mesma ordem do build_snapshot)
SCHEMA = ["id", "name", "pos", "age", "nat", "club", "market", "val", "contract",
          "apps", "min", "g", "a", "xg", "xa", "npxg", "passAcc", "keyP", "prog",
          "prgC", "prgR", "tkl", "tklTot", "intc", "drib", "aerial", "duels", "sot",
          "sh", "fld", "recov", "sav", "cs", "savePct", "rating", "sofa_id"]


def to_schema(rec):
    out = {k: rec.get(k, 0) for k in SCHEMA}
    out["name"] = rec.get("name", "")
    out["pos"] = rec.get("pos", "MEI")
    out["club"] = rec.get("club", "")
    out["market"] = rec.get("market", "Sofascore")
    return out


def load_catalog():
    if os.path.exists(CATALOG):
        try:
            with open(CATALOG, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def main(team_ids):
    catalog = load_catalog()
    by_id = {p["id"]: p for p in catalog if isinstance(p, dict) and "id" in p}
    print(f"Catálogo atual: {len(by_id)} jogadores\n")

    added = 0
    for tid in team_ids:
        print(f"[+] Time {tid}")
        players = S.fetch_team(int(tid))
        for rec in players:
            by_id[rec["id"]] = to_schema(rec)   # insere ou atualiza
            added += 1
        print()

    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    final = list(by_id.values())
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)
    print(f"✓ Catálogo agora com {len(final)} jogadores ({added} inseridos/atualizados)")
    print(f"  em {CATALOG}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python add_team.py <sofascore_team_id> [outro_id ...]")
        sys.exit(1)
    main(sys.argv[1:])