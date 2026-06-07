import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ScatterChart, Scatter, ZAxis,
  CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Shield, Users, Crosshair, Search, AlertTriangle, ArrowUpRight,
  Database, TrendingUp, Activity, Filter,
} from "lucide-react";

/* ============================================================================
   GALO SCOUT — Dashboard de análise de elenco e scouting
   ----------------------------------------------------------------------------
   CAMADA DE DADOS (data layer) — desacoplada de propósito.
   Hoje lê do mock abaixo. Para ligar a API real, troque APENAS as funções
   getSquad() e getPool() por chamadas fetch(). Exemplo com API-Football:

     async function getSquad() {
       const res = await fetch(
         "https://v3.football.api-sports.io/players?team=1062&season=2026",
         { headers: { "x-apisports-key": SUA_CHAVE } }
       );
       const json = await res.json();
       return json.response.map(normalizeApiFootball); // mapeia p/ o schema abaixo
     }

   Schema normalizado de um jogador (o que o dashboard espera):
     { id, name, pos, age, nat, club, market, val (€M), contract,
       apps, min, g, a, xg, xa, passAcc, keyP, prog, tkl, intc,
       drib, aerial, duels, sot, sav, cs, savePct, rating }

   Os VALORES DE MERCADO (val) viriam do Transfermarkt (camada 2), cruzados
   por nome+clube. Veja o texto do chat para as fontes recomendadas.
   ATENÇÃO: os números abaixo são ILUSTRATIVOS/SIMULADOS para demonstrar a
   ferramenta. Conecte a API para dados reais.
   ========================================================================== */

const POS_LABEL = {
  GOL: "Goleiro", ZAG: "Zagueiro", LD: "Lateral D", LE: "Lateral E",
  VOL: "Volante", MEI: "Meia", PON: "Ponta", ATA: "Centroavante",
};
const POS_ORDER = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PON", "ATA"];

// compatibilidade de posições para busca de substituto
const POS_GROUP = {
  GOL: ["GOL"], ZAG: ["ZAG"], LD: ["LD", "LE"], LE: ["LE", "LD"],
  VOL: ["VOL", "MEI"], MEI: ["MEI", "VOL", "PON"], PON: ["PON", "MEI", "ATA"],
  ATA: ["ATA", "PON"],
};

// métricas relevantes por posição (para radar e similaridade)
const POS_METRICS = {
  GOL: ["sav", "savePct", "cs", "passAcc"],
  ZAG: ["tkl", "intc", "aerial", "duels", "passAcc"],
  LD: ["tkl", "intc", "drib", "keyP", "prog", "a"],
  LE: ["tkl", "intc", "drib", "keyP", "prog", "a"],
  VOL: ["tkl", "intc", "prog", "passAcc", "keyP"],
  MEI: ["keyP", "a", "xa", "drib", "g", "xg"],
  PON: ["drib", "keyP", "a", "xa", "g", "sot"],
  ATA: ["g", "xg", "sot", "aerial", "a"],
};

const METRIC_LABEL = {
  g: "Gols", a: "Assist.", xg: "xG", xa: "xA", sot: "Fin. no gol",
  drib: "Dribles", keyP: "Passes-chave", prog: "Passes prog.",
  tkl: "Desarmes", intc: "Intercept.", aerial: "Aéreos", duels: "Duelos %",
  passAcc: "Acerto passe %", sav: "Defesas", savePct: "Defesa %", cs: "Jogos s/ sofrer",
};

// defaults para enxugar a declaração dos jogadores
const D = {
  age: 25, nat: "BRA", market: "Brasileirão", val: 5, contract: "2027",
  apps: 0, min: 0, g: 0, a: 0, xg: 0, xa: 0, passAcc: 80, keyP: 0, prog: 0,
  tkl: 0, intc: 0, drib: 0, aerial: 0, duels: 50, sot: 0, sav: 0, cs: 0,
  savePct: 0, rating: 6.5,
};
const mk = (o) => ({ ...D, ...o });

