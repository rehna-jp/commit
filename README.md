# commit.

> **Stake it. Prove it. Let the chain decide.**

commit is a habit-accountability protocol on Solana. Users stake USDC on daily habits — coding, reading, writing, design, or gym. Every check-in is verified by Groq AI (Llama 4 Scout) and stored as a cryptographically signed attestation on-chain. Disputes are resolved by a stricter counter-prompt. A perceptual hash registry blocks photo reuse before AI even runs. Complete your streak and claim the reward pool. Miss a day and get slashed. Finish and mint a soulbound completion NFT that lives on-chain forever.

---

## Three Novel Technical Contributions

### 1 — Verifiable AI Attestations
Groq (Llama 4 Scout) verdicts are ed25519-signed by the verifier backend, packed into a deterministic 171-byte message, and verified on-chain by Solana's native `Ed25519Program`. Every accepted check-in can be disputed within a 24-hour window. Disputes trigger a stricter counter-prompt; the result updates the attestation state and distributes bonds atomically. The full optimistic verification trail is permanently on-chain.

### 2 — On-Chain Perceptual Hash Registry
Every accepted photo's 64-bit DCT perceptual hash is appended to a `PhashRegistry` PDA. On the next check-in, the contract computes Hamming distance against every stored hash (~12 CU per comparison). If distance ≤ 8, the submission is rejected before AI runs making photo reuse cryptographically impossible at the protocol level.

### 3 — Soulbound Completion NFTs
Streak completion mints a Token-2022 NFT with the `NonTransferable` extension enforced at the mint level — no transfers, ever. Mint authority is revoked immediately after minting, making the NFT permanently fixed to the holder.

---

## Live Demo

