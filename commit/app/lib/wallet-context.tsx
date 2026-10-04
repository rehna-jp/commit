"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { SOLANA_RPC } from "./constants";

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey: { toBytes(): Uint8Array; toString(): string; toBase58?(): string } | null;
  isConnected: boolean;
  connect(opts?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  signAndSendTransaction?(
    tx: Transaction,
    opts?: object
  ): Promise<{ signature: string }>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function getProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
  };
  // Prefer Phantom's namespaced provider, fall back to Solflare, Backpack, or window.solana
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? w.solana ?? null;
}

function extractPublicKey(
  resp: unknown,
  provider: SolanaProvider | null
): PublicKey | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate =
    (resp as any)?.publicKey ??
    provider?.publicKey ??
    (resp as any)?.address ??
    (provider as any)?.address;

  if (!candidate) return null;

  try {
    if (candidate instanceof PublicKey) {
      return candidate;
    }
    if (typeof candidate === "string") {
      return new PublicKey(candidate);
    }
    if (typeof candidate === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (candidate as any).toBase58 === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new PublicKey((candidate as any).toBase58());
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (candidate as any).toString === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const str = (candidate as any).toString();
        if (str && str !== "[object Object]") {
          return new PublicKey(str);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (candidate as any).toBytes === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new PublicKey((candidate as any).toBytes());
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PublicKey(candidate as any);
  } catch (err) {
    console.warn("Failed to extract wallet public key:", err);
    return null;
  }
}

interface WalletCtx {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
}

const WalletContext = createContext<WalletCtx>({
  connected: false,
  connecting: false,
  publicKey: null,
  address: null,
  connect: async () => {},
  disconnect: async () => {},
  sendTransaction: async () => {
    throw new Error("No wallet");
  },
});

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Eager connect & event listeners (connect, disconnect, accountChanged)
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleConnect = (pk?: unknown) => {
      const key = extractPublicKey(pk ? { publicKey: pk } : null, provider);
      if (key) setPublicKey(key);
    };

    const handleDisconnect = () => {
      setPublicKey(null);
    };

    const handleAccountChanged = (pk?: unknown) => {
      if (pk) {
        const key = extractPublicKey({ publicKey: pk }, provider);
        setPublicKey(key);
      } else {
        const key = extractPublicKey(null, provider);
        setPublicKey(key);
      }
    };

    if (typeof provider.on === "function") {
      provider.on("connect", handleConnect);
      provider.on("disconnect", handleDisconnect);
      provider.on("accountChanged", handleAccountChanged);
    }

    if (provider.isConnected && provider.publicKey) {
      const key = extractPublicKey(null, provider);
      if (key) setPublicKey(key);
    } else if (typeof provider.connect === "function") {
      provider
        .connect({ onlyIfTrusted: true })
        .then((resp) => {
          const key = extractPublicKey(resp, provider);
          if (key) setPublicKey(key);
        })
        .catch(() => {
          // User hasn't pre-authorized this origin yet
        });
    }

    return () => {
      if (typeof provider.removeListener === "function") {
        provider.removeListener("connect", handleConnect);
        provider.removeListener("disconnect", handleDisconnect);
        provider.removeListener("accountChanged", handleAccountChanged);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const resp = await provider.connect();
      const pk = extractPublicKey(resp, provider);
      if (pk) {
        setPublicKey(pk);
      }
    } catch (err) {
      console.warn("Wallet connect rejected or failed:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    try {
      await provider?.disconnect();
    } catch (err) {
      console.warn("Wallet disconnect error:", err);
    }
    setPublicKey(null);
  }, []);

  const sendTransaction = useCallback(
    async (tx: Transaction, connection: Connection) => {
      const provider = getProvider();
      if (!provider || !publicKey) throw new Error("Wallet not connected");

      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
      }
      if (!tx.feePayer) {
        tx.feePayer = publicKey;
      }

      const signed = await provider.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      return sig;
    },
    [publicKey]
  );

  const address = publicKey?.toBase58() ?? null;

  return (
    <WalletContext.Provider
      value={{
        connected: !!publicKey,
        connecting,
        publicKey,
        address,
        connect,
        disconnect,
        sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

export function useConnection() {
  return { connection: new Connection(SOLANA_RPC, "confirmed") };
}