/* ---- ELENCO DO GALO (ilustrativo, temporada 2026) ---- */
const SQUAD = [
  mk({ id: "s1", name: "Everson", pos: "GOL", age: 35, val: 2, contract: "2026", apps: 16, min: 1440, sav: 52, savePct: 74, cs: 6, passAcc: 78, rating: 6.9 }),
  mk({ id: "s2", name: "Gabriel Delfim", pos: "GOL", age: 24, val: 3, apps: 3, min: 270, sav: 11, savePct: 71, cs: 1, passAcc: 80, rating: 6.6 }),
  mk({ id: "s3", name: "Júnior Alonso", pos: "ZAG", age: 32, nat: "PAR", market: "Brasileirão", val: 4, apps: 17, min: 1530, tkl: 22, intc: 31, aerial: 58, duels: 64, passAcc: 89, rating: 7.0 }),
  mk({ id: "s4", name: "Lyanco", pos: "ZAG", age: 28, val: 6, apps: 14, min: 1190, tkl: 19, intc: 24, aerial: 61, duels: 62, passAcc: 86, rating: 6.8 }),
  mk({ id: "s5", name: "Iván Román", pos: "ZAG", age: 20, nat: "CHI", val: 8, apps: 9, min: 700, tkl: 14, intc: 16, aerial: 49, duels: 57, passAcc: 84, rating: 6.7 }),
  mk({ id: "s6", name: "Rômulo", pos: "ZAG", age: 28, val: 3, apps: 8, min: 560, tkl: 11, intc: 13, aerial: 52, duels: 55, passAcc: 83, rating: 6.5 }),
  mk({ id: "s7", name: "Saravia", pos: "LD", age: 33, nat: "ARG", val: 2, contract: "2026", apps: 12, min: 980, tkl: 17, intc: 14, drib: 9, keyP: 12, prog: 41, a: 1, passAcc: 81, rating: 6.6 }),
  mk({ id: "s8", name: "Natanael", pos: "LD", age: 26, val: 4, apps: 11, min: 840, tkl: 15, intc: 12, drib: 14, keyP: 16, prog: 47, a: 2, passAcc: 82, rating: 6.8 }),
  mk({ id: "s9", name: "Guilherme Arana", pos: "LE", age: 29, val: 12, apps: 16, min: 1430, tkl: 24, intc: 18, drib: 28, keyP: 34, prog: 78, a: 5, xa: 4.1, passAcc: 84, rating: 7.4 }),
  mk({ id: "s10", name: "Caio Paulista", pos: "LE", age: 27, val: 4, apps: 9, min: 600, tkl: 11, intc: 8, drib: 12, keyP: 14, prog: 38, a: 1, passAcc: 80, rating: 6.6 }),
  mk({ id: "s11", name: "Otávio", pos: "VOL", age: 30, val: 5, apps: 17, min: 1510, tkl: 41, intc: 33, prog: 62, keyP: 18, passAcc: 88, rating: 7.1 }),
  mk({ id: "s12", name: "Alan Franco", pos: "VOL", age: 29, nat: "ARG", val: 6, apps: 15, min: 1320, tkl: 36, intc: 29, prog: 71, keyP: 21, passAcc: 89, rating: 7.0 }),
  mk({ id: "s13", name: "Fausto Vera", pos: "VOL", age: 25, nat: "ARG", val: 7, apps: 12, min: 940, tkl: 28, intc: 19, prog: 58, keyP: 23, passAcc: 87, rating: 6.8 }),
  mk({ id: "s14", name: "Igor Gomes", pos: "MEI", age: 26, val: 5, apps: 14, min: 1010, keyP: 31, a: 3, xa: 2.8, drib: 19, g: 2, xg: 2.1, passAcc: 85, prog: 44, rating: 6.9 }),
  mk({ id: "s15", name: "Gustavo Scarpa", pos: "MEI", age: 32, val: 6, apps: 18, min: 1580, keyP: 52, a: 7, xa: 6.3, drib: 22, g: 4, xg: 3.4, passAcc: 84, prog: 61, rating: 7.5 }),
  mk({ id: "s16", name: "Bernard", pos: "MEI", age: 33, val: 2, contract: "2026", apps: 13, min: 760, keyP: 33, a: 4, xa: 3.1, drib: 31, g: 2, xg: 1.6, passAcc: 86, prog: 39, rating: 7.0 }),
  mk({ id: "s17", name: "Victor Hugo", pos: "MEI", age: 21, val: 8, apps: 10, min: 640, keyP: 22, a: 2, xa: 1.9, drib: 17, g: 1, xg: 1.4, passAcc: 83, prog: 33, rating: 6.7 }),
  mk({ id: "s18", name: "Hulk", pos: "ATA", age: 39, val: 2, contract: "2026", apps: 17, min: 1450, g: 9, xg: 7.8, sot: 31, a: 3, aerial: 22, rating: 7.6 }),
  mk({ id: "s19", name: "Cassierra", pos: "ATA", age: 29, nat: "COL", val: 9, apps: 16, min: 1280, g: 8, xg: 8.9, sot: 28, a: 2, aerial: 41, rating: 7.2 }),
  mk({ id: "s20", name: "Júnior Santos", pos: "ATA", age: 31, val: 3, apps: 11, min: 700, g: 4, xg: 4.2, sot: 16, a: 1, aerial: 14, rating: 6.7 }),
  mk({ id: "s21", name: "Rony", pos: "PON", age: 30, val: 5, apps: 15, min: 1100, drib: 33, keyP: 24, a: 4, xa: 3.0, g: 5, xg: 4.8, sot: 22, rating: 7.0 }),
  mk({ id: "s22", name: "Cuello", pos: "PON", age: 25, nat: "ARG", val: 7, apps: 16, min: 1240, drib: 41, keyP: 29, a: 6, xa: 4.4, g: 4, xg: 3.6, sot: 19, rating: 7.1 }),
  mk({ id: "s23", name: "Biel", pos: "PON", age: 24, val: 4, apps: 12, min: 720, drib: 26, keyP: 18, a: 2, xa: 1.7, g: 2, xg: 2.2, sot: 13, rating: 6.6 }),
];

