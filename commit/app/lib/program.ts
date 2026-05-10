// Anchor Program factory — read-only provider for instruction building
// Signing always happens via the wallet, not here.
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID_STR, SOLANA_RPC } from './constants';
import IDL from './idl/commit.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommitProgram = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _program: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgram(userPubkey?: string): any {
  const pubkey = userPubkey ? new PublicKey(userPubkey) : PublicKey.default;

  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const dummyWallet = {
    publicKey: pubkey,
    signTransaction: async (tx: unknown) => tx,
    signAllTransactions: async (txs: unknown[]) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as never, {
    commitment: 'confirmed',
  });

  if (!_program || _program.provider.publicKey?.toBase58() !== pubkey.toBase58()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _program = new Program(IDL as any, provider);
  }
  return _program;
}

export function getConnection(): Connection {
  return new Connection(SOLANA_RPC, 'confirmed');
}

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);
