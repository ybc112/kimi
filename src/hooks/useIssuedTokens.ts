import { useEffect, useState } from "react";
import type { IssuedToken, TokenStatus, TokenType } from "@/types";

const ISSUED_TOKENS_KEY = "kimi-issued-tokens";

export interface CreateTokenInput {
  name: string;
  symbol: string;
  address: string;
  deployer: string;
  network: string;
  chainId: number;
  txHash: string;
  status?: TokenStatus;
  totalSupply?: string;
  type: TokenType;
  imageUrl?: string;
}

/**
 * 已发代币的 CRUD hook。
 * 当前基于 localStorage，后续可替换为合约事件监听 + 后端同步。
 */
export function useIssuedTokens() {
  const [tokens, setTokens] = useState<IssuedToken[]>(() => readTokens());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(ISSUED_TOKENS_KEY, JSON.stringify(tokens));
  }, [tokens]);

  const addToken = (input: CreateTokenInput) => {
    const token: IssuedToken = {
      ...input,
      id: crypto.randomUUID(),
      status: input.status ?? "success",
      createdAt: Date.now(),
    };
    setTokens((prev) => [token, ...prev]);
    return token;
  };

  const updateToken = (id: string, updates: Partial<IssuedToken>) => {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const clearTokens = () => {
    setTokens([]);
  };

  const refresh = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setTokens(readTokens());
    setLoading(false);
  };

  return { tokens, loading, addToken, updateToken, removeToken, clearTokens, refresh };
}

function readTokens(): IssuedToken[] {
  try {
    const raw = localStorage.getItem(ISSUED_TOKENS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IssuedToken[];
      return parsed.map((t) => ({
        ...t,
        type: t.type ?? "custom",
        deployer: t.deployer ?? "",
        chainId: t.chainId ?? 56,
        txHash: t.txHash ?? "",
        createdAt: t.createdAt ?? Date.now(),
      }));
    }
  } catch {}
  return [];
}
