// Client-side x402 payment flow: detects 402, makes USDC payment, retries request
'use client';

import { findAssociatedTokenPda, getTransferInstruction } from '@solana-program/token';
import type { Address } from '@solana/kit';
import { address } from '@solana/kit';
import { createClient } from '@solana/kit-client-rpc';
import type { WalletSession } from './wallet/types';
import { createWalletSigner } from './wallet/signer';
import { getClusterUrl, type ClusterMoniker } from './solana-client';

const TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;

interface X402Requirements {
  accepts: Array<{
    maxAmountRequired: string;
    payTo: string;
    network: string;
    extra: { token: string };
  }>;
}

export async function fetchWithX402(
  url: string,
  body: unknown,
  session: WalletSession,
  cluster: ClusterMoniker = 'devnet',
): Promise<unknown> {
  const firstResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (firstResponse.status !== 402) {
    return firstResponse.json();
  }

  const requirements = (await firstResponse.json()) as X402Requirements;
  const details = requirements.accepts[0];
  if (!details) throw new Error('No payment details in 402 response');

  const mint = address(details.extra.token);
  const recipient = address(details.payTo);
  const amount = BigInt(details.maxAmountRequired);
  const walletAddress = session.account.address;

  const [sourceAta] = await findAssociatedTokenPda({
    owner: walletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint,
  });

  const [destAta] = await findAssociatedTokenPda({
    owner: recipient,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint,
  });

  const signer = createWalletSigner(session, `solana:${cluster}`);

  const transferIx = getTransferInstruction({
    source: sourceAta,
    destination: destAta,
    authority: signer,
    amount,
  });

  const txClient = createClient({
    url: getClusterUrl(cluster),
    payer: signer,
  });

  const result = await txClient.sendTransaction([transferIx]);
  const txSig = String(result.context.signature);

  const paymentProof = Buffer.from(
    JSON.stringify({ signature: txSig, network: details.network })
  ).toString('base64');

  const secondResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': paymentProof,
    },
    body: JSON.stringify(body),
  });

  return secondResponse.json();
}
