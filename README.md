# commit.

> **Stake it. Prove it. Let the chain decide.**

commit is a habit-accountability protocol on Solana. Users stake USDC on daily habits — coding, reading, writing, design, or gym. Every check-in is verified by AI and stored as a cryptographically signed attestation on-chain. Disputes are resolved by a stricter counter-prompt. A perceptual hash registry blocks photo reuse before AI even runs. Complete your streak and claim the reward pool. Miss a day and get slashed. Finish and mint a soulbound completion NFT that lives on-chain forever.

---

## Three Novel Technical Contributions

### 1 — Verifiable AI Attestations
Kimi AI verdicts are ed25519-signed by the verifier backend, packed into a deterministic 171-byte message, and verified on-chain by Solana's native `Ed25519Program`. Every accepted check-in can be disputed within a 24-hour window. Disputes trigger a stricter counter-prompt; the result updates the attestation state and distributes bonds atomically. The full optimistic verification trail is permanently on-chain.

### 2 — On-Chain Perceptual Hash Registry
Every accepted photo's 64-bit DCT perceptual hash is appended to a `PhashRegistry` PDA. On the next check-in, the contract computes Hamming distance against every stored hash (~12 CU per comparison). If distance ≤ 8, the submission is rejected before AI runs, making photo reuse cryptographically impossible at the protocol level.

### 3 — Soulbound Completion NFTs
Streak completion mints a Token-2022 NFT with the `NonTransferable` extension enforced at the mint level — no transfers, ever. The mint also uses the `MetadataPointer` extension to store the streak name, habit type, duration, and stake amount directly on-chain. Mint authority is revoked immediately after minting, making the NFT permanently fixed to the holder.

---

## Live Demo

- **App:** [your-vercel-url]
- **Demo Video:** [your-video-link]

## Hackathon Tracks

| Track | What We Built | Prize |
|---|---|---|
| 🏆 Solana Main | 8-instruction Anchor program, ed25519 attestations, pHash registry, Token-2022 soulbound NFTs, 15/15 tests | Up to $3,000 |
| 🌉 LI.FI | Cross-chain stake entry from any EVM chain via LI.FI SDK | Up to $500 |
| 💰 x402 Bonus | Verification API gated by 0.001 USDC micropayments — self-sustaining AI verification | $500 |

## Reward Economics

Rewards come entirely from participants who failed. No external funding, no token inflation.

**Example — 10-person coding streak, 5 USDC stake, 50% penalty:**

| Event | Amount |
|---|---|
| 10 people join, each stakes 5 USDC | 50 USDC locked in escrow |
| 4 people quit, each slashed 50% | 10 USDC moves to reward pool |
| 6 people complete | Each gets: 5 USDC (stake) + 1.67 USDC (pool share) |
| **Net result for completers** | **6.67 USDC each — 33% return** |
| **Net result for quitters** | **2.50 USDC remaining (lost 2.50 each)** |

> *The more people fail, the more completers earn.*

---

## Architecture

```
commit/
├── anchor/                        # Solana program (Rust + Anchor 0.32)
│   ├── programs/commit/src/
│   │   ├── lib.rs                 # Entry point, program constants
│   │   ├── state/                 # 5 account types
│   │   │   ├── streak.rs
│   │   │   ├── participant.rs
│   │   │   ├── checkin_attestation.rs
│   │   │   ├── phash_registry.rs
│   │   │   └── streak_proof.rs
│   │   ├── instructions/          # 8 instructions
│   │   │   ├── create_streak.rs
│   │   │   ├── join_streak.rs
│   │   │   ├── submit_checkin_with_attestation.rs
│   │   │   ├── dispute_checkin.rs
│   │   │   ├── resolve_dispute.rs
│   │   │   ├── finalize_checkin.rs
│   │   │   ├── slash_missed.rs
│   │   │   └── claim_reward.rs
│   │   ├── errors.rs
│   │   └── utils.rs               # ed25519 verify + Hamming distance
│   ├── scripts/
│   │   └── finalize-checkin.ts    # Permissionless finalizer (devnet testing)
│   └── tests/
├── app/                           # Next.js 16 (App Router)
│   ├── app/                       # Pages + layouts
│   ├── api/                       # Verification API routes
│   │   ├── verify-checkin/        # Photo → AI → signed attestation
│   │   ├── verify-counter/        # Dispute counter-review
│   │   ├── verify-github/         # GitHub auto-verification (Code habit)
│   │   └── verifier-pubkey/       # Returns verifier public key
│   ├── components/                # UI components
│   └── lib/                       # Solana, attestation, pHash helpers
└── public/
    └── commit-logo.png
```

