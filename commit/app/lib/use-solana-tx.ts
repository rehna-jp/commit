'use client';
// React hook for sending Anchor/web3.js transactions via Privy's Solana wallet.
import { useCallback, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  Keypair,
  SendTransactionError,
} from '@solana/web3.js';
import { findSolanaWallet } from './privy-utils';
import { getConnection } from './program';
import { PROGRAM_ID_STR } from './constants';

export interface TxOptions {
  extraSigners?: Keypair[];       // e.g. completionMint for claim_reward
  onStatus?: (msg: string) => void;
}

export interface UseSolanaTransactionResult {
  sendTransaction: (
    ixs: TransactionInstruction[],
    opts?: TxOptions
  ) => Promise<string>;
  sending: boolean;
  error: string | null;
}

function parseAnchorError(err: unknown): string {
  if (err instanceof SendTransactionError) {
    const logs = err.logs ?? [];
    // Extract anchor error code + message from logs
    for (const log of logs) {
      const match = log.match(/Error Code: (\w+)\. Error Number: \d+\. Error Message: (.+)\./);
      if (match) return `${match[1]}: ${match[2]}`;
      if (log.includes('Error:')) return log.replace(/.*Error:/, '').trim();
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Transaction failed';
}

export function useSolanaTransaction(): UseSolanaTransactionResult {
  const { wallets } = useWallets();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTransaction = useCallback(
    async (ixs: TransactionInstruction[], opts: TxOptions = {}): Promise<string> => {
      setError(null);
      setSending(true);

      try {
        const solanaWallet = findSolanaWallet(wallets);
        if (!solanaWallet) throw new Error('No Solana wallet connected');

        const userPubkey = new PublicKey(solanaWallet.address);
        const connection = getConnection();

        opts.onStatus?.('Fetching blockhash…');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        // Build the transaction
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: userPubkey,
        });
        for (const ix of ixs) tx.add(ix);

        // Sign any extra keypairs (e.g. completion_mint for NFT)
        if (opts.extraSigners && opts.extraSigners.length > 0) {
          tx.partialSign(...opts.extraSigners);
        }

        // Serialize for wallet signing
        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

        opts.onStatus?.('Waiting for wallet approval…');

        // Get Privy's Solana provider (wallet-standard)
        const provider = (solanaWallet as unknown as { provider: unknown }).provider as Record<
          string,
          unknown
        >;

        // Attempt signAndSendTransaction via wallet-standard feature
        const signAndSend = (
          provider?.features as Record<string, unknown>
        )?.['solana:signAndSendTransaction'] as
          | {
              signAndSendTransaction: (opts: {
                transaction: Uint8Array;
                account: unknown;
                chain: string;
              }) => Promise<{ signature: Uint8Array }>;
            }
          | undefined;

        if (signAndSend) {
          opts.onStatus?.('Sending transaction…');
          const accounts = (provider as Record<string, unknown>).accounts as unknown[];
          const { signature } = await signAndSend.signAndSendTransaction({
            transaction: new Uint8Array(serialized),
            account: accounts[0],
            chain: 'solana:devnet',
          });
          const sig = Buffer.from(signature).toString('hex');
          opts.onStatus?.('Confirming…');
          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          return sig;
        }

        // Fallback: signTransaction + sendRawTransaction
        const signFeature = (provider?.features as Record<string, unknown>)?.[
          'solana:signTransaction'
        ] as
          | {
              signTransaction: (opts: {
                transactions: Uint8Array[];
                account: unknown;
                chain: string;
              }) => Promise<{ signedTransactions: Uint8Array[] }>;
            }
          | undefined;

        if (signFeature) {
          opts.onStatus?.('Signing transaction…');
          const accounts = (provider as Record<string, unknown>).accounts as unknown[];
          const { signedTransactions } = await signFeature.signTransaction({
            transactions: [new Uint8Array(serialized)],
            account: accounts[0],
            chain: 'solana:devnet',
          });
          const signedTx = Transaction.from(Buffer.from(signedTransactions[0]));
          opts.onStatus?.('Sending transaction…');
          const sig = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
          opts.onStatus?.('Confirming…');
          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          return sig;
        }

        throw new Error(
          'Wallet does not support transaction signing. Make sure a Solana wallet is connected.'
        );
      } catch (err) {
        const msg = parseAnchorError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setSending(false);
      }
    },
    [wallets]
  );

  return { sendTransaction, sending, error };
}
