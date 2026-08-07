// 排行榜索引器
//
// 为什么要有这个东西：排行榜积分原来是按「客户端上报通过了一关」累加的，能刷 ——
// 同一张门票可以反复 startSession（链上 run 还是 active），每个会话再报 10 关，
// 一天 50 个会话就是 500 分，成本只有一张 20000 门票。而第一名能拿 5% 奖池。
//
// 现在改成完全按链上事实计分：只统计合约发出的 RewardClaimed 事件。
// 每一次 RewardClaimed 背后必然有「真付了门票 + 真通了一整档 10 关 + 拿到后端签名」，
// 伪造不了，而且每一分都对应真金白银的门票支出。客户端上报再也影响不了排行榜。

import fs from "node:fs";
import path from "node:path";
import { id as topicId } from "ethers";

const REWARD_CLAIMED_TOPIC = topicId("RewardClaimed(address,uint256,uint256,uint32,uint256)");
const EPOCH_SECONDS = 86_400;

export function createLeaderboardIndex(options) {
  const {
    provider,
    vaultAddress,
    startBlock,
    storePath = "",
    pollMs = 60_000,
    chunkBlocks = 2_000,
    confirmations = 5,
    keepEpochs = 14,
  } = options;
  if (!provider || !vaultAddress) throw new Error("createLeaderboardIndex: provider / vaultAddress 必填");

  /** epoch -> Map(player -> score) */
  const epochs = new Map();
  let lastBlock = Number(startBlock) - 1;
  let timer = null;
  let scanning = false;
  const blockTsCache = new Map();

  function load() {
    if (!storePath || !fs.existsSync(storePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
      if (Number.isFinite(raw.lastBlock)) lastBlock = raw.lastBlock;
      for (const [epoch, entries] of Object.entries(raw.epochs || {})) {
        epochs.set(Number(epoch), new Map(Object.entries(entries)));
      }
      console.log(`[leaderboard] 已恢复索引：扫到区块 ${lastBlock}，${epochs.size} 个 epoch`);
    } catch (error) {
      console.error("[leaderboard] 索引文件损坏，从头重建:", error.message);
      lastBlock = Number(startBlock) - 1;
      epochs.clear();
    }
  }

  function persist() {
    if (!storePath) return;
    // 只留最近 keepEpochs 个 epoch
    for (const e of [...epochs.keys()].sort((a, b) => b - a).slice(keepEpochs)) epochs.delete(e);
    const out = { savedAt: new Date().toISOString(), lastBlock, epochs: {} };
    for (const [epoch, scores] of epochs) out.epochs[epoch] = Object.fromEntries(scores);
    try {
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      const tmp = `${storePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(out));
      fs.renameSync(tmp, storePath);
    } catch (error) {
      console.error("[leaderboard] 索引落盘失败:", error.message);
    }
  }

  async function blockTimestamp(blockNumber) {
    if (blockTsCache.has(blockNumber)) return blockTsCache.get(blockNumber);
    const b = await provider.getBlock(blockNumber);
    const ts = Number(b?.timestamp || 0);
    blockTsCache.set(blockNumber, ts);
    if (blockTsCache.size > 5_000) blockTsCache.clear();
    return ts;
  }

  function addScore(epoch, player, delta) {
    let scores = epochs.get(epoch);
    if (!scores) {
      scores = new Map();
      epochs.set(epoch, scores);
    }
    scores.set(player, (scores.get(player) || 0) + delta);
  }

  /** 扫一轮新区块，把 RewardClaimed 事件计入对应 epoch */
  async function scanOnce() {
    if (scanning) return { skipped: true };
    scanning = true;
    let added = 0;
    try {
      const head = await provider.getBlockNumber();
      const safeHead = head - confirmations; // 留几个确认，避免重组
      if (safeHead <= lastBlock) return { added: 0, lastBlock, head };

      let from = lastBlock + 1;
      while (from <= safeHead) {
        const to = Math.min(from + chunkBlocks - 1, safeHead);
        const logs = await provider.getLogs({
          address: vaultAddress,
          topics: [REWARD_CLAIMED_TOPIC],
          fromBlock: from,
          toBlock: to,
        });
        for (const log of logs) {
          // topics[1] 是 indexed player
          const player = "0x" + log.topics[1].slice(26);
          const ts = await blockTimestamp(log.blockNumber);
          if (!ts) continue;
          addScore(Math.floor(ts / EPOCH_SECONDS), player.toLowerCase(), 1);
          added += 1;
        }
        lastBlock = to;
        from = to + 1;
      }
      if (added > 0) console.log(`[leaderboard] 新增 ${added} 条通关记录，已扫到区块 ${lastBlock}`);
      persist();
      return { added, lastBlock, head };
    } catch (error) {
      console.error("[leaderboard] 扫链失败（下轮重试）:", error.shortMessage || error.message);
      return { error: error.message };
    } finally {
      scanning = false;
    }
  }

  /**
   * 取某个 epoch 的排名。
   * 排序：分数高的在前；同分则「先达成的」在前（用地址字典序做确定性 tiebreak，
   * 保证前后端、任何时候算出来的名次都一样）。
   */
  function getTop(epochId, limit = 10) {
    const scores = epochs.get(Number(epochId));
    if (!scores) return [];
    return [...scores.entries()]
      .map(([player, score]) => ({ player, score }))
      .sort((a, b) => (b.score - a.score) || (a.player < b.player ? -1 : 1))
      .slice(0, limit);
  }

  /** 某 epoch 第 rank 名（rank 从 1 开始），没有就返回 null */
  function getRankHolder(epochId, rank) {
    const top = getTop(epochId, 3);
    return top[Number(rank) - 1] || null;
  }

  function stats() {
    return {
      lastScannedBlock: lastBlock,
      epochsIndexed: epochs.size,
      storePath: storePath || "(未开启落盘)",
      source: "链上 RewardClaimed 事件（客户端无法伪造）",
    };
  }

  function start() {
    if (timer) return;
    void scanOnce();
    timer = setInterval(() => void scanOnce(), pollMs);
    if (timer.unref) timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    persist();
  }

  load();
  return { scanOnce, getTop, getRankHolder, stats, start, stop, persist };
}
