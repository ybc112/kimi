import { useEffect, useState } from "react";
import type { IssuedToken, TokenStatus, TokenType } from "@/types";
import { compactImageUrl, safeGetItem, safeSetItem } from "@/lib/storage";

const ISSUED_TOKENS_KEY = "kimi-issued-tokens";
const MAX_PERSISTED_TOKENS = 30;

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
    persistTokens(tokens);
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
    const raw = safeGetItem(ISSUED_TOKENS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IssuedToken[];
      return Array.isArray(parsed) ? parsed.map((t) => ({
        ...t,
        type: t.type ?? "custom",
        deployer: t.deployer ?? "",
        chainId: t.chainId ?? 56,
        txHash: t.txHash ?? "",
        createdAt: t.createdAt ?? Date.now(),
      })) : [];
    }
  } catch {
    // 忽略损坏的本地缓存并回退到空列表。
  }
  return [];
}

function persistTokens(tokens: IssuedToken[]) {
  // AI 头像通常是几百 KB 的 base64 PNG，不能直接把它们无限累积到
  // localStorage。当前页面仍保留完整 React 状态，缓存只保存小缩略图/远程 URL。
  const compact = tokens.slice(0, MAX_PERSISTED_TOKENS).map((token) => {
    const imageUrl = compactImageUrl(token.imageUrl, 32_000);
    if (imageUrl) return { ...token, imageUrl };
    const metadata = { ...token };
    delete metadata.imageUrl;
    return metadata;
  });

  try {
    const persisted = safeSetItem(ISSUED_TOKENS_KEY, JSON.stringify(compact));
    if (!persisted) {
      const metadataOnly = compact.map((token) => {
        const metadata = { ...token };
        delete metadata.imageUrl;
        return metadata;
      });
      safeSetItem(ISSUED_TOKENS_KEY, JSON.stringify(metadataOnly));
    }
  } catch {
    // safeSetItem already falls back to memory; this guard protects against
    // unusual JSON/Proxy values without interrupting the launch result.
  }
}