/* ---- POOL DE ALVOS (mercado, ilustrativo/simulado) ---- */
const POOL = [
  mk({ id: "p1", name: "Diego Martins", pos: "GOL", age: 27, val: 6, apps: 19, min: 1710, sav: 71, savePct: 78, cs: 8, passAcc: 82, rating: 7.2 }),
  mk({ id: "p2", name: "Tobias Krause", pos: "GOL", age: 24, nat: "GER", market: "Europa", val: 9, apps: 22, min: 1980, sav: 64, savePct: 76, cs: 9, passAcc: 88, rating: 7.1 }),
  mk({ id: "p3", name: "Wesley Lopes", pos: "ZAG", age: 24, val: 9, apps: 20, min: 1800, tkl: 26, intc: 34, aerial: 66, duels: 67, passAcc: 88, rating: 7.3 }),
  mk({ id: "p4", name: "Tomás Olivera", pos: "ZAG", age: 26, nat: "URU", market: "América do Sul", val: 7, apps: 18, min: 1620, tkl: 23, intc: 29, aerial: 71, duels: 69, passAcc: 85, rating: 7.2 }),
  mk({ id: "p5", name: "Andrés Quintero", pos: "ZAG", age: 22, nat: "COL", market: "América do Sul", val: 5, apps: 17, min: 1490, tkl: 21, intc: 26, aerial: 58, duels: 61, passAcc: 86, rating: 6.9 }),
  mk({ id: "p6", name: "Rafael Nunes", pos: "ZAG", age: 29, val: 4, apps: 16, min: 1380, tkl: 18, intc: 22, aerial: 63, duels: 60, passAcc: 84, rating: 6.8 }),
  mk({ id: "p7", name: "Eric Souza", pos: "LD", age: 23, val: 7, apps: 19, min: 1680, tkl: 24, intc: 19, drib: 22, keyP: 27, prog: 69, a: 4, xa: 3.2, passAcc: 83, rating: 7.2 }),
  mk({ id: "p8", name: "Bryan Mosquera", pos: "LE", age: 25, nat: "COL", market: "América do Sul", val: 8, apps: 18, min: 1560, tkl: 22, intc: 17, drib: 31, keyP: 33, prog: 74, a: 5, xa: 4.0, passAcc: 82, rating: 7.3 }),
  mk({ id: "p9", name: "Joaquín Ríos", pos: "LE", age: 28, nat: "ARG", market: "América do Sul", val: 5, apps: 17, min: 1490, tkl: 19, intc: 15, drib: 18, keyP: 21, prog: 52, a: 3, passAcc: 81, rating: 6.9 }),
  mk({ id: "p10", name: "Mateus Andrade", pos: "VOL", age: 23, val: 8, apps: 20, min: 1790, tkl: 44, intc: 36, prog: 78, keyP: 19, passAcc: 89, rating: 7.3 }),
  mk({ id: "p11", name: "Bruno Salas", pos: "VOL", age: 26, nat: "CHI", market: "América do Sul", val: 6, apps: 18, min: 1610, tkl: 39, intc: 31, prog: 64, keyP: 24, passAcc: 88, rating: 7.1 }),
  mk({ id: "p12", name: "Felipe Costa", pos: "VOL", age: 21, val: 4, apps: 14, min: 1020, tkl: 27, intc: 21, prog: 49, keyP: 17, passAcc: 86, rating: 6.7 }),
  mk({ id: "p13", name: "Lucas Romero", pos: "MEI", age: 24, nat: "ARG", market: "América do Sul", val: 11, apps: 19, min: 1670, keyP: 49, a: 8, xa: 6.7, drib: 28, g: 5, xg: 4.3, passAcc: 86, prog: 58, rating: 7.6 }),
  mk({ id: "p14", name: "Gabriel Pinto", pos: "MEI", age: 22, val: 7, apps: 18, min: 1490, keyP: 41, a: 5, xa: 4.4, drib: 24, g: 4, xg: 3.5, passAcc: 84, prog: 51, rating: 7.1 }),
  mk({ id: "p15", name: "Thiago Ramos", pos: "MEI", age: 27, val: 5, apps: 16, min: 1310, keyP: 36, a: 4, xa: 3.6, drib: 19, g: 3, xg: 2.8, passAcc: 85, prog: 47, rating: 6.9 }),
  mk({ id: "p16", name: "Kevin Restrepo", pos: "PON", age: 23, nat: "COL", market: "América do Sul", val: 12, apps: 20, min: 1720, drib: 52, keyP: 31, a: 7, xa: 5.1, g: 8, xg: 6.9, sot: 29, rating: 7.7 }),
  mk({ id: "p17", name: "Lucca Oliveira", pos: "PON", age: 21, val: 9, apps: 18, min: 1410, drib: 44, keyP: 26, a: 5, xa: 3.9, g: 6, xg: 5.4, sot: 24, rating: 7.2 }),
  mk({ id: "p18", name: "Maxi Ledesma", pos: "PON", age: 28, nat: "ARG", market: "América do Sul", val: 6, apps: 19, min: 1520, drib: 35, keyP: 28, a: 6, xa: 4.6, g: 4, xg: 4.0, sot: 18, rating: 7.0 }),
  mk({ id: "p19", name: "Pedro Henrique", pos: "ATA", age: 25, val: 10, apps: 20, min: 1700, g: 13, xg: 11.4, sot: 42, a: 3, aerial: 39, rating: 7.6 }),
  mk({ id: "p20", name: "Gonzalo Ávila", pos: "ATA", age: 27, nat: "ARG", market: "América do Sul", val: 8, apps: 18, min: 1560, g: 11, xg: 10.1, sot: 37, a: 2, aerial: 47, rating: 7.4 }),
  mk({ id: "p21", name: "Carlos Bravo", pos: "ATA", age: 22, nat: "COL", market: "América do Sul", val: 7, apps: 17, min: 1280, g: 8, xg: 7.6, sot: 28, a: 3, aerial: 31, rating: 7.1 }),
  mk({ id: "p22", name: "Iker Mendes", pos: "ATA", age: 29, nat: "ESP", market: "Europa", val: 13, apps: 21, min: 1820, g: 14, xg: 12.8, sot: 45, a: 4, aerial: 44, rating: 7.7 }),
  mk({ id: "p23", name: "Diego Lemos", pos: "LD", age: 26, val: 5, apps: 17, min: 1450, tkl: 20, intc: 16, drib: 16, keyP: 19, prog: 55, a: 2, passAcc: 82, rating: 6.9 }),
  mk({ id: "p24", name: "Nahuel Paredes", pos: "MEI", age: 25, nat: "ARG", market: "América do Sul", val: 9, apps: 19, min: 1600, keyP: 45, a: 6, xa: 5.2, drib: 26, g: 4, xg: 3.7, passAcc: 87, prog: 54, rating: 7.3 }),
];

