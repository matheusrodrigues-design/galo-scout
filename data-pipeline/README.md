# Galo Scout — Pipeline de dados reais

Gera `squad.json` (elenco do Galo) e `pool.json` (mercado) a partir de duas fontes:

- **Transfermarkt** (via `transfermarkt-api` self-hosted) → posição detalhada, idade, nacionalidade, **valor de mercado** e contrato. É a espinha: funciona pra Brasil e Europa.
- **FBref** (via `soccerdata`) → gols, assistências, **xG, xA**, passes-chave, desarmes, etc.

O casamento entre as duas é por nome (fuzzy) dentro de cada liga. Como o FBref não tem nota própria, a **nota é derivada** por percentis dentro da posição (transparência: não é rating oficial).

---

## 1. Pré-requisitos

- Python 3.10+
- Docker (para rodar o serviço de valores de mercado)

## 2. Subir o serviço de valores (Transfermarkt)

Em um terminal separado:

```bash
git clone https://github.com/felipeall/transfermarkt-api.git
cd transfermarkt-api
docker build -t transfermarkt-api .
docker run -d -p 8000:8000 transfermarkt-api
# confira em http://localhost:8000/ (Swagger)
```

> É o seu próprio serviço, sem o rate limit da instância pública de teste. Use com responsabilidade e respeitando os termos do Transfermarkt.

## 3. Instalar e rodar o pipeline

```bash
cd data-pipeline
python -m venv venv && source venv/bin/activate    # opcional, recomendado
pip install -r requirements.txt
python build_snapshot.py
```

Saída: `../public/data/squad.json` e `../public/data/pool.json` (a pasta `public/` do app React). Rerun quando quiser atualizar.

## 4. Adicionar o Brasileirão ao FBref (importante)

O `soccerdata` já traz as 5 grandes ligas europeias no FBref, **mas não o Brasileirão**. Sem este passo, o elenco do Galo vem com valor/posição (do Transfermarkt) porém **sem xG** (do FBref).

Para habilitar, crie/edite o arquivo de ligas customizadas do soccerdata — por padrão em `~/soccerdata/config/league_dict.json` — adicionando o Brasileirão. O FBref publica a Série A brasileira na competição de id **24** (`fbref.com/en/comps/24/`). Use o guia oficial "Adding leagues" do soccerdata para o formato exato da sua versão, algo como:

```json
{
  "BRA-Série A": {
    "FBref": "Campeonato Brasileiro Série A",
    "season_start": "Jan",
    "season_end": "Dec"
  }
}
```

> O formato pode variar entre versões do soccerdata. Rode `python -c "import soccerdata as sd; print(sd.FBref.available_leagues())"` para confirmar que `BRA-Série A` apareceu antes de rodar o pipeline. Se o nome da liga que você cadastrou for diferente, ajuste o valor em `config.py` (campo FBref de `COMPETITIONS`).

## 5. Detalhes que talvez precise ajustar (`config.py`)

- **`FBREF_SEASON_EURO` / `FBREF_SEASON_BR`**: o formato de temporada aceito pelo soccerdata pode variar (`"2025-2026"`, `"2526"`, `"2026"`). Se a lib reclamar, ajuste aqui.
- **`season_id` do Transfermarkt** em `COMPETITIONS`: ano de início (Europa 25/26 = `2025`; Brasil 2026 = `2026`).
- **`TM_POSITION_MAP`**: como traduzir as posições do Transfermarkt pros 8 códigos do dashboard — ajuste conforme sua leitura tática.
- **`TM_DELAY`**: pausa entre chamadas ao serviço de valores (seja educado pra não ser bloqueado).

## 6. Ligar no app React

No `GaloScout.jsx`, troque as funções de dados mock por leitura dos JSON. Em vez de:

```js
function getSquad() { return SQUAD; }
function getPool() { return POOL; }
```

passe a carregar os arquivos da pasta `public/`:

```js
async function getSquad() {
  const r = await fetch("/data/squad.json");
  return (await r.json()).players;
}
async function getPool() {
  const r = await fetch("/data/pool.json");
  return (await r.json()).players;
}
```

…e transforme `squad`/`pool` em estado carregado num `useEffect` (com um indicador de "carregando"). Posso te entregar essa versão do componente já adaptada — é o próximo passo.

## 7. Limitações honestas

- Scraping quebra quando o site muda; reserve um tempo de manutenção.
- O casamento por nome não é perfeito (homônimos, grafias) — o `score_cutoff` em `enrich_with_fbref` controla o rigor.
- A nota é **derivada**, não um rating oficial. Dá pra trocar depois por Sofascore/API-Football.
