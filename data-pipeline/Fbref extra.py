# -*- coding: utf-8 -*-
"""
fbref_extra.py — raspador dedicado para as tabelas que o soccerdata 1.9.0 NÃO
expõe: passing, possession e defense. Daí saem passes-chave, % de passe e dribles.

A sacada: em vez de brigar com o anti-bot do FBref do zero, reaproveitamos o
mecanismo de download do próprio soccerdata (fb.get), que já usa navegador
headless e cache. Só montamos as URLs das páginas que faltam e parseamos.

Retorna: { nome_normalizado: {keyP, passAcc, drib, tklTot} }
"""
import io
import re
import pandas as pd
from unidecode import unidecode

# páginas extras e o que extrair de cada uma:
#   (grupo_no_cabeçalho, métrica)  ->  campo do nosso schema
PAGES = {
    "passing": {
        ("", "KP"): "keyP",            # passes-chave
        ("Total", "Cmp%"): "passAcc",  # % de acerto de passe (total)
    },
    "possession": {
        ("Take-Ons", "Succ"): "drib",  # dribles (take-ons) certos
    },
    "defense": {
        ("Tackles", "Tkl"): "tklTot",  # desarmes totais (tentados)
    },
}


def _norm(s):
    s = unidecode(str(s or "")).lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _col_group(col):
    a = str(col[0]) if isinstance(col, tuple) else ""
    return "" if a.startswith("Unnamed") else a


def _col_leaf(col):
    return col[-1] if isinstance(col, tuple) else col


def _pick(df, group, leaf):
    """Acha a coluna pelo (grupo, métrica), tolerando variações de grupo."""
    for c in df.columns:
        if _col_leaf(c) == leaf:
            g = _col_group(c)
            if group == "" or group.lower() in g.lower():
                return c
    # fallback: só pela métrica (primeira ocorrência)
    for c in df.columns:
        if _col_leaf(c) == leaf:
            return c
    return None


def _parse_table(html_str, page):
    """Extrai {nome_normalizado: {campo: valor}} de uma página de stats do FBref."""
    html_str = html_str.replace("<!--", "").replace("-->", "")  # FBref às vezes comenta tabelas
    try:
        tables = pd.read_html(io.StringIO(html_str), attrs={"id": f"stats_{page}"}, header=[0, 1])
    except Exception:
        tables = pd.read_html(io.StringIO(html_str), attrs={"id": f"stats_{page}"})
    if not tables:
        return {}
    df = tables[0]

    name_col = _pick(df, "", "Player")
    if name_col is None:
        return {}
    mapping = {}
    for (grp, leaf), field in PAGES[page].items():
        col = _pick(df, grp, leaf)
        if col is not None:
            mapping[field] = col

    out = {}
    for _, row in df.iterrows():
        name = row[name_col]
        if not isinstance(name, str) or name.strip() in ("", "Player"):
            continue   # pula linhas de cabeçalho repetido
        rec = {}
        for field, col in mapping.items():
            v = pd.to_numeric(row[col], errors="coerce")
            if pd.notna(v):
                rec[field] = float(v)
        if rec:
            out[_norm(name)] = rec
    return out


def fetch_extra(league, season):
    """Baixa passing/possession/defense de uma liga e devolve stats por jogador."""
    import soccerdata as sd
    from soccerdata.fbref import FBREF_API

    out = {}
    try:
        fb = sd.FBref(leagues=league, seasons=season)
        seasons = fb.read_seasons()
    except Exception as e:
        print(f"  ! extra: FBref não inicializou para {league}: {e}")
        return out

    for (lkey, skey), srow in seasons.iterrows():
        big_five = lkey == "Big 5 European Leagues Combined"
        for page in PAGES:
            filepath = fb.data_dir / f"players_{lkey}_{skey}_{page}.html"
            url = (
                FBREF_API
                + "/".join(srow.url.split("/")[:-1])
                + f"/{page}"
                + ("/players/" if big_five else "/")
                + srow.url.split("/")[-1]
            )
            try:
                reader = fb.get(url, filepath)        # reusa o motor anti-bot + cache
                content = reader.read()
                if isinstance(content, bytes):
                    content = content.decode("utf-8", "ignore")
                parsed = _parse_table(content, page)
                for nn, rec in parsed.items():
                    out.setdefault(nn, {}).update(rec)
            except Exception as e:
                print(f"  · extra '{page}' falhou em {league} ({type(e).__name__}: {e})")
    print(f"  ✓ extra {league}: {len(out)} jogadores com passing/possession/defense")
    return out