# -*- coding: utf-8 -*-
"""
build_snapshot.py — gera squad.json e pool.json para o Galo Scout.

Lógica:
  1) Espinha = Transfermarkt (transfermarkt-api self-hosted): universo de
     jogadores das competições do escopo, com posição detalhada, idade,
     nacionalidade, valor de mercado e contrato.
  2) Enriquecimento = FBref via soccerdata: gols, assist., xG, xA, passes-chave,
     desarmes, etc. (onde a liga existir no soccerdata).
  3) Casamento Transfermarkt <-> FBref por nome (fuzzy) dentro de cada liga.
  4) Nota derivada por posição (FBref não tem rating próprio).
  5) Normaliza pro schema do dashboard e separa Galo (squad) do resto (pool).

Rode:  python build_snapshot.py
Requisitos: ver requirements.txt e README.md (precisa do transfermarkt-api no ar).
"""
import json, os, re, time, sys
import requests
import pandas as pd
from unidecode import unidecode
from rapidfuzz import process, fuzz

# Garante que o config.py (na mesma pasta deste arquivo) seja encontrado,
# não importa de qual diretório você rode o script.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config as C  # noqa: E402


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def norm_name(s: str) -> str:
    s = unidecode(str(s or "")).lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def nat_code(nationality) -> str:
    if isinstance(nationality, list):
        nationality = nationality[0] if nationality else ""
    nationality = str(nationality or "")
    return C.NAT_CODE.get(nationality, unidecode(nationality)[:3].upper() or "—")


def parse_market_value(v) -> float:
    """Devolve valor em milhões de euros (float)."""
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return round(float(v) / 1_000_000, 2) if v > 10000 else float(v)
    s = str(v).lower().replace("€", "").replace("\u20ac", "").strip()
    mult = 1.0
    if s.endswith("m"):
        mult, s = 1.0, s[:-1]
    elif s.endswith("k"):
        mult, s = 0.001, s[:-1]
    try:
        return round(float(s.replace(",", "")) * mult, 2)
    except ValueError:
        return 0.0


def year_of(contract) -> str:
    m = re.search(r"(19|20)\d{2}", str(contract or ""))
    return m.group(0) if m else "—"


def safe_int(v):
    """Converte para int sem quebrar (idade pode vir nula/estranha)."""
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return None


# ----------------------------------------------------------------------------
# Camada Transfermarkt
# ----------------------------------------------------------------------------
TM_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tm_cache")