/* ============================================================================
   CAMADA DE DADOS
   Tenta carregar dados reais de /public/data/*.json (gerados pelo pipeline).
   Se não existirem ainda (404), cai automaticamente nos dados de exemplo abaixo.
   Assim o app funciona na hora e "liga" os dados reais sozinho quando o
   pipeline rodar e publicar os JSON.
   ========================================================================== */
async function loadJson(name, fallback) {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: "no-store" });
    if (!r.ok) throw new Error("sem arquivo");
    const j = await r.json();
    const players = j.players || j;
    if (!Array.isArray(players) || players.length === 0) throw new Error("vazio");
    return { players, real: true, meta: j.meta || null };
  } catch {
    return { players: fallback, real: false, meta: null };
  }
}
const getSquad = () => loadJson("squad", SQUAD);
const getPool = () => loadJson("pool", POOL);

/* ============================== helpers ============================== */
const fmtVal = (v) => `€${v.toFixed(1)}M`;
const per90 = (stat, min) => (min > 0 ? (stat / (min / 90)) : 0);

function ranges(metrics, players) {
  const r = {};
  metrics.forEach((m) => {
    const vals = players.map((p) => p[m] ?? 0);
    r[m] = { min: Math.min(...vals), max: Math.max(...vals) };
  });
  return r;
}
function norm(v, rg) {
  if (!rg || rg.max === rg.min) return 0.5;
  return Math.max(0, Math.min(1, (v - rg.min) / (rg.max - rg.min)));
}
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

/* ============================== UI bits ============================== */
const C = {
  bg: "#0b0b0d", panel: "#141417", panel2: "#1b1b1f", line: "#2a2a30",
  text: "#ececea", muted: "#8b8b92", accent: "#c2f73a",
  ok: "#5dd39e", warn: "#f4c152", bad: "#ef6461",
};

function StatusDot({ status }) {
  const color = status === "crítico" ? C.bad : status === "atenção" ? C.warn : C.ok;
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }} />;
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#000", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: "Space Mono, monospace", fontSize: 12 }}>
      {label != null && <div style={{ color: C.text, marginBottom: 4, fontWeight: 700 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}</div>
      ))}
    </div>
  );
}

