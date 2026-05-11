# commit

Habit-stake protocol on Solana. Users stake USDC on daily habits (code, read, write, design, gym). AI (Claude) verifies check-in photos. Every AI verdict is a cryptographically signed attestation posted on-chain with a 24-hour dispute window. A perceptual hash registry on-chain prevents photo reuse before AI even runs. Completion mints a soulbound Token-2022 NFT.

## Three Novel Technical Contributions

1. **Verifiable AI attestations** — Claude verdicts are ed25519-signed, posted on-chain, and subject to 24h dispute windows. Disputes resolved by a stricter counter-prompt. Optimistic verification pattern.
2. **On-chain perceptual hash registry** — 64-bit pHash stored per streak. Contract rejects photos with Hamming distance ≤ 8 from any prior accepted photo. Blocks reuse before AI runs.
3. **Soulbound completion NFTs** — Token-2022 NonTransferable extension. Embedded metadata with full attestation history. Composable on-chain reputation.

## Monorepo Structure

```
commit/
├── anchor/              # Solana program (Rust, Anchor)
│   ├── programs/commit/src/
│   │   ├── lib.rs
│   │   ├── state/       # 5 account types
│   │   ├── instructions/ # 8 instructions
│   │   ├── errors.rs
│   │   └── utils.rs     # ed25519 verify + hamming distance
│   └── tests/
├── app/                 # Next.js 14 (App Router)
│   ├── app/             # Pages
│   ├── app/api/         # 4 verification API routes
│   ├── components/      # UI components
│   └── lib/             # Solana, LI.FI, attestation helpers
```

## Commands

- `cd anchor && anchor build` — build Solana program
- `cd anchor && anchor test` — run Anchor tests
- `cd app && npm run dev` — start frontend
- `cd app && npm run build` — production build

## Tech Stack

- **Contract:** Rust + Anchor, SPL Token (USDC escrow), Token-2022 (completion NFTs), native ed25519 sigverify program
- **Frontend:** Next.js 14 App Router, TypeScript strict, Tailwind CSS
- **Wallet:** Native browser wallet-standard — Phantom, Solflare, Backpack (no third-party auth SDK)
- **Cross-chain:** LI.FI SDK — stake entry from any EVM chain → Solana USDC
- **AI:** Groq API (Llama 4 Scout vision model)
- **Signing:** tweetnacl for ed25519 attestation signing
- **pHash:** sharp for image processing, DCT-based 64-bit perceptual hash
- **GitHub:** @octokit/rest for coding habit auto-verification
- **Deploy:** Vercel (frontend) + Solana Devnet (contract)

## Five Habit Types

```
Code   — GitHub auto-verify OR screenshot of editor/terminal
Read   — Photo of book/e-reader showing current page
Write  — Screenshot of doc editor with visible content
Design — Screenshot of design tool with visible work
Gym    — Photo showing gym environment, equipment, workout attire
```

On-chain enum: `HabitType { Code=0, Read=1, Write=2, Design=3, Gym=4 }`
The contract doesn't care about habit type — it cares about the attestation signature and pHash. All habit-specific logic lives in the verification API.

## Smart Contract Overview

### 5 Account Types
- **Streak** — PDA `[b"streak", creator, name]`. Holds config, pool, escrow reference.
- **Participant** — PDA `[b"participant", streak, user]`. Stake, streak count, active status.
- **CheckinAttestation** — PDA `[b"attestation", participant, day_index]`. Signed verdict, dispute state, pHash.
- **PhashRegistry** — PDA `[b"phash", streak]`. Vec<u64> of accepted hashes.
- **StreakProof** — PDA `[b"proof", streak, owner]`. Completion record for NFT metadata.

### 8 Instructions
1. `create_streak` — init Streak + PhashRegistry + USDC escrow
2. `join_streak` — transfer stake into escrow, create Participant
3. `submit_checkin_with_attestation` — verify ed25519 sig, check pHash, create Pending attestation
4. `dispute_checkin` — post bond, mark Disputed, extend window
5. `resolve_dispute` — counter-attestation resolves; distribute bonds
6. `finalize_checkin` — after 24h no dispute, lock in day, append pHash
7. `slash_missed` — after 48h gap, slash penalty% into pool
8. `claim_reward` — return stake + pool share, mint Token-2022 NFT, create StreakProof

### Constants
```
DISPUTE_WINDOW: 86,400 seconds (24h)
DISPUTE_BOND: 10% of stake
DISPUTE_BOUNTY: 30% of slash amount
PHASH_HAMMING_THRESHOLD: 8
SLASH_GRACE_PERIOD: 172,800 seconds (48h)
```

## Verification API Overview

### 4 Endpoints
- `POST /api/verify-checkin` — photo → Claude → signed attestation (171-byte message)
- `POST /api/verify-counter` — same input, stricter dispute prompt
- `POST /api/verify-github` — GitHub events → signed attestation (Code habit only)
- `GET /api/verifier-pubkey` — returns verifier public key

