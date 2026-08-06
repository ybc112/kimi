import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { TodayStats, ActivityItem, TrendingItem } from "@/types";
import { safeGetItem, safeSetItem } from "@/lib/storage";
import {
  createKimiK3Fallback,
  createOfficialKimiFallback,
  fetchKimiK3Trending,
  fetchOfficialKimiTrending,
  readCachedKimiK3,
  readCachedOfficialKimi,
} from "@/lib/trending";

const STATS_KEY = "kimi-today-stats";
const ACTIVITIES_KEY = "kimi-activities";
const TRENDING_KEY = "kimi-trending-v2";

/**
 * 统一管理合约/平台数据的 hook。
 * 当前基于 localStorage + mock 数据，后续可无缝替换为 ethers 合约调用或后端 API。
 */
export function useContractData() {
  const [stats, setStats] = useState<TodayStats>(() => readStats());
  const [activities, setActivities] = useState<ActivityItem[]>(() => readActivities());
  const [trending, setTrending] = useState<TrendingItem[]>(() => readTrending());
  const [loading, setLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  useEffect(() => {
    safeSetItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    safeSetItem(ACTIVITIES_KEY, JSON.stringify(activities.slice(0, 50)));
  }, [activities]);

  useEffect(() => {
    safeSetItem(TRENDING_KEY, JSON.stringify(trending));
  }, [trending]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    void Promise.all([
      fetchOfficialKimiTrending(controller.signal).catch((error: unknown) => {
        if (controller.signal.aborted) return null;
        throw new Error(error instanceof Error ? error.message : "官方 KIMI 行情暂时不可用");
      }),
      fetchKimiK3Trending(controller.signal).catch((error: unknown) => {
        if (controller.signal.aborted) return null;
        throw new Error(error instanceof Error ? error.message : "Kimi k3 行情暂时不可用");
      }),
    ])
      .then(([kimi, k3]) => {
        if (!active) return;
        setTrending([kimi, k3].filter((item): item is TrendingItem => item !== null));
        setTrendingError(null);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setTrending((current) => [
          readCachedOfficialKimi(current),
          readCachedKimiK3(current),
        ]);
        setTrendingError(error instanceof Error ? error.message : "热搜行情暂时不可用");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  /** 从 DexScreener 刷新官方 KIMI 与 Kimi k3 的实时行情。 */
  const refreshTrending = async () => {
    setLoading(true);
    setTrendingError(null);
    try {
      const [kimi, k3] = await Promise.all([
        fetchOfficialKimiTrending(),
        fetchKimiK3Trending(),
      ]);
      setTrending([kimi, k3]);
    } catch (error) {
      setTrending((current) => [
        readCachedOfficialKimi(current),
        readCachedKimiK3(current),
      ]);
      setTrendingError(error instanceof Error ? error.message : "热搜行情暂时不可用");
    } finally {
      setLoading(false);
    }
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
    trendingError,
    refreshTrending,
    recordGenerate,
    recordDeploy,
    recordLaunch,
    recordPage,
  };
}

function readStats(): TodayStats {
  try {
    const raw = safeGetItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 忽略损坏的本地缓存并回退到默认值。
  }
  return { generated: 0, deployed: 0, savedHours: 0 };
}

function readActivities(): ActivityItem[] {
  try {
    const raw = safeGetItem(ACTIVITIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 忽略损坏的本地缓存并回退到默认值。
  }
  return [];
}

function readTrending(): TrendingItem[] {
  try {
    const raw = safeGetItem(TRENDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return [readCachedOfficialKimi(parsed), readCachedKimiK3(parsed)];
    }
  } catch {
    // 忽略损坏的本地缓存并回退到默认值。
  }
  return [createOfficialKimiFallback(), createKimiK3Fallback()];
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
