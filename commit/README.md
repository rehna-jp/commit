# commit

Habit-stake protocol on Solana. Users stake USDC on daily habits (code, read, write, design, gym). AI verifies check-ins via signed attestations. On-chain dispute windows. pHash registry blocks photo reuse. Completion mints soulbound Token-2022 NFT.

## Stack

- **Program** — Rust + Anchor
- **Frontend** — Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Wallet** — wallet-standard (auto-discovery)
- **Solana client** — `@solana/kit`
- **Program client** — Codama-generated from Anchor IDL

## Setup

```bash
npm install
npm run anchor-build   # build Anchor program
npm run codama:js      # generate TypeScript client from IDL
npm run dev            # start dev server at http://localhost:3000
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run anchor-build` | Build Anchor program |
| `npm run anchor-test` | Run Anchor tests (LiteSVM) |
| `npm run codama:js` | Regenerate TypeScript client from IDL |
| `npm run setup` | anchor-build + codama:js |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