x402 micropayment layer on verification endpoints (P1 — $500 bonus). Feature-flagged via NEXT_PUBLIC_X402_ENABLED.

### Attestation Message Layout (171 bytes)
```
VERIFIER_PUBKEY  (32) || participant  (32) || streak  (32)
|| day_index  (2, u16 LE) || photo_hash  (32) || phash  (8, u64 LE)
|| verdict  (1) || reason_hash  (32)
```
Signed with ed25519 via tweetnacl. Verified on-chain via Solana's native ed25519 program.

### Prompt Injection Sanitization
Custom habit_prompt fields are untrusted. Truncate to 256 chars, strip control characters, reject known jailbreak prefixes, wrap in `<user_provided_criteria>` delimiters.

## Critical Architecture Rules

IMPORTANT: These rules are non-negotiable. Getting them wrong breaks the core security model.

- **Ed25519 tx ordering:** Transaction MUST have ed25519 sigverify instruction at index 0, program instruction at index 1. Program reads index 0 from instructions sysvar.
- **Token-2022 extension ordering:** NonTransferable extension MUST be initialized BEFORE `initialize_mint2`. Get space with `ExtensionType::try_calculate_account_len`.
- **pHash check happens on-chain:** `(existing ^ new).count_ones() <= 8` rejects. ~12 CU per comparison. Linear scan is fine for hackathon scale.
- **Attestation signing:** Backend signs with ed25519 keypair. Client submits signature + message. Program reconstructs message and verifies against hardcoded VERIFIER_PUBKEY.
- **LI.FI Solana chain ID:** `1151111081099710` — NOT Solana's internal chain ID.
- **Wallet pattern:** `useWallet()` from `app/lib/wallet-context.tsx` — connects directly to `window.phantom.solana` or any wallet-standard provider.
- **Grape (#5e548e) contrast:** Fails WCAG AA for small text. NEVER use for body copy under 18px. Use zinc-600 (#52525B) or darker.

## Code Style

- TypeScript strict mode, no `any` types
- ES modules (import/export), never CommonJS
- One component per file, one instruction per file
- No TODOs, no placeholders, no pseudo-code — every function must be complete
- All secrets from environment variables
- Brief comment at top of each file explaining purpose

## Design System

### Logo
- Logo file: `/public/commit-logo.png`
- Use on: landing page hero, navbar, favicon, README header
- On dark backgrounds place directly (logo has dark bg built in)
- Wordmark: `commit.` with lilac (#be95c4) dot for text contexts

### Colors — Amethyst Palette
```
dark_amethyst:   #231942  — dark mode bg, hero sections, secondary buttons
dusty_grape:     #5e548e  — primary buttons, active card left-borders, key values, progress fills
amethyst_smoke:  #9f86c0  — secondary accent, hover states, dark mode card accents
lilac:           #be95c4  — logo dot, completion glow, NFT badge accent
pink_orchid:     #e0b1cb  — habit chip bg, soft button fills, empty states
```

### Semantic States — NEVER use purple for these
```
Pending:    amber  — bg #FEF3C7, text #92400E, dot #F59E0B
Disputed:   blue   — bg #DBEAFE, text #1E40AF, dot #3B82F6
Finalized:  green  — bg #D1FAE5, text #065F46, dot #10B981
Overturned: gray   — bg #F4F4F5, text #52525B, dot #A1A1AA
Slashed:    red    — bg #FEE2E2, text #991B1B, dot #EF4444
```

### Component Rules
- Active cards: 3px left border in grape (light) / smoke (dark)
- Progress bars: solid grape fill, NO gradients
- Habit chips: orchid-900 (#f9f0f5) bg, orchid-800 border, grape icons
- Buttons: Primary=grape, Secondary=dark amethyst, Soft=orchid bg + grape text, Outline=border only
- Monospace font for all USDC values, stake amounts, pool sizes
- Dark mode background: #231942 (not black)
- No gradients, no shadows, no glow. Flat always. 0.5px borders.
- Habit icons (Lucide): Code=Code2, Read=BookOpen, Write=PenLine, Design=Palette, Gym=Dumbbell

### Typography
- h1: 32px/500/-0.02em  |  h2: 22px/500  |  body: 15px/400/zinc-500
- Two weights only: 400 and 500. Never 600/700.

## Environment Variables
```
NEXT_PUBLIC_SOLANA_RPC, NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_USDC_MINT
NEXT_PUBLIC_LIFI_INTEGRATOR=commit
GROQ_API_KEY, VERIFIER_PRIVATE_KEY, NEXT_PUBLIC_VERIFIER_PUBLIC_KEY
GITHUB_APP_TOKEN
```

See @.agents/ for Solana development references and patterns.