#!/usr/bin/env ts-node
// Permissionless finalizer: calls finalize_checkin for every Pending attestation
// whose 24h (or devnet 60s) dispute window has elapsed.
//
// Usage:
//   cd anchor && npx ts-node scripts/finalize-checkin.ts
//
// Wallet: ~/.config/solana/id.json (set ANCHOR_WALLET env to override)

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G');
const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com';

function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ??
    path.join(os.homedir(), '.config', 'solana', 'id.json');
  const raw = JSON.parse(fs.readFileSync(walletPath, 'utf-8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function findPhashRegistryPda(streak: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('phash'), streak.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  const keypair = loadWallet();
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  // Load IDL from target/idl/commit.json
  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'commit.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new anchor.Program(idl as anchor.Idl, provider) as any;

  console.log(`Caller : ${keypair.publicKey.toBase58()}`);
  console.log(`RPC    : ${RPC_URL}`);
  console.log('');
  console.log('Fetching all CheckinAttestation accounts…');

  const allAccounts = await program.account.checkinAttestation.all();
  const now = Math.floor(Date.now() / 1000);

  const eligible = allAccounts.filter((a: { account: { state: unknown; disputeWindowEnds: { toNumber: () => number } } }) => {
    const stateKey = Object.keys(a.account.state as object)[0];
    const windowEnds = a.account.disputeWindowEnds.toNumber();
    return stateKey === 'pending' && windowEnds <= now;
  });

  console.log(`Found ${allAccounts.length} total attestations, ${eligible.length} ready to finalize.`);

  if (eligible.length === 0) {
    console.log('');
    console.log('Nothing to finalize yet.');
    console.log('If DISPUTE_WINDOW_SECONDS=60, submit a check-in and wait 1 minute.');
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (const acct of eligible) {
    const attestation = acct.publicKey as PublicKey;
    const streak = acct.account.streak as PublicKey;
    const participant = acct.account.participant as PublicKey;
    const dayIndex = acct.account.dayIndex as number;
    const phashRegistry = findPhashRegistryPda(streak);

    console.log('');
    console.log(`Attestation : ${attestation.toBase58()}`);
    console.log(`  Streak    : ${streak.toBase58()}`);
    console.log(`  Day       : ${dayIndex}`);
    console.log(`  Window end: ${new Date(acct.account.disputeWindowEnds.toNumber() * 1000).toISOString()}`);

    try {
      const sig = await program.methods
        .finalizeCheckin()
        .accounts({
          attestation,
          participant,
          streak,
          phashRegistry,
          caller: keypair.publicKey,
        })
        .rpc({ commitment: 'confirmed' });

      console.log(`  ✓ Finalized — sig: ${sig.slice(0, 22)}…`);
      succeeded++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Already finalized by another caller — not a real error
      if (msg.includes('AttestationNotPending') || msg.includes('already in use')) {
        console.log(`  ⚠ Already finalized (skipping)`);
      } else {
        console.error(`  ✗ Failed: ${msg}`);
        failed++;
      }
    }
  }

  console.log('');
  console.log(`Done — ${succeeded} finalized, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