### Smart Contract — 5 Account Types

| Account | PDA Seeds | Purpose |
|---|---|---|
| `Streak` | `[streak, creator, name]` | Config, pool size, escrow reference |
| `Participant` | `[participant, streak, user]` | Stake amount, streak count, active status |
| `CheckinAttestation` | `[attestation, participant, day_index]` | Signed verdict, dispute state, pHash |
| `PhashRegistry` | `[phash, streak]` | `Vec<u64>` of all accepted photo hashes |
| `StreakProof` | `[proof, streak, owner]` | Completion record embedded in NFT metadata |

### Smart Contract — 8 Instructions

| Instruction | Description |
|---|---|
| `create_streak` | Initialize Streak + PhashRegistry + USDC escrow |
| `join_streak` | Transfer stake into escrow, create Participant account |
| `submit_checkin_with_attestation` | Verify ed25519 sig, check pHash, create Pending attestation |
| `dispute_checkin` | Lock dispute bond, mark attestation Disputed |
| `resolve_dispute` | Run counter-attestation, distribute bonds, update state |
| `finalize_checkin` | After dispute window, lock in the day and append pHash |
| `slash_missed` | After 48h grace period, slash penalty percentage into pool |
| `claim_reward` | Return stake + pool share, mint soulbound NFT, create StreakProof |

### Protocol Constants

| Constant | Devnet | Production |
|---|---|---|
| `DISPUTE_WINDOW_SECONDS` | `60` (1 min, for testing) | `86,400` (24h) |
| `DISPUTE_BOND_PERCENT` | `10%` | `10%` |
| `DISPUTE_BOUNTY_PERCENT` | `30%` | `30%` |
| `PHASH_HAMMING_THRESHOLD` | `8 bits` | `8 bits` |
| `SLASH_GRACE_PERIOD_SECONDS` | `172,800` (48h) | `172,800` (48h) |

### Attestation Message Layout (171 bytes)

```
VERIFIER_PUBKEY [32] || participant [32] || streak [32]
|| day_index [2, u16 LE] || photo_hash [32] || phash [8, u64 LE]
|| verdict [1] || reason_hash [32]
```

Signed with ed25519 via tweetnacl on the backend. Verified on-chain via Solana's native ed25519 program. Transaction ordering is enforced: ed25519 sigverify at index 0, program instruction at index 1.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Rust + Anchor 0.32, SPL Token (USDC escrow), Token-2022 (NFTs) |
| Frontend | Next.js 16, React 19, TypeScript strict, Tailwind CSS v4 |
| Wallet | Privy (`@privy-io/react-auth`) — embedded wallets, Solana + EVM |
| AI verification | Moonshot Kimi via OpenAI-compatible SDK |
| Attestation signing | tweetnacl ed25519 keypair |
| Perceptual hash | `sharp` — DCT-based 64-bit pHash |
| Cross-chain stake | LI.FI SDK — bridge USDC from any EVM chain to Solana |
| GitHub auto-verify | `@octokit/rest` — verifies push activity for Code habit |
| Deploy | Vercel (frontend) + Solana Devnet (program) |

---

## Five Habit Types

