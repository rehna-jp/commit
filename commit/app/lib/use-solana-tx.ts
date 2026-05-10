'use client';
// React hook for sending Anchor/web3.js transactions via the connected Solana wallet.
import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@/app/lib/wallet-context';
import {
  Transaction,
  TransactionInstruction,
  Keypair,
  SendTransactionError,
} from '@solana/web3.js';

export interface TxOptions {
  extraSigners?: Keypair[];
  onStatus?: (msg: string) => void;
}

export interface UseSolanaTransactionResult {
  sendTransaction: (ixs: TransactionInstruction[], opts?: TxOptions) => Promise<string>;
  sending: boolean;
  error: string | null;
}

function parseAnchorError(err: unknown): string {
  if (err instanceof SendTransactionError) {
    const logs = err.logs ?? [];
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
  const { publicKey, sendTransaction: walletSendTransaction } = useWallet();
  const { connection } = useConnection();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTransaction = useCallback(
    async (ixs: TransactionInstruction[], opts: TxOptions = {}): Promise<string> => {
      setError(null);
      setSending(true);

      try {
        if (!publicKey) throw new Error('No Solana wallet connected');

        opts.onStatus?.('Fetching blockhash…');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
        for (const ix of ixs) tx.add(ix);

        if (opts.extraSigners && opts.extraSigners.length > 0) {
          tx.partialSign(...opts.extraSigners);
        }

        opts.onStatus?.('Waiting for wallet approval…');
        const sig = await walletSendTransaction(tx, connection);

        opts.onStatus?.('Confirming…');
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

        return sig;
      } catch (err) {
        const msg = parseAnchorError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setSending(false);
      }
    },
    [publicKey, connection, walletSendTransaction]
  );

  return { sendTransaction, sending, error };
}