def _cache_path(path: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", path).strip("_")
    return os.path.join(TM_CACHE_DIR, safe + ".json")


def tm_get(path: str):
    # 1) Cache em disco: clube/competição já baixado não é buscado de novo.
    cp = _cache_path(path)
    if os.path.exists(cp):
        try:
            with open(cp, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # 2) Busca na API local, com retry educado para instabilidades.
    url = f"{C.TM_BASE}{path}"
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=C.TM_TIMEOUT)
            if r.status_code in (429, 500, 502, 503):   # serviço instável -> espera e retenta
                print(f"  · TM {r.status_code} em {path} — retry {attempt + 1}/4")
                time.sleep(3 + attempt * 3)
                continue
            r.raise_for_status()
            data = r.json()
            os.makedirs(TM_CACHE_DIR, exist_ok=True)    # salva no cache só respostas boas
            with open(cp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            time.sleep(C.TM_DELAY)
            return data
        except requests.RequestException as e:
            print(f"  ! TM falhou ({path}): {e}")
            time.sleep(2 + attempt)
    return None


def get_competition_clubs(comp_id, season):
    data = tm_get(f"/competitions/{comp_id}/clubs?season_id={season}")
    return (data or {}).get("clubs", []) if data else []


def get_club_players(club_id, season=None):
    # Sem season_id o serviço devolve o ELENCO ATUAL (o que queremos p/ scouting).
    data = tm_get(f"/clubs/{club_id}/players")
    players = (data or {}).get("players", []) if data else []
    # Fallback: se vier vazio, tenta com a temporada configurada.
    if not players and season:
        data = tm_get(f"/clubs/{club_id}/players?season_id={season}")
        players = (data or {}).get("players", []) if data else []
    return players


def build_universe():
    """Monta a lista de jogadores (espinha) a partir do Transfermarkt."""
    players, seen = [], set()
    for comp_id, season, market, fbref_league in C.COMPETITIONS:
        print(f"\n[TM] Competição {comp_id} (season {season}) — {market}")
        clubs = get_competition_clubs(comp_id, season)
        print(f"     {len(clubs)} clubes")
        for club in clubs:
            cid, cname = club.get("id"), club.get("name", "")
            roster = get_club_players(cid, season)
            for p in roster:
                try:
                    pid = p.get("id")
                    name = (p.get("name") or "").strip()
                    if not pid or pid in seen or not name:
                        continue
                    seen.add(pid)
                    tm_pos = p.get("position") or ""
                    players.append({
                        "id": str(pid),
                        "name": name,
                        "pos": C.TM_POSITION_MAP.get(tm_pos, "MEI"),   # default neutro
                        "tm_pos_raw": tm_pos,
                        "age": safe_int(p.get("age")),
                        "nat": nat_code(p.get("nationality")),
                        "club": cname,
                        "market": market,
                        "val": parse_market_value(p.get("marketValue")),
                        "contract": year_of(p.get("contract")),
                        "fbref_league": fbref_league,
                        "_norm": norm_name(name),
                    })
                except Exception as e:
                    print(f"     (pulando jogador problemático em {cname}: {e})")
                    continue
            print(f"     · {cname}: {len(roster)} jogadores")
    print(f"\n[TM] Universo total: {len(players)} jogadores")
    return players


# ----------------------------------------------------------------------------
# Camada FBref (soccerdata)
# ----------------------------------------------------------------------------
def _leaf(col):
    """Último nível de uma coluna (MultiIndex ou simples)."""
    return col[-1] if isinstance(col, tuple) else col


def _group(col):
    return " ".join(str(x) for x in col[:-1]) if isinstance(col, tuple) else ""


def pick(row, df_cols, leaf, group_hint=None):
    """Pega o valor de uma coluna pelo nome do nível final, com dica de grupo."""
    cands = [c for c in df_cols if _leaf(c) == leaf]
    if not cands:
        return None
    if group_hint:
        pref = [c for c in cands if group_hint.lower() in _group(c).lower()]
        if pref:
            cands = pref
    try:
        v = row[cands[0]]
        return float(v) if pd.notna(v) else None
    except Exception:
        return None


def fetch_fbref(league, season):
    """Retorna {nome_normalizado: {stat: valor}} para uma liga/temporada do FBref."""
    import soccerdata as sd
    out = {}
    try:
        fb = sd.FBref(leagues=league, seasons=season)
    except Exception as e:
        print(f"  ! FBref não inicializou para {league}: {e}")
        return out

    # soccerdata 1.9.0 só aceita estes tipos por temporada. Felizmente:
    #  - 'standard' traz xG, xA (xAG) e passes progressivos (PrgP)
    #  - 'misc' traz interceptações (Int) e desarmes ganhos (TklW)
    frames = {}
    for st in ["standard", "shooting", "misc", "keeper"]:
        try:
            frames[st] = fb.read_player_season_stats(stat_type=st)
        except Exception as e:
            print(f"  · sem '{st}' em {league} ({type(e).__name__})")

    std = frames.get("standard")
    if std is None or std.empty:
        print(f"  ! FBref sem dados 'standard' para {league}")
        return out

    def idx_name(ix):  # o índice traz o nome do jogador em algum nível
        if isinstance(ix, tuple):
            for part in reversed(ix):
                if isinstance(part, str) and not part.isdigit():
                    return part
            return ix[-1]
        return ix

    for ix, r in std.iterrows():
        name = idx_name(ix)
        nn = norm_name(name)
        if not nn:
            continue
        cols = std.columns
        rec = {
            "apps": pick(r, cols, "MP"),
            "min": pick(r, cols, "Min", "Playing"),
            "g": pick(r, cols, "Gls", "Performance"),
            "a": pick(r, cols, "Ast", "Performance"),
            "xg": pick(r, cols, "xG", "Expected"),
            "xa": pick(r, cols, "xAG", "Expected"),
            "npxg": pick(r, cols, "npxG", "Expected"),
            "prog": pick(r, cols, "PrgP", "Progression"),
            "prgC": pick(r, cols, "PrgC", "Progression"),
            "prgR": pick(r, cols, "PrgR", "Progression"),
        }
        # demais stat_types (casados pelo mesmo nome de jogador)
        # Int e TklW saem da tabela 'misc' (grupo Performance); aéreos do grupo Aerial.
        for st, leaf, grp, key in [
            ("shooting", "SoT", "Standard", "sot"),
            ("shooting", "Sh", "Standard", "sh"),
            ("misc", "Int", "Performance", "intc"),
            ("misc", "TklW", "Performance", "tkl"),
            ("misc", "Won", "Aerial", "aerial"),
            ("misc", "Fld", "Performance", "fld"),
            ("misc", "Recov", "Performance", "recov"),
            ("keeper", "Saves", None, "sav"),
            ("keeper", "Save%", None, "savePct"),
            ("keeper", "CS", None, "cs"),
        ]:
            f = frames.get(st)
            if f is None or f.empty:
                continue
            match = f[f.index.map(lambda i: norm_name(idx_name(i)) == nn)]
            if len(match):
                rec[key] = pick(match.iloc[0], f.columns, leaf, grp)
        out[nn] = {k: v for k, v in rec.items() if v is not None}
    print(f"  ✓ FBref {league}: {len(out)} jogadores com stats")
    return out


def enrich_with_fbref(players):
    """Casa cada jogador do TM com o FBref por nome (fuzzy) dentro da liga."""
    by_league = {}
    for p in players:
        if p["fbref_league"]:
            by_league.setdefault(p["fbref_league"], []).append(p)

    for league, group in by_league.items():
        season = C.FBREF_SEASON_BR if league.startswith("BRA") else C.FBREF_SEASON_EURO
        print(f"\n[FBref] {league} (season {season}) — {len(group)} alvos")
        fb = fetch_fbref(league, season)
        if not fb:
            continue
        fb_keys = list(fb.keys())
        for p in group:
            hit = process.extractOne(p["_norm"], fb_keys, scorer=fuzz.token_sort_ratio,
                                     score_cutoff=85)
            if hit:
                p.update(fb[hit[0]])
    return players


def enrich_with_fbref_extra(players):
    """Raspador dedicado: passes-chave, % de passe e dribles (passing/possession/defense)."""
    if not getattr(C, "USE_FBREF_EXTRA", False):
        return players
    try:
        import fbref_extra
    except Exception as e:
        print(f"\n[FBref extra] módulo indisponível ({e}) — pulando.")
        return players

    by_league = {}
    for p in players:
        if p["fbref_league"]:
            by_league.setdefault(p["fbref_league"], []).append(p)

    for league, group in by_league.items():
        season = C.FBREF_SEASON_BR if league.startswith("BRA") else C.FBREF_SEASON_EURO
        print(f"\n[FBref extra] {league} — passes-chave / passe% / dribles")
        extra = fbref_extra.fetch_extra(league, season)
        if not extra:
            continue
        keys = list(extra.keys())
        for p in group:
            hit = process.extractOne(p["_norm"], keys, scorer=fuzz.token_sort_ratio,
                                     score_cutoff=85)
            if hit:
                p.update(extra[hit[0]])
    return players


# ----------------------------------------------------------------------------
# Nota derivada (FBref não fornece rating) — usa os pesos de config.RATING_WEIGHTS
# ----------------------------------------------------------------------------
# Métricas de "volume" (contagens) são convertidas para por-90 antes de ranquear;
# percentuais (savePct/passAcc) e contagens estáveis (cs) entram como vêm.
VOLUME = {"g", "a", "xg", "xa", "sot", "keyP", "drib", "tkl", "intc", "prog", "sav", "aerial"}


def add_derived_rating(players):
    df = pd.DataFrame(players)
    all_metrics = set().union(*[set(d) for d in C.RATING_WEIGHTS.values()]) if C.RATING_WEIGHTS else set()
    for col in all_metrics | {"min"}:
        if col not in df:
            df[col] = 0.0
    num_cols = [c for c in df.columns if df[c].dtype != object]
    df[num_cols] = df[num_cols].fillna(0.0)

    def p90(row, m):
        mins = row.get("min") or 0
        return (row[m] / (mins / 90)) if (m in VOLUME and mins and mins > 0) else row.get(m, 0)

    lo, hi = C.RATING_RANGE
    span = hi - lo
    ratings = pd.Series(round((lo + hi) / 2, 2), index=df.index)
    for pos, wmap in C.RATING_WEIGHTS.items():
        sub = df[df["pos"] == pos]
        total_w = sum(wmap.values())
        if len(sub) < 3 or total_w <= 0:
            continue
        score = pd.Series(0.0, index=sub.index)
        for m, wt in wmap.items():
            vals = sub.apply(lambda r: p90(r, m), axis=1)
            score += wt * vals.rank(pct=True)     # percentil 0..1 ponderado
        score /= total_w
        ratings.loc[sub.index] = (lo + span * score).round(2).clip(lo, hi)
    df["rating"] = ratings
    return df.to_dict("records")


# ----------------------------------------------------------------------------
# Normalização final + escrita
# ----------------------------------------------------------------------------
SCHEMA = ["id", "name", "pos", "age", "nat", "club", "market", "val", "contract",
          "apps", "min", "g", "a", "xg", "xa", "npxg", "passAcc", "keyP", "prog",
          "prgC", "prgR", "tkl", "tklTot", "intc", "drib", "aerial", "duels", "sot",
          "sh", "fld", "recov", "sav", "cs", "savePct", "rating"]


def normalize(players):
    out = []
    for p in players:
        rec = {}
        for k in SCHEMA:
            v = p.get(k)
            if v is None:
                v = 0 if k not in ("name", "pos", "nat", "club", "market", "contract", "id") else ""
            if isinstance(v, float):
                v = round(v, 2)
            rec[k] = v
        if not rec.get("age"):
            rec["age"] = 0
        out.append(rec)
    return out


def main():
    print("=== Galo Scout — build snapshot ===")
    players = build_universe()
    if not players:
        print("\nERRO: nenhum jogador veio do Transfermarkt. O serviço está no ar em "
              f"{C.TM_BASE}? Veja o README.")
        sys.exit(1)

    players = enrich_with_fbref(players)
    players = enrich_with_fbref_extra(players)
    players = add_derived_rating(players)
    players = normalize(players)

    # Separa o Galo do resto pela grafia do clube (robusto a acento/variações).
    def is_galo(club):
        return "mineiro" in unidecode(str(club)).lower()
    squad = [p for p in players if is_galo(p["club"])]
    pool = [p for p in players if not is_galo(p["club"])]

    os.makedirs(C.OUTPUT_DIR, exist_ok=True)
    meta = {"generated_at": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
            "source": "Transfermarkt (valores/posição) + FBref (stats/xG)",
            "note": "Nota é derivada (percentis por posição), não rating oficial."}

    with open(os.path.join(C.OUTPUT_DIR, "squad.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "players": squad}, f, ensure_ascii=False, indent=2)
    with open(os.path.join(C.OUTPUT_DIR, "pool.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "players": pool}, f, ensure_ascii=False, indent=2)

    print(f"\n✓ squad.json: {len(squad)} jogadores (Galo)")
    print(f"✓ pool.json:  {len(pool)} jogadores (mercado)")
    print(f"  em {os.path.abspath(C.OUTPUT_DIR)}")


if __name__ == "__main__":
    main()