| Habit | Verification |
|---|---|
| **Code** | GitHub push activity (auto) or screenshot of editor/terminal |
| **Read** | Photo of book or e-reader showing the current page |
| **Write** | Screenshot of doc editor with visible written content |
| **Design** | Screenshot of design tool with visible work in progress |
| **Gym** | Photo showing gym environment, equipment, or workout attire |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Rust + [Anchor CLI 0.32](https://www.anchor-lang.com/docs/installation)
- Solana CLI ≥ 1.18, configured for devnet (`solana config set --url devnet`)
- A [Privy](https://privy.io) app ID with Google + wallet login enabled
- A [Moonshot](https://platform.moonshot.cn) API key

### Installation

```bash
git clone https://github.com/rehna-p/commit
cd commit
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Solana
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>

# LI.FI
NEXT_PUBLIC_LIFI_INTEGRATOR=commit

# AI verification
MOONSHOT_API_KEY=<your-moonshot-api-key>

# Attestation signing — generate with: node anchor/scripts/gen-verifier-keypair.js
VERIFIER_PRIVATE_KEY=<base58-64-byte-secret-key>
NEXT_PUBLIC_VERIFIER_PUBLIC_KEY=<base58-32-byte-public-key>

# GitHub (optional — for Code habit auto-verification)
GITHUB_APP_TOKEN=<personal-access-token>

# Devnet mode — shortens dispute window display to match 60s on-chain window
NEXT_PUBLIC_DEVNET_MODE=true
```

> To generate a fresh verifier keypair, run:
> ```bash
> node anchor/scripts/gen-verifier-keypair.js
> ```
> Copy the output into `.env.local` and paste the `VERIFIER_PUBKEY` array into `anchor/programs/commit/src/lib.rs`. Rebuild and redeploy the program.

### Run

```bash
npm run dev          # frontend at http://localhost:3000
```

### Build the Anchor Program

```bash
npm run anchor-build               # compile the Rust program
anchor deploy --provider.cluster devnet   # deploy to Solana devnet
```

---

## Development Reference

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run anchor-build` | Build the Solana program |
| `npm run anchor-test` | Run program tests |

### Devnet Finalization Script

After a check-in is submitted it enters a 60-second dispute window (1 minute on devnet, 24 hours in production). Run this to permissionlessly finalize all eligible attestations:

```bash
cd anchor
npx ts-node scripts/finalize-checkin.ts
```

Any wallet can call `finalize_checkin` once the window has elapsed. The script reads the wallet from `~/.config/solana/id.json`.

### Key Files

| File | Purpose |
|---|---|
| `anchor/programs/commit/src/lib.rs` | Program constants and instruction dispatch |
| `anchor/programs/commit/src/instructions/claim_reward.rs` | Token-2022 soulbound NFT minting |
| `app/api/verify-checkin/route.ts` | Photo → AI → signed attestation endpoint |
| `app/lib/attestation.ts` | 171-byte message builder + ed25519 signing |
| `app/lib/phash.ts` | DCT perceptual hash via sharp |
| `app/lib/solana.ts` | Instruction builders for all 8 on-chain instructions |
| `app/lib/use-chain-data.ts` | React hooks for on-chain account fetching |
| `app/components/providers.tsx` | Privy + React Query provider setup |

---

## Deployed Program

| Network | Program ID |
|---|---|
| Devnet | [`3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G`](https://explorer.solana.com/address/3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G?cluster=devnet) |

---

## Security Notes

- **Ed25519 ordering** — the sigverify instruction must be at index 0; the program reads it from the instructions sysvar.
- **Token-2022 extension ordering** — `NonTransferable` must be initialized before `MetadataPointer`, both before `initialize_mint2`.
- **Prompt injection** — custom `habit_prompt` fields are truncated to 256 chars, stripped of control characters, and wrapped in `<user_provided_criteria>` delimiters before being passed to AI.
- **pHash check is on-chain** — photo reuse cannot be bypassed even if the verifier backend is compromised.
- **Verifier keypair** — `VERIFIER_PRIVATE_KEY` must never be committed to source control. The on-chain `VERIFIER_PUBKEY` constant is hardcoded and requires a program upgrade to rotate.

---

*Built at Dev3pack Hackathon 2026*
