// x402 HTTP payment middleware for Next.js App Router verification endpoints
import { NextRequest, NextResponse } from 'next/server';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com';
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? '';

function isX402Enabled(): boolean {
  return process.env.NEXT_PUBLIC_X402_ENABLED === 'true';
}

export interface X402Options {
  amount: number;       // USDC base units (1000 = 0.001 USDC)
  recipient: string;    // wallet address receiving fees
  description: string;
}

export type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

export function withX402Payment(handler: RouteHandler, options: X402Options): RouteHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (!isX402Enabled()) return handler(req);

    const paymentHeader = req.headers.get('x-payment');

    if (!paymentHeader) {
      return NextResponse.json(
        {
          x402Version: 1,
          accepts: [
            {
              scheme: 'exact',
              network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
              maxAmountRequired: String(options.amount),
              resource: req.url,
              description: options.description,
              mimeType: 'application/json',
              payTo: options.recipient,
              extra: { name: 'commit', token: USDC_MINT },
            },
          ],
        },
        { status: 402 }
      );
    }

    const valid = await verifyX402Payment(paymentHeader, options);
    if (!valid) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 402 });
    }

    return handler(req);
  };
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
}

interface SolanaTransactionResult {
  meta: {
    err: unknown;
    preTokenBalances: TokenBalance[];
    postTokenBalances: TokenBalance[];
  } | null;
}

async function verifyX402Payment(header: string, options: X402Options): Promise<boolean> {
  try {
    const proof = JSON.parse(
      Buffer.from(header, 'base64').toString('utf-8')
    ) as { signature: string; network: string };

    const rpcResp = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          proof.signature,
          {
            encoding: 'jsonParsed',
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    });

    const body = (await rpcResp.json()) as { result: SolanaTransactionResult | null };
    const tx = body.result;
    if (!tx || tx.meta?.err !== null) return false;

    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];

    let received = 0;
    for (const pb of post) {
      if (pb.mint !== USDC_MINT) continue;
      if (pb.owner !== options.recipient) continue;
      const preBal = Number(
        pre.find((b) => b.accountIndex === pb.accountIndex)?.uiTokenAmount.amount ?? 0
      );
      received += Number(pb.uiTokenAmount.amount) - preBal;
    }

    return received >= options.amount;
  } catch {
    return false;
  }
}
