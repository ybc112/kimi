import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { TodayStats, ActivityItem, TrendingItem } from "@/types";

const STATS_KEY = "kimi-today-stats";
const ACTIVITIES_KEY = "kimi-activities";
const TRENDING_KEY = "kimi-trending";

/**
 * 统一管理合约/平台数据的 hook。
 * 当前基于 localStorage + mock 数据，后续可无缝替换为 ethers 合约调用或后端 API。
 */
export function useContractData() {
  const [stats, setStats] = useState<TodayStats>(() => readStats());
  const [activities, setActivities] = useState<ActivityItem[]>(() => readActivities());
  const [trending, setTrending] = useState<TrendingItem[]>(() => readTrending());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities.slice(0, 50)));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem(TRENDING_KEY, JSON.stringify(trending));
  }, [trending]);

  /** 触发一次模拟刷新，后续替换为真实 API / 合约事件 */
  const refreshTrending = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const next = generateMockTrending();
    setTrending(next);
    setLoading(false);
  };

  const recordGenerate = () => {
    setStats((s) => ({ ...s, generated: s.generated + 1, savedHours: s.savedHours + 1 }));
    pushActivity(setActivities, `生成了新的 Vault 合约`, "generate");
  };

  const recordDeploy = (name: string) => {
    setStats((s) => ({ ...s, deployed: s.deployed + 1, savedHours: s.savedHours + 2 }));
    pushActivity(setActivities, `部署了代币 ${name}`, "deploy");
  };

  const recordLaunch = (name: string) => {
    setStats((s) => ({ ...s, deployed: s.deployed + 1 }));
    pushActivity(setActivities, `完成了一键发币 ${name}`, "launch");
  };

  const recordPage = () => {
    pushActivity(setActivities, `AI 页面生成器生成了新页面`, "page");
  };

  return {
    stats,
    activities,
    trending,
    loading,
    refreshTrending,
    recordGenerate,
    recordDeploy,
    recordLaunch,
    recordPage,
  };
}

function readStats(): TodayStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { generated: 0, deployed: 0, savedHours: 0 };
}

function readActivities(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function readTrending(): TrendingItem[] {
  try {
    const raw = localStorage.getItem(TRENDING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function pushActivity(
  setter: Dispatch<SetStateAction<ActivityItem[]>>,
  text: string,
  type: ActivityItem["type"]
) {
  setter((prev) => [
    { id: crypto.randomUUID(), text, time: Date.now(), type },
    ...prev,
  ].slice(0, 50));
}

function generateMockTrending(): TrendingItem[] {
  const names = [
    ["Flap Genesis Vault", "FGV"],
    ["PandaSwap Buyback", "PANDA"],
    ["MoonBeam Dividend", "MBD"],
    ["Satoshi Meme", "SATO"],
    ["Aurora Treasury", "AURA"],
    ["Nova Liquidity", "NOVA"],
    ["Quantum AI Oracle", "QAO"],
    ["Pepe Vault V2", "PEPEV2"],
    ["DragonStake Pool", "DRAGON"],
    ["CyberBond Factory", "CYBER"],
  ];
  return names.map(([name, symbol], i) => {
    const base = 0.0001 + Math.random() * 0.01;
    const change = (Math.random() * 40 - 10).toFixed(2);
    const sparkline = Array.from({ length: 10 }, () => Math.floor(Math.random() * 60 + 30));
    return {
      rank: i + 1,
      name,
      symbol,
      address: i === 0 ? "0x9aa9cadec931c58c2a22bbc5381b266d12887777" : randomAddress(),
      price: `$${base.toFixed(6)}`,
      change24h: `${Number(change) >= 0 ? "+" : ""}${change}%`,
      volume24h: `$${(Math.random() * 900 + 10).toFixed(1)}k`,
      marketCap: `$${(Math.random() * 5 + 0.5).toFixed(2)}m`,
      hotScore: Math.floor(1000 - i * 80 + Math.random() * 50),
      sparkline,
    };
  });
}

function randomAddress() {
  return "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