- **App:** (https://commit-gamma-two.vercel.app/)
- **Demo Video:** (https://youtu.be/vKfbVv-0dpY?si=3rW3hiIiNHAPKIUU)

---

## User Flow

```
Connect Wallet  (Phantom / Solflare / Backpack)
      ↓
Create Streak   →  deploys Streak + USDC escrow on-chain
      ↓
Join Streak     →  USDC locked into escrow (creator must also join)
      ↓
── repeat daily until duration ends ──────────────────────────
      ↓
Check In        →  upload photo (or GitHub auto-verify for Code)
      ↓
AI Verifies     →  Groq reviews → backend signs 171-byte attestation
      ↓
On-chain        →  CheckinAttestation PDA created (state: Pending)
      ↓
Dispute Window  →  24h (60s on devnet) — any participant can challenge
      ↓
Finalize        →  attestation locked (Finalized) + pHash appended
──────────────────────────────────────────────────────────────
      ↓
Miss a day?     →  slash_missed → penalty% moves to reward pool
      ↓
Streak ends
      ↓
Completed?  Yes →  claim_reward → stake + pool share + soulbound NFT minted
            No  →  withdraw_failed → unslashed remaining stake returned
```

---

## Reward Economics

Rewards come entirely from participants who failed. No external funding, no token inflation.

**Example — 10 people, 5 USDC stake, 50% penalty:**

| Event | Amount |
|---|---|
| 10 people join, each stakes 5 USDC | 50 USDC locked |
| 4 people quit, each slashed 50% | 10 USDC moves to reward pool |
| 6 people complete | Each gets 5 USDC (stake) + 1.67 USDC (pool share) |
| **Net for completers** | **6.67 USDC — 33% return** |
| **Net for quitters** | **2.50 USDC returned via withdraw_failed** |

> *The more people fail, the more completers earn. Quitters lose only the slashed portion — unslashed stake is always returnable after the streak ends.*

---

## Architecture

```
commit/
├── anchor/                        # Solana program (Rust + Anchor 0.32)
│   ├── programs/commit/src/
│   │   ├── lib.rs                 # Entry point, program constants
│   │   ├── state/                 # 5 account types
│   │   ├── instructions/          # 11 instructions
│   │   ├── errors.rs
│   │   └── utils.rs               # ed25519 verify + Hamming distance
│   ├── scripts/
│   │   └── finalize-checkin.ts    # Permissionless finalizer for devnet
│   └── tests/
└── app/                           # Next.js 16 (App Router)
    ├── app/                       # Pages + layout
    ├── api/                       # Verification API routes
    │   ├── verify-checkin/        # Photo → Groq → signed attestation
    │   ├── verify-counter/        # Dispute counter-review
    │   ├── verify-github/         # GitHub auto-verification (Code habit)
    │   └── verifier-pubkey/       # Returns verifier public key
    ├── components/                # UI components
    └── lib/                       # Solana helpers, wallet context, LI.FI, attestation
```

---

## Smart Contract

### 5 Account Types

| Account | PDA Seeds | Purpose |
|---|---|---|
| `Streak` | `[streak, creator, name]` | Config, pool size, escrow reference |
| `Participant` | `[participant, streak, user]` | Stake amount, streak count, active status |
| `CheckinAttestation` | `[attestation, participant, day_index]` | Signed verdict, dispute state, pHash |
| `PhashRegistry` | `[phash, streak]` | `Vec<u64>` of all accepted photo hashes |
| `StreakProof` | `[proof, streak, owner]` | Completion record for NFT metadata |

### 11 Instructions

| Instruction | Description |
|---|---|
| `create_streak` | Initialize Streak + PhashRegistry + USDC escrow |
| `join_streak` | Transfer stake into escrow, create Participant account |
| `submit_checkin_with_attestation` | Verify ed25519 sig, check pHash, create Pending attestation |
| `dispute_checkin` | Lock dispute bond, mark attestation Disputed |
| `resolve_dispute` | Run counter-attestation, distribute bonds, update state |
| `expire_dispute` | Permissionless: after dispute window closes with no counter-attestation, pay disputer bond + bounty and mark Overturned |
| `finalize_checkin` | After dispute window, lock in the day and append pHash |
| `slash_missed` | After 48h grace period, slash penalty into pool — blocked if day's attestation is still Pending or Disputed |
| `cancel_streak` | Creator cancels before the streak starts and reclaims escrow |
| `claim_reward` | Return stake + pool share, mint soulbound NFT, create StreakProof |
| `withdraw_failed` | After streak ends, return unslashed stake to participants who didn't complete |

### Protocol Constants

| Constant | Devnet | Mainnet |
|---|---|---|
| Dispute window | 60s (1 min) | 86,400s (24h) |
| Dispute bond | 10% of stake | 10% of stake |
| Dispute bounty | 30% of slash | 30% of slash |
| pHash threshold | 8 bits Hamming | 8 bits Hamming |
| Slash grace period | 172,800s (48h) | 172,800s (48h) |

### Attestation Message Layout (171 bytes)

```
VERIFIER_PUBKEY [32] || participant [32] || streak [32]
|| day_index [2, u16 LE] || photo_hash [32] || phash [8, u64 LE]
|| verdict [1] || reason_hash [32]
```

Signed with ed25519 via tweetnacl. Verified on-chain via Solana's native ed25519 program. The on-chain verifier scans all transaction instructions for the Ed25519 entry.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Rust + Anchor 0.32, SPL Token (USDC escrow), Token-2022 (soulbound NFTs) |
| Frontend | Next.js 16, React 19, TypeScript strict, Tailwind CSS v4 |
| Wallet | Native browser wallet-standard — Phantom, Solflare, Backpack |
| AI verification | Groq (`llama-4-scout-17b-16e-instruct`) via Groq SDK |
| Cross-chain staking | LI.FI SDK v3 — bridge USDC from any EVM chain to Solana (mainnet) |
| Attestation signing | tweetnacl ed25519 keypair |
| Perceptual hash | `sharp` — DCT-based 64-bit pHash |
| GitHub auto-verify | `@octokit/rest` — verifies push activity for Code habit |
| Deploy | Vercel (frontend) + Solana Devnet (program) |

---

## Five Habit Types

| Habit | Verification Method |
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
- Solana CLI ≥ 1.18 configured for devnet (`solana config set --url devnet`)
- A [Groq](https://console.groq.com) API key (free)

### Installation

```bash
git clone https://github.com/rehna-p/commit
cd commit
npm install
```

### Environment Variables

Create `.env.local` in the `commit/` folder:

```env
# Solana
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# LI.FI
NEXT_PUBLIC_LIFI_INTEGRATOR=commit

# AI verification (free tier — get key at console.groq.com)
GROQ_API_KEY=<your-groq-api-key>

# Attestation signing
VERIFIER_PRIVATE_KEY=<base58-ed25519-secret-key>
NEXT_PUBLIC_VERIFIER_PUBLIC_KEY=<base58-ed25519-public-key>

# GitHub (optional — for Code habit auto-verification)
GITHUB_APP_TOKEN=<personal-access-token>

# x402 micropayments (set true to enable verification fee gate)
VERIFICATION_FEE_WALLET=<solana-wallet-pubkey>
NEXT_PUBLIC_X402_ENABLED=false

# Devnet mode — shortens dispute window display to match 60s on-chain window
NEXT_PUBLIC_DEVNET_MODE=true
```

### Run

```bash
cd commit
npm run dev          # http://localhost:3000
```

### Build & Deploy the Anchor Program

```bash
npm run anchor-build
anchor deploy --provider.cluster devnet
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run anchor-build` | Build the Solana program |
| `npm run anchor-test` | Run program tests |

### Finalize Check-ins on Devnet

After submitting a check-in it enters a 60-second dispute window. Once elapsed, run this to finalize eligible attestations permissionlessly:

```bash
cd commit/anchor
npx ts-node scripts/finalize-checkin.ts
```

---

## Cross-Chain Staking (LI.FI)

Users can stake from any EVM chain — no need to hold SOL or Solana USDC first. The cross-chain tab on the stake widget:

1. Connect MetaMask
2. Pick source chain (Base, Arbitrum, Ethereum, Optimism, Polygon, BNB)
3. LI.FI finds the best bridge route for the exact USDC stake amount
4. One click bridges USDC to your Solana wallet and joins the streak

> Cross-chain staking operates on **mainnet** only (LI.FI routes live assets).

---

## Deployed Program

| Network | Program ID |
|---|---|
| Devnet | [`3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G`](https://explorer.solana.com/address/3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G?cluster=devnet) |

---

## Security Notes

- **Ed25519 ordering** — the on-chain program scans all transaction instructions for the Ed25519 sigverify entry (wallets like Phantom prepend ComputeBudget instructions, so position is not assumed).
- **Token-2022 extension ordering** — `NonTransferable` must be initialized before `initialize_mint2`.
- **Prompt injection** — custom `habit_prompt` fields are truncated to 256 chars, stripped of control characters, and wrapped in `<user_provided_criteria>` delimiters before reaching Groq.
- **pHash check is on-chain** — photo reuse cannot be bypassed even if the verifier backend is compromised.
- **Verifier keypair** — `VERIFIER_PRIVATE_KEY` must never be committed. The on-chain `VERIFIER_PUBKEY` is hardcoded and requires a program upgrade to rotate.