/* ============================== main ============================== */
export default function GaloScout() {
  const [tab, setTab] = useState("elenco");
  const [squad, setSquad] = useState(null);
  const [pool, setPool] = useState(null);
  const [isReal, setIsReal] = useState(false);
  const [meta, setMeta] = useState(null);
  const [selPlayer, setSelPlayer] = useState(null);
  const [subTarget, setSubTarget] = useState(null);
  const [maxBudget, setMaxBudget] = useState(15);
  const [maxAge, setMaxAge] = useState(32);
  const [marketFilter, setMarketFilter] = useState("Todos");

  useEffect(() => {
    let alive = true;
    Promise.all([getSquad(), getPool()]).then(([s, p]) => {
      if (!alive) return;
      setSquad(s.players);
      setPool(p.players);
      setIsReal(s.real && p.real);
      setMeta(s.meta);
      setSelPlayer(s.players.find((x) => x.pos === "LE") || s.players[0]);
      setSubTarget(s.players.find((x) => x.pos === "ZAG") || s.players[0]);
    });
    return () => { alive = false; };
  }, []);

  const universe = useMemo(() => (squad && pool ? [...squad, ...pool] : []), [squad, pool]);

  const tabs = [
    { id: "elenco", label: "Elenco", icon: Users },
    { id: "jogador", label: "Jogador", icon: Activity },
    { id: "diagnostico", label: "Diagnóstico", icon: AlertTriangle },
    { id: "substituto", label: "Substituto", icon: Search },
  ];

  const loading = !squad || !pool || !selPlayer || !subTarget;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
    .gs-root *{box-sizing:border-box}
    .gs-root{font-family:'Archivo',sans-serif;background:${C.bg};color:${C.text};min-height:100%;}
    .gs-disp{font-family:'Anton',sans-serif;letter-spacing:.02em;text-transform:uppercase}
    .gs-mono{font-family:'Space Mono',monospace}
    .gs-card{background:${C.panel};border:1px solid ${C.line};border-radius:14px}
    .gs-tab{cursor:pointer;border:1px solid transparent;border-radius:10px;padding:9px 14px;display:flex;gap:8px;align-items:center;color:${C.muted};font-weight:600;font-size:14px;transition:.15s;white-space:nowrap}
    .gs-tab:hover{color:${C.text};background:${C.panel2}}
    .gs-tab.on{color:#0b0b0d;background:${C.accent};border-color:${C.accent}}
    .gs-row:hover{background:${C.panel2}}
    .gs-btn{cursor:pointer;background:${C.panel2};border:1px solid ${C.line};color:${C.text};border-radius:9px;padding:8px 12px;font-weight:600;font-size:13px;transition:.15s}
    .gs-btn:hover{border-color:${C.accent};color:${C.accent}}
    .gs-sel{background:${C.panel2};border:1px solid ${C.line};color:${C.text};border-radius:9px;padding:9px 11px;font-family:'Archivo';font-size:14px;outline:none}
    .gs-sel:focus{border-color:${C.accent}}
    input[type=range]{accent-color:${C.accent}}
    .gs-chip{font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${C.panel2};border:1px solid ${C.line};color:${C.muted}}
    .gs-scroll::-webkit-scrollbar{height:8px;width:8px}
    .gs-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}
  `;

  return (
    <div className="gs-root">
      <style>{css}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 18px 60px" }}>

        {/* masthead */}
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "#000", border: `2px solid ${C.text}`, display: "grid", placeItems: "center" }}>
              <Shield size={24} color={C.accent} strokeWidth={2.2} />
            </div>
            <div>
              <div className="gs-disp" style={{ fontSize: 34, lineHeight: .9 }}>Galo Scout</div>
              <div className="gs-mono" style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>análise de elenco · diagnóstico · scouting</div>
            </div>
          </div>
          <div className="gs-card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={14} color={isReal ? C.ok : C.accent} />
            <span className="gs-mono" style={{ fontSize: 11, color: C.muted }}>
              {isReal ? "dados reais (FBref + Transfermarkt)" : "dados de exemplo — rode o pipeline p/ dados reais"}
            </span>
          </div>
        </header>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: "120px 0", color: C.muted }}>
            <div className="gs-disp" style={{ fontSize: 22, color: C.text }}>Carregando…</div>
            <div className="gs-mono" style={{ fontSize: 12, marginTop: 8 }}>montando o elenco</div>
          </div>
        ) : (
        <>
        {/* tabs */}
        <nav className="gs-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 0 20px" }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className={`gs-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                <Icon size={16} /> {t.label}
              </div>
            );
          })}
        </nav>

        {tab === "elenco" && <ElencoView squad={squad} onPick={(p) => { setSelPlayer(p); setTab("jogador"); }} />}
        {tab === "jogador" && <JogadorView squad={squad} universe={universe} sel={selPlayer} setSel={setSelPlayer} />}
        {tab === "diagnostico" && <DiagnosticoView squad={squad} onReinforce={(pos) => { setSubTarget(bestInPos(squad, pos)); setTab("substituto"); }} />}
        {tab === "substituto" && (
          <SubstitutoView
            squad={squad} pool={pool} universe={universe}
            target={subTarget} setTarget={setSubTarget}
            maxBudget={maxBudget} setMaxBudget={setMaxBudget}
            maxAge={maxAge} setMaxAge={setMaxAge}
            marketFilter={marketFilter} setMarketFilter={setMarketFilter}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}

function bestInPos(squad, pos) {
  const inPos = squad.filter((p) => p.pos === pos);
  return inPos.sort((a, b) => b.rating - a.rating)[0] || squad[0];
}

/* ============================== ELENCO ============================== */
function ElencoView({ squad, onPick }) {
  const [sortKey, setSortKey] = useState("rating");
  const [posFilter, setPosFilter] = useState("Todos");

  const totalVal = squad.reduce((a, p) => a + p.val, 0);
  const avgAge = avg(squad.map((p) => p.age));
  const avgRating = avg(squad.map((p) => p.rating));
  const expiring = squad.filter((p) => p.contract === "2026").length;

  const kpis = [
    { label: "Jogadores", value: squad.length, icon: Users },
    { label: "Valor do elenco", value: fmtVal(totalVal), icon: TrendingUp },
    { label: "Idade média", value: avgAge.toFixed(1), icon: Activity },
    { label: "Nota média", value: avgRating.toFixed(2), icon: Crosshair },
    { label: "Contratos 2026", value: expiring, icon: AlertTriangle, alert: expiring > 3 },
  ];

  let rows = posFilter === "Todos" ? squad : squad.filter((p) => p.pos === posFilter);
  rows = [...rows].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "age") return a.age - b.age;
    if (sortKey === "val") return b.val - a.val;
    return b.rating - a.rating;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="gs-card" style={{ padding: 16 }}>
              <Icon size={16} color={k.alert ? C.warn : C.accent} />
              <div className="gs-disp" style={{ fontSize: 28, marginTop: 10, color: k.alert ? C.warn : C.text }}>{k.value}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{k.label}</div>
            </div>
          );
        })}
      </div>

      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Elenco completo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="gs-sel" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
              <option>Todos</option>
              {POS_ORDER.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
            </select>
            <select className="gs-sel" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
              <option value="rating">Ordenar: nota</option>
              <option value="val">Ordenar: valor</option>
              <option value="age">Ordenar: idade</option>
              <option value="name">Ordenar: nome</option>
            </select>
          </div>
        </div>

        <div className="gs-scroll" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.muted, fontSize: 12 }}>
                {["Jogador", "Pos", "Idade", "Contrato", "Valor", "Jogos", "Nota", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}`, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="gs-row" style={{ cursor: "pointer", transition: ".12s" }} onClick={() => onPick(p)}>
                  <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="gs-mono" style={{ fontSize: 11, color: C.muted }}>{p.nat}</div>
                  </td>
                  <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}><span className="gs-chip">{p.pos}</span></td>
                  <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: p.age >= 33 ? C.warn : C.text }}>{p.age}</td>
                  <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: p.contract === "2026" ? C.bad : C.muted }}>{p.contract}</td>
                  <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>{fmtVal(p.val)}</td>
                  <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: C.muted }}>{p.apps}</td>
                  <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>
                    <span className="gs-mono" style={{ fontWeight: 700, color: p.rating >= 7.2 ? C.accent : p.rating < 6.6 ? C.muted : C.text }}>{p.rating.toFixed(2)}</span>
                  </td>
                  <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}><ArrowUpRight size={15} color={C.muted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== JOGADOR ============================== */
function JogadorView({ squad, universe, sel, setSel }) {
  const metrics = POS_METRICS[sel.pos];
  const samePos = universe.filter((p) => p.pos === sel.pos);
  const rg = ranges(metrics, samePos);

  const radarData = metrics.map((m) => ({
    metric: METRIC_LABEL[m],
    jogador: Math.round(norm(sel[m] ?? 0, rg[m]) * 100),
    média: Math.round(avg(samePos.map((p) => norm(p[m] ?? 0, rg[m]))) * 100),
  }));

  // percentis vs mesma posição (no universo squad+pool)
  const pct = (m) => {
    const v = sel[m] ?? 0;
    const below = samePos.filter((p) => (p[m] ?? 0) <= v).length;
    return Math.round((below / samePos.length) * 100);
  };

  const showStats = sel.pos === "GOL"
    ? ["sav", "savePct", "cs", "passAcc"]
    : sel.pos === "ATA"
      ? ["g", "xg", "sot", "aerial", "a"]
      : ["g", "a", "xa", "keyP", "drib", "tkl", "intc", "prog"].filter((m) => metrics.includes(m) || ["g", "a", "keyP"].includes(m));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="gs-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 12, background: "#000", border: `1px solid ${C.line}`, display: "grid", placeItems: "center" }}>
            <span className="gs-disp" style={{ fontSize: 22, color: C.accent }}>{sel.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
          </div>
          <div>
            <div className="gs-disp" style={{ fontSize: 26 }}>{sel.name}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, color: C.muted, fontSize: 13 }}>
              <span className="gs-chip">{POS_LABEL[sel.pos]}</span>
              <span>{sel.age} anos</span><span>·</span><span>{sel.nat}</span><span>·</span>
              <span className="gs-mono">{fmtVal(sel.val)}</span>
            </div>
          </div>
        </div>
        <select className="gs-sel" value={sel.id} onChange={(e) => setSel(squad.find((p) => p.id === e.target.value))}>
          {POS_ORDER.flatMap((pos) => squad.filter((p) => p.pos === pos)).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.pos})</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div className="gs-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Perfil vs. média da posição</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke={C.line} />
                <PolarAngleAxis dataKey="metric" tick={{ fill: C.muted, fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Média pos." dataKey="média" stroke={C.muted} fill={C.muted} fillOpacity={0.15} />
                <Radar name="Jogador" dataKey="jogador" stroke={C.accent} fill={C.accent} fillOpacity={0.35} />
                <Tooltip content={<ChartTip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gs-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Percentil na posição (Brasileirão + alvos)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metrics.map((m) => {
              const p = pct(m);
              const color = p >= 70 ? C.accent : p >= 40 ? C.warn : C.bad;
              return (
                <div key={m}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: C.muted }}>{METRIC_LABEL[m]}</span>
                    <span className="gs-mono" style={{ color }}>{p}%</span>
                  </div>
                  <div style={{ height: 7, background: C.panel2, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: 6 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Números da temporada (totais e por 90 min)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
          {showStats.map((m) => (
            <div key={m} style={{ background: C.panel2, borderRadius: 10, padding: 12 }}>
              <div style={{ color: C.muted, fontSize: 12 }}>{METRIC_LABEL[m]}</div>
              <div className="gs-disp" style={{ fontSize: 24, marginTop: 4 }}>{(sel[m] ?? 0)}{(m === "savePct" || m === "passAcc" || m === "duels") ? "%" : ""}</div>
              {!(m === "savePct" || m === "passAcc" || m === "duels" || m === "cs") && (
                <div className="gs-mono" style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>{per90(sel[m] ?? 0, sel.min).toFixed(2)}/90</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================== DIAGNÓSTICO ============================== */
const DEPTH_NEED = { GOL: 2, ZAG: 4, LD: 2, LE: 2, VOL: 3, MEI: 3, PON: 3, ATA: 2 };

function DiagnosticoView({ squad, onReinforce }) {
  const rows = POS_ORDER.map((pos) => {
    const players = squad.filter((p) => p.pos === pos);
    const depth = players.length;
    const aAge = avg(players.map((p) => p.age));
    const aRat = avg(players.map((p) => p.rating));
    const aVal = players.reduce((a, p) => a + p.val, 0);

    const flags = [];
    let worst = "ok";
    const need = DEPTH_NEED[pos];
    if (depth < need) { flags.push(`profundidade baixa (${depth}/${need})`); worst = depth < need - 1 ? "crítico" : "atenção"; }
    if (aAge >= 32) { flags.push(`elenco envelhecido (${aAge.toFixed(0)})`); worst = aAge >= 34 ? "crítico" : worst === "crítico" ? worst : "atenção"; }
    if (aRat < 6.7) { flags.push(`rendimento abaixo (${aRat.toFixed(2)})`); if (aRat < 6.4) worst = "crítico"; else if (worst === "ok") worst = "atenção"; }
    if (!flags.length) flags.push("setor saudável");

    return { pos, depth, aAge, aRat, aVal, flags, status: worst };
  });

  const priorities = rows.filter((r) => r.status !== "ok").sort((a, b) => (a.status === "crítico" ? -1 : 1) - (b.status === "crítico" ? -1 : 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Diagnóstico por setor</div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Cruzamento de profundidade, idade média e rendimento. Verde = saudável · amarelo = atenção · vermelho = carência.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.pos} className="gs-card" style={{ padding: 14, background: C.panel2, borderColor: r.status === "crítico" ? C.bad : r.status === "atenção" ? "rgba(244,193,82,.4)" : C.line }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{POS_LABEL[r.pos]}</div>
                <StatusDot status={r.status} />
              </div>
              <div style={{ display: "flex", gap: 14, margin: "12px 0", fontSize: 12 }}>
                <div><div style={{ color: C.muted }}>Profund.</div><div className="gs-mono" style={{ fontSize: 16 }}>{r.depth}</div></div>
                <div><div style={{ color: C.muted }}>Idade</div><div className="gs-mono" style={{ fontSize: 16 }}>{r.aAge.toFixed(0)}</div></div>
                <div><div style={{ color: C.muted }}>Nota</div><div className="gs-mono" style={{ fontSize: 16 }}>{r.aRat.toFixed(2)}</div></div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.muted }}>
                {r.flags.map((f, i) => <li key={i} style={{ marginBottom: 2 }}>{f}</li>)}
              </ul>
              {r.status !== "ok" && (
                <button className="gs-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => onReinforce(r.pos)}>
                  Buscar reforço →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {priorities.length > 0 && (
        <div className="gs-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 10 }}>
            <AlertTriangle size={16} color={C.warn} /> Prioridades do mercado
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {priorities.map((r) => (
              <div key={r.pos} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panel2, borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusDot status={r.status} />
                  <span style={{ fontWeight: 600 }}>{POS_LABEL[r.pos]}</span>
                  <span style={{ color: C.muted, fontSize: 13 }}>{r.flags.join(" · ")}</span>
                </div>
                <button className="gs-btn" onClick={() => onReinforce(r.pos)}>Alvos →</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== SUBSTITUTO ============================== */
function SubstitutoView({ squad, pool, universe, target, setTarget, maxBudget, setMaxBudget, maxAge, setMaxAge, marketFilter, setMarketFilter }) {
  const metrics = POS_METRICS[target.pos];
  const compat = POS_GROUP[target.pos];
  const samePos = universe.filter((p) => compat.includes(p.pos));
  const rg = ranges(metrics, samePos);

  // pesos por estatística (1 = normal) + equilíbrio similaridade × qualidade
  const [weights, setWeights] = useState({});
  const [simBalance, setSimBalance] = useState(55);   // % do fit vindo da similaridade
  const w = (m) => (weights[m] ?? 1);
  const setW = (m, v) => setWeights((prev) => ({ ...prev, [m]: v }));
  const sb = simBalance / 100;

  const tVec = metrics.map((m) => norm(target[m] ?? 0, rg[m]));
  const ratingRg = ranges(["rating"], samePos)["rating"];

  const candidates = pool
    .filter((c) => compat.includes(c.pos))
    .filter((c) => c.val <= maxBudget && c.age <= maxAge)
    .filter((c) => marketFilter === "Todos" || c.market === marketFilter)
    .map((c) => {
      const cVec = metrics.map((m) => norm(c[m] ?? 0, rg[m]));
      const den = metrics.reduce((s, m) => s + w(m), 0) || 1;
      const dist = metrics.reduce((s, m, i) => s + w(m) * Math.abs(cVec[i] - tVec[i]), 0) / den;
      const sim = 1 - dist;                               // similaridade ponderada de perfil
      const quality = norm(c.rating, ratingRg);           // qualidade absoluta
      const fit = Math.round(100 * (sb * sim + (1 - sb) * quality));
      const upgrade = +(c.rating - target.rating).toFixed(2);
      const efficiency = +(fit / Math.max(c.val, 0.5)).toFixed(1);
      return { ...c, fit, sim: Math.round(sim * 100), quality: Math.round(quality * 100), upgrade, efficiency };
    })
    .sort((a, b) => b.fit - a.fit);

  const scatter = candidates.map((c) => ({ x: c.val, y: c.fit, z: c.rating, name: c.name }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* controles */}
      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 14 }}>
          <Filter size={16} color={C.accent} /> Parâmetros da busca
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>Substituir / referência</label>
            <select className="gs-sel" style={{ width: "100%", marginTop: 6 }} value={target.id} onChange={(e) => setTarget(squad.find((p) => p.id === e.target.value))}>
              {POS_ORDER.flatMap((pos) => squad.filter((p) => p.pos === pos)).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.pos}) · nota {p.rating.toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>Mercado</label>
            <select className="gs-sel" style={{ width: "100%", marginTop: 6 }} value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
              {["Todos", "Brasileirão", "América do Sul", "Europa"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>Teto de valor</span><span className="gs-mono" style={{ color: C.accent }}>{fmtVal(maxBudget)}</span>
            </label>
            <input type="range" min={1} max={20} step={0.5} value={maxBudget} onChange={(e) => setMaxBudget(+e.target.value)} style={{ width: "100%", marginTop: 12 }} />
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>Idade máxima</span><span className="gs-mono" style={{ color: C.accent }}>{maxAge} anos</span>
            </label>
            <input type="range" min={18} max={38} step={1} value={maxAge} onChange={(e) => setMaxAge(+e.target.value)} style={{ width: "100%", marginTop: 12 }} />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
          Posições compatíveis: {compat.map((p) => POS_LABEL[p]).join(", ")} · perfil comparado em {metrics.length} métricas · <strong style={{ color: C.text }}>{candidates.length}</strong> alvos no filtro.
        </div>
      </div>

      {/* pesos das estatísticas */}
      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <Activity size={16} color={C.accent} /> Pesos das estatísticas
          </div>
          <button className="gs-btn" onClick={() => { setWeights({}); setSimBalance(55); }}>Redefinir</button>
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
          Defina o quanto cada estatística pesa no encaixe. <strong style={{ color: C.text }}>0×</strong> ignora, <strong style={{ color: C.text }}>1×</strong> é normal, <strong style={{ color: C.text }}>3×</strong> é o triplo. O ranking abaixo recalcula na hora.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
          {metrics.map((m) => (
            <div key={m}>
              <label style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: w(m) === 0 ? C.muted : C.text }}>{METRIC_LABEL[m]}</span>
                <span className="gs-mono" style={{ color: w(m) === 0 ? C.muted : C.accent }}>{w(m).toFixed(1)}×</span>
              </label>
              <input type="range" min={0} max={3} step={0.5} value={w(m)} onChange={(e) => setW(m, +e.target.value)} style={{ width: "100%", marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <label style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.text }}>Equilíbrio do fit</span>
            <span className="gs-mono" style={{ color: C.accent }}>{simBalance}% parecido · {100 - simBalance}% qualidade</span>
          </label>
          <input type="range" min={0} max={100} step={5} value={simBalance} onChange={(e) => setSimBalance(+e.target.value)} style={{ width: "100%", marginTop: 10 }} />
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
            Mais à esquerda = prioriza quem joga parecido com o jogador de referência. Mais à direita = prioriza quem tem a maior nota, mesmo com perfil diferente.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        {/* scatter */}
        <div className="gs-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Valor × Fit</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Canto superior esquerdo = barato e encaixa bem.</div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 14, bottom: 18, left: -8 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Valor (€M)" tick={{ fill: C.muted, fontSize: 11 }} stroke={C.line} label={{ value: "Valor €M", position: "insideBottom", offset: -8, fill: C.muted, fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="Fit" domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.line} />
                <ZAxis type="number" dataKey="z" range={[60, 260]} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: C.line }} />
                <Scatter data={scatter} fill={C.accent} fillOpacity={0.85} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* top fit bar */}
        <div className="gs-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Top encaixe (fit)</div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={candidates.slice(0, 7).map((c) => ({ name: c.name, fit: c.fit }))} margin={{ left: 20, right: 16 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.line} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fill: C.text, fontSize: 11 }} stroke={C.line} />
                <Tooltip content={<ChartTip />} cursor={{ fill: C.panel2 }} />
                <Bar dataKey="fit" radius={[0, 6, 6, 0]}>
                  {candidates.slice(0, 7).map((c, i) => (
                    <Cell key={i} fill={i === 0 ? C.accent : "#5a5a3a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ranking table */}
      <div className="gs-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Ranking de candidatos</div>
        {candidates.length === 0 ? (
          <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>Nenhum alvo nos filtros. Aumente o teto de valor ou a idade.</div>
        ) : (
          <div className="gs-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.muted, fontSize: 12 }}>
                  {["#", "Jogador", "Pos", "Idade", "Mercado", "Valor", "Fit", "Similar.", "Δ Nota", "Custo-benef."].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.id} className="gs-row" style={{ transition: ".12s" }}>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: C.muted }}>{i + 1}</td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, fontWeight: 600 }}>{c.name}<span className="gs-mono" style={{ color: C.muted, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>{c.nat}</span></td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}><span className="gs-chip">{c.pos}</span></td>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>{c.age}</td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: C.muted, fontSize: 12 }}>{c.market}</td>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>{fmtVal(c.val)}</td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${C.line}` }}>
                      <span className="gs-mono" style={{ fontWeight: 700, color: c.fit >= 75 ? C.accent : c.fit >= 60 ? C.warn : C.muted }}>{c.fit}</span>
                    </td>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: C.muted }}>{c.sim}%</td>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: c.upgrade > 0 ? C.ok : c.upgrade < 0 ? C.bad : C.muted }}>{c.upgrade > 0 ? "+" : ""}{c.upgrade}</td>
                    <td className="gs-mono" style={{ padding: "10px", borderBottom: `1px solid ${C.line}`, color: C.text }}>{c.efficiency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Fit</strong> = mistura de similaridade de perfil (ponderada pelos pesos acima) e qualidade absoluta (nota), no equilíbrio que você definiu. <strong style={{ color: C.text }}>Δ Nota</strong> = upgrade/downgrade vs. o jogador de referência. <strong style={{ color: C.text }}>Custo-benefício</strong> = fit por €M.
        </div>
      </div>
    </div>
  );
}