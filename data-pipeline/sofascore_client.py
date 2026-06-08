# -*- coding: utf-8 -*-
"""
sofascore_client.py — modelo "catálogo sob demanda".

Dado o ID de um time no Sofascore, busca o elenco + as estatísticas de temporada
de cada jogador (rating Sofascore, xG, xA, gols, assistências, finalizações, etc.)
e devolve no nosso schema. É a base do fluxo: rumor -> pego o ID do time -> adiciono
ao banco -> o banco cresce a cada episódio.

Endpoints internos (api.sofascore.com/api/v1):
  /search/all?q=<nome>                         -> achar IDs por nome
  /team/{id}                                   -> time + torneio principal
  /unique-tournament/{utid}/seasons            -> temporadas (a 1a é a atual)
  /team/{id}/players                           -> elenco
  /player/{pid}/unique-tournament/{utid}/season/{sid}/statistics/overall -> stats

Anti-bot: o Sofascore protege com Cloudflare. Tentamos requests com cabeçalhos de
navegador; se bloquear (403/429 persistente), instale 'cloudscraper' (no
requirements) que o cliente usa automaticamente.

NÃO testado contra a API real (precisa rodar na sua máquina). Use inspect_sofascore.py
para validar a estrutura e ajustar STAT_MAP se algum nome vier diferente.
"""
import time
import re
import requests
from unidecode import unidecode

API = "https://api.sofascore.com/api/v1"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
}

# chave da Sofascore (statistics/overall) -> campo do nosso schema
STAT_MAP = {
    "rating": "rating",
    "goals": "g",
    "assists": "a",
    "expectedGoals": "xg",
    "expectedAssists": "xa",
    "totalShots": "sh",
    "shotsOnTarget": "sot",
    "keyPasses": "keyP",
    "accuratePassesPercentage": "passAcc",
    "tackles": "tkl",
    "interceptions": "intc",
    "successfulDribbles": "drib",
    "aerialDuelsWon": "aerial",
    "minutesPlayed": "min",
    "appearances": "apps",
    "saves": "sav",
    "cleanSheet": "cs",
}

# posição grosseira do Sofascore -> nosso código (o Transfermarkt refina depois)
POS_MAP = {"G": "GOL", "D": "ZAG", "M": "MEI", "F": "ATA"}


def _norm(s):
    s = unidecode(str(s or "")).lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


