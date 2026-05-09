// Anchor Program factory — read-only provider for instruction building
// Signing always happens via the wallet, not here.
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { Idl } from '@coral-xyz/anchor';
import { PROGRAM_ID_STR, SOLANA_RPC } from './constants';
import IDL from './idl/commit.json';

export type CommitProgram = Program;

let _program: CommitProgram | null = null;

export function getProgram(userPubkey?: string): CommitProgram {
  const pubkey = userPubkey ? new PublicKey(userPubkey) : PublicKey.default;

  // Create a read-only provider — signing happens via Privy wallet separately
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const dummyWallet = {
    publicKey: pubkey,
    signTransaction: async (tx: unknown) => tx,
    signAllTransactions: async (txs: unknown[]) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as never, {
    commitment: 'confirmed',
  });

  // Always create a fresh instance when pubkey changes
  if (!_program || _program.provider.publicKey?.toBase58() !== pubkey.toBase58()) {
    _program = new Program(IDL as Idl, provider);
  }
  return _program;
}

export function getConnection(): Connection {
  return new Connection(SOLANA_RPC, 'confirmed');
}

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);
