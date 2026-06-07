# Galo Scout

Dashboard de análise de elenco e scouting do Atlético Mineiro (React + Vite).
Funciona na hora com dados de exemplo e passa a usar **dados reais** (FBref + Transfermarkt)
automaticamente assim que o pipeline em `data-pipeline/` gerar os JSON em `public/data/`.

## Rodar localmente

Pré-requisito: Node.js 20+ (https://nodejs.org).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (ex.: http://localhost:5173).

## Publicar no Vercel

1. Suba o projeto pro GitHub:
   ```bash
   git init
   git add .
   git commit -m "Galo Scout - inicial"
   git branch -M main
   git remote add origin https://github.com/matheusrodrigues-design/galo-scout.git
   git push -u origin main
   ```
2. Em vercel.com → **Add New → Project → Import** o repositório.
3. O Vercel detecta o Vite sozinho. Clique em **Deploy**. Pronto.

Daqui pra frente, todo `git push` republica automaticamente.

## Ativar dados reais

O dashboard sempre tenta carregar `public/data/squad.json` e `public/data/pool.json`.
Enquanto não existirem, ele usa os dados de exemplo embutidos (e mostra "dados de exemplo"
no topo). Para gerar os dados reais, veja **`data-pipeline/README.md`**.

## Estrutura

```
galo-scout/
├── src/GaloScout.jsx     # o dashboard inteiro
├── public/data/          # squad.json / pool.json (gerados pelo pipeline)
├── data-pipeline/        # script Python que gera os dados reais
└── .github/workflows/    # atualização automática semanal dos dados
```