class Sofascore:
    def __init__(self, delay=1.0):
        self.delay = delay
        self.last_status = None
        self._driver = None
        self._http_backend = None
        # 1) curl_cffi: imita a digital TLS do Chrome — costuma vencer o 403 do Sofascore
        try:
            from curl_cffi import requests as cffi
            self._cffi = cffi.Session(impersonate="chrome", headers=HEADERS)
            self._http_backend = "curl_cffi"
        except Exception:
            self._cffi = None
        # 2) cloudscraper
        if self._http_backend is None:
            try:
                import cloudscraper
                self._cs = cloudscraper.create_scraper()
                self._cs.headers.update(HEADERS)
                self._http_backend = "cloudscraper"
            except Exception:
                self._cs = None
        # 3) requests puro
        if self._http_backend is None:
            self._req = requests.Session()
            self._req.headers.update(HEADERS)
            self._http_backend = "requests"
        self._mode = self._http_backend

    # ---- camada HTTP ----
    def _http(self, url):
        try:
            if self._http_backend == "curl_cffi":
                r = self._cffi.get(url, timeout=30)
            elif self._http_backend == "cloudscraper":
                r = self._cs.get(url, timeout=30)
            else:
                r = self._req.get(url, timeout=30)
            return r.status_code, (r.text or "")
        except Exception as e:
            return None, f"__err__{e}"

    # ---- camada navegador (fallback) ----
    def _ensure_browser(self):
        if self._driver is not None:
            return True
        try:
            from seleniumbase import Driver
            self._driver = Driver(uc=True, headless=True)
            self._mode = "seleniumbase(uc)"
            return True
        except Exception as e:
            print(f"  ! navegador headless indisponível: {e}")
            return False

    def _browser(self, url):
        if not self._ensure_browser():
            return None
        try:
            self._driver.uc_open_with_reconnect(url, reconnect_time=4)
            time.sleep(self.delay + 1)
            body = self._driver.get_text("body")
            return body
        except Exception as e:
            print(f"  ! navegador falhou em {url}: {e}")
            return None

    def get(self, path, debug=False):
        import json as _json
        url = f"{API}{path}"
        # tenta HTTP primeiro
        status, text = self._http(url)
        self.last_status = status
        if status == 200 and text and not text.startswith("__err__"):
            try:
                return _json.loads(text)
            except Exception:
                pass
        if debug:
            print(f"  · HTTP {status} em {path} (backend {self._http_backend}) — tentando navegador")
        # fallback: navegador headless (vence Cloudflare como no FBref)
        body = self._browser(url)
        if body:
            try:
                data = _json.loads(body)
                self.last_status = 200
                if debug:
                    print(f"  · OK via navegador em {path}")
                return data
            except Exception:
                snippet = body[:160].replace("\n", " ")
                print(f"  ! navegador retornou não-JSON em {path}: {snippet}")
        else:
            print(f"  ! sem dados em {path} (último status HTTP: {status})")
        time.sleep(self.delay)
        return None

    def close(self):
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None

    # ---- descoberta ----
    def search(self, name, entity="team"):
        j = self.get(f"/search/all?q={requests.utils.quote(name)}")
        out = []
        for res in (j or {}).get("results", []):
            if res.get("type") == entity:
                e = res.get("entity", {})
                out.append({"id": e.get("id"), "name": e.get("name"),
                            "country": (e.get("country") or {}).get("name")})
        return out

    def team_tournament(self, team_id):
        """Descobre o torneio principal (unique tournament) do time."""
        j = self.get(f"/team/{team_id}")
        team = (j or {}).get("team", {}) or {}
        ut = ((team.get("primaryUniqueTournament") or {}) or
              ((team.get("tournament") or {}).get("uniqueTournament") or {}))
        return ut.get("id"), team.get("name")

    def current_season(self, ut_id):
        j = self.get(f"/unique-tournament/{ut_id}/seasons")
        seasons = (j or {}).get("seasons", [])
        return seasons[0]["id"] if seasons else None

    def squad(self, team_id):
        j = self.get(f"/team/{team_id}/players")
        return (j or {}).get("players", [])

    def player_season(self, pid, ut_id, season_id):
        j = self.get(f"/player/{pid}/unique-tournament/{ut_id}/season/{season_id}/statistics/overall")
        return (j or {}).get("statistics", {}) or {}


def fetch_team(team_id, ut_id=None, season_id=None, delay=1.0):
    """Time do Sofascore -> lista de jogadores no nosso schema (com rating + xG)."""
    sc = Sofascore(delay=delay)
    team_name = None
    if not ut_id:
        ut_id, team_name = sc.team_tournament(team_id)
    if not ut_id:
        print(f"  ! não achei o torneio do time {team_id}")
        return []
    if not season_id:
        season_id = sc.current_season(ut_id)
    if not season_id:
        print(f"  ! não achei a temporada (ut {ut_id})")
        return []

    squad = sc.squad(team_id)
    print(f"  Sofascore time {team_id} ({team_name}): {len(squad)} no elenco, "
          f"torneio {ut_id} temporada {season_id}")

    players = []
    for item in squad:
        p = item.get("player", item) or {}
        pid, name = p.get("id"), p.get("name")
        if not pid or not name:
            continue
        stats = sc.player_season(pid, ut_id, season_id)
        rec = {
            "id": f"sofa{pid}",
            "name": name,
            "pos": POS_MAP.get((p.get("position") or "")[:1], "MEI"),
            "club": team_name,
            "_norm": _norm(name),
            "sofa_id": pid,
        }
        for k, field in STAT_MAP.items():
            if k in stats and isinstance(stats[k], (int, float)):
                rec[field] = float(stats[k])
        if "min" in rec or "apps" in rec:      # só quem tem dados de jogo
            players.append(rec)
    print(f"  ✓ {len(players)} jogadores com estatísticas")
    sc.close()
    return players