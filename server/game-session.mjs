// 卡皮巴拉游戏：会话管理 + 领奖签名
//
// 设计目标：把「领奖签名」和两件可验证的事绑在一起
//   1) 链上真的存在该玩家、该档位的有效进场记录（门票付过了）
//   2) 服务端记录了逐关通过的过程（顺序连续、每关有最短用时）
//
// ⚠️ 诚实说明：关卡胜负仍然由客户端上报，本模块**不能**做到完全防作弊。
//    要真正防住，必须把游戏逻辑搬到服务端跑（服务端出题、校验操作回放）。
//    这里做的是把可利用面收窄，并配合合约里的「每人/全局每日领奖上限」把损失封顶。

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AbiCoder, getAddress, getBytes, keccak256 } from "ethers";

const DEFAULTS = {
  levelsPerTier: 10,
  minSecondsPerLevel: 15, // 每关最少花这么多秒。真人玩解谜关普遍 20~60 秒，
  // 设太低（比如 3 秒）等于把「脚本刷分」的吞吐放大 5~20 倍。
  minRunSeconds: 150, // 一整档 10 关最少要花这么久，防止分散在多个会话里绕过单关限制
  sessionTtlMs: 30 * 60 * 1000, // 会话 30 分钟过期
  signatureValidity: 600, // 签名 10 分钟有效
  maxSessionsPerPlayerPerDay: 50,

  // ───── 行为异常检测 ─────
  // 客户端上报胜负这件事没法从根上验证，但「脚本」和「真人」的行为分布差别很大：
  // 真人有输有赢、每关耗时忽长忽短；脚本几乎不输、每关卡在最小间隔上、抖动极小。
  // 下面这几个阈值就是抓这个差别的。
  suspicionMinSamples: 5, // 至少要有这么多局才开始判断
  suspicionPerfectRate: 0.95, // 近期完成率高于这个值（几乎从不失败）→ 可疑
  suspicionTimingCv: 0.15, // 每关耗时的变异系数低于这个值（机器般均匀）→ 可疑
  suspicionFastRatio: 1.5, // 中位耗时低于「最小间隔 × 这个倍数」→ 可疑
  statsWindow: 20, // 只看最近这么多局
};

export function createGameSessionService(options) {
  const cfg = { ...DEFAULTS, ...options };
  const { vault, vaultAddress, signerWallet, chainId } = cfg;
  if (!vault || !signerWallet || !vaultAddress) {
    throw new Error("createGameSessionService: vault / vaultAddress / signerWallet 必填");
  }

  /** sessionId -> session */
  const sessions = new Map();
  /** player -> sessionId */
  const activeByPlayer = new Map();
  /** player -> { day, count } */
  const dailyStarts = new Map();
  /** epochId -> Map(player -> score) */
  const epochScores = new Map();

  /** player -> { runs: [{cleared, gaps:[ms]}], flagged, flagReason } 行为画像 */
  const behavior = new Map();

  function profileOf(player) {
    let b = behavior.get(player);
    if (!b) {
      b = { runs: [], flagged: false, flagReason: "" };
      behavior.set(player, b);
    }
    return b;
  }

  /** 一局结束（通关或放弃）时把这局的行为特征记下来 */
  function recordRun(session) {
    const b = profileOf(session.player);
    b.runs.push({ cleared: session.cleared, gaps: session.gaps.slice() });
    if (b.runs.length > cfg.statsWindow) b.runs.shift();
  }

  const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  /**
   * 判断某个地址的行为像不像脚本。
   * 三个信号同时成立才判定，避免误伤运气好的高手：
   *   1) 近期几乎从不失败
   *   2) 每关耗时的抖动极小（变异系数很低）
   *   3) 中位耗时贴着服务端允许的最小间隔
   */
  function assessBehavior(player) {
    const b = profileOf(player);
    if (b.flagged) return b;
    const runs = b.runs;
    if (runs.length < cfg.suspicionMinSamples) return b;

    const completed = runs.filter((r) => r.cleared >= cfg.levelsPerTier).length;
    const perfectRate = completed / runs.length;

    const gaps = runs.flatMap((r) => r.gaps).filter((g) => g > 0);
    if (gaps.length < cfg.levelsPerTier) return b;
    const mean = gaps.reduce((a, c) => a + c, 0) / gaps.length;
    const variance = gaps.reduce((a, c) => a + (c - mean) ** 2, 0) / gaps.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const med = median(gaps);
    const floorMs = cfg.minSecondsPerLevel * 1000;

    const neverLoses = perfectRate >= cfg.suspicionPerfectRate;
    const tooUniform = cv <= cfg.suspicionTimingCv;
    const tooFast = med <= floorMs * cfg.suspicionFastRatio;

    if (neverLoses && tooUniform && tooFast) {
      b.flagged = true;
      b.flagReason =
        `近 ${runs.length} 局完成率 ${(perfectRate * 100).toFixed(0)}%、` +
        `每关耗时变异系数 ${cv.toFixed(3)}、中位 ${(med / 1000).toFixed(1)}s` +
        `（服务端下限 ${cfg.minSecondsPerLevel}s）—— 行为特征像脚本`;
      console.warn(`[game] 已标记可疑地址 ${player}：${b.flagReason}`);
    }
    return b;
  }

  // ───────── 排行榜积分落盘（epoch 是按天的，必须活过重启）─────────
  const storePath = cfg.storePath || "";
  const KEEP_EPOCHS = 7;
  let saveTimer = null;

  function loadStore() {
    if (!storePath || !fs.existsSync(storePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
      for (const [epoch, entries] of Object.entries(raw.epochScores || {})) {
        epochScores.set(Number(epoch), new Map(Object.entries(entries)));
      }
      for (const [player, rec] of Object.entries(raw.dailyStarts || {})) {
        dailyStarts.set(player, rec);
      }
      console.log(`[game] 已从 ${storePath} 恢复 ${epochScores.size} 个 epoch 的排行榜积分`);
    } catch (error) {
      console.error("[game] 排行榜积分文件读取失败，按空数据启动:", error.message);
    }
  }

  function persist() {
    if (!storePath) return;
    // 只保留最近 KEEP_EPOCHS 个 epoch，避免文件无限膨胀
    const epochs = [...epochScores.keys()].sort((a, b) => b - a);
    for (const e of epochs.slice(KEEP_EPOCHS)) epochScores.delete(e);

    const out = { savedAt: new Date().toISOString(), epochScores: {}, dailyStarts: {} };
    for (const [epoch, scores] of epochScores) out.epochScores[epoch] = Object.fromEntries(scores);
    for (const [player, rec] of dailyStarts) out.dailyStarts[player] = rec;
    try {
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      const tmp = `${storePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(out));
      fs.renameSync(tmp, storePath); // 原子替换，避免写一半被读到
    } catch (error) {
      console.error("[game] 排行榜积分落盘失败:", error.message);
    }
  }

  function scheduleSave() {
    if (!storePath || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, 3000);
    if (saveTimer.unref) saveTimer.unref();
  }

  loadStore();

  const now = () => Date.now();
  const today = () => Math.floor(now() / 86_400_000);

  function sweep() {
    const t = now();
    for (const [id, s] of sessions) {
      if (t - s.createdAt > cfg.sessionTtlMs) {
        sessions.delete(id);
        if (activeByPlayer.get(s.player) === id) activeByPlayer.delete(s.player);
      }
    }
  }

  async function readRun(player) {
    const run = await vault.runs(player);
    return {
      active: Boolean(run.active),
      tier: Number(run.tier),
      ticketsPaid: Number(run.ticketsPaid),
    };
  }

  function levelRange(tier) {
    const from = 2 + cfg.levelsPerTier * tier; // 第 1 关免费
    return { from, to: from + cfg.levelsPerTier - 1 };
  }

  /**
   * 用「链上最新区块时间」而不是服务器本地时间来算 deadline。
   * 服务器时钟一旦比链慢，本地时间算出来的 deadline 会被合约判成已过期。
   */
  async function chainNow() {
    const provider = cfg.provider || vault.runner?.provider;
    if (provider) {
      try {
        const block = await provider.getBlock("latest");
        if (block && block.timestamp) return Number(block.timestamp);
      } catch {
        /* 退回本地时间 */
      }
    }
    return Math.floor(now() / 1000);
  }

  /** 开始一局：必须链上已经进场（门票付过） */
  async function startSession(rawPlayer) {
    sweep();
    const player = getAddress(rawPlayer);

    const d = today();
    const rec = dailyStarts.get(player);
    if (rec && rec.day === d) {
      if (rec.count >= cfg.maxSessionsPerPlayerPerDay) {
        throw new Error("今日开局次数已达上限");
      }
      rec.count += 1;
    } else {
      dailyStarts.set(player, { day: d, count: 1 });
    }

    const b = profileOf(player);
    if (b.flagged) throw new Error(`该地址已被标记为异常，暂停发奖：${b.flagReason}`);

    const run = await readRun(player);
    if (!run.active) throw new Error("链上没有进行中的闯关，请先支付门票进场");

    // 上一局（如果有）的行为特征在这里归档
    const prevId = activeByPlayer.get(player);
    if (prevId) {
      const prevSession = sessions.get(prevId);
      if (prevSession) recordRun(prevSession);
    }

    const prev = activeByPlayer.get(player);
    if (prev) sessions.delete(prev);

    const id = randomUUID();
    const { from, to } = levelRange(run.tier);
    sessions.set(id, {
      id,
      player,
      tier: run.tier,
      entryTicketsPaid: run.ticketsPaid,
      cleared: 0,
      createdAt: now(),
      lastLevelAt: now(),
      gaps: [], // 每关实际用时（ms），用于行为分析
    });
    activeByPlayer.set(player, id);

    return {
      ok: true,
      sessionId: id,
      tier: run.tier,
      fromLevel: from,
      toLevel: to,
      levelsRequired: cfg.levelsPerTier,
    };
  }

  /** 上报通过一关：必须严格连续、每关有最短用时 */
  async function reportLevel(sessionId, level) {
    sweep();
    const s = sessions.get(String(sessionId || ""));
    if (!s) throw new Error("会话不存在或已过期，请重新开局");

    const run = await readRun(s.player);
    if (!run.active) throw new Error("链上闯关已结束");
    if (run.tier !== s.tier) throw new Error("链上档位与会话不一致");

    const { from } = levelRange(s.tier);
    const expected = from + s.cleared;
    if (Number(level) !== expected) {
      throw new Error(`关卡顺序不对，期望第 ${expected} 关`);
    }
    if (now() - s.lastLevelAt < cfg.minSecondsPerLevel * 1000) {
      throw new Error("通关速度异常，请稍后重试");
    }
    if (s.cleared >= cfg.levelsPerTier) throw new Error("本档已经通关，请直接领奖");

    s.gaps.push(now() - s.lastLevelAt);
    s.cleared += 1;
    s.lastLevelAt = now();

    // 注意：这里【不】累加排行榜积分。
    // 排行榜完全由 leaderboard-index.mjs 按链上 RewardClaimed 事件统计，
    // 客户端上报影响不了名次（否则同一张门票反复开会话就能刷分）。

    return { ok: true, cleared: s.cleared, remaining: cfg.levelsPerTier - s.cleared };
  }

  /** 领取排行榜奖励签名 */
  async function signLeaderboardReward(rawPlayer, epochId, rank) {
    sweep();
    const player = getAddress(rawPlayer);
    const r = Number(rank);
    if (r < 1 || r > 3) throw new Error("排行榜名次只能是 1/2/3");

    const currentEpoch = Number(await vault.currentEpoch());
    if (currentEpoch <= Number(epochId)) {
      throw new Error("当前 epoch 尚未结束，不能领取排行榜奖励");
    }

    // 名次完全来自链上 RewardClaimed 事件的索引，客户端上报影响不了
    if (!cfg.leaderboard) throw new Error("排行榜索引未启用");
    await cfg.leaderboard.scanOnce(); // 领奖前补扫一次，确保用的是最新数据
    const target = cfg.leaderboard.getRankHolder(Number(epochId), r);
    if (!target) throw new Error(`该 epoch 没有第 ${r} 名`);
    if (getAddress(target.player) !== player) {
      throw new Error(`你不是第 ${r} 名`);
    }

    const capBps = await vault.leaderboardRewardCap(r);
    const pool = await vault.poolBalance();
    const amount = (pool * BigInt(capBps)) / 10_000n;
    if (amount === 0n) throw new Error("奖池为空，无法发放排行榜奖励");

    const nonce = await vault.nonces(player);
    const deadline = (await chainNow()) + cfg.signatureValidity;

    // 必须和合约 leaderboardDigest() 完全一致
    const digest = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "uint256", "uint8", "uint256", "uint256", "uint256"],
        [chainId, vaultAddress, player, Number(epochId), r, amount, nonce, deadline],
      ),
    );
    const signature = await signerWallet.signMessage(getBytes(digest));

    return {
      ok: true,
      player,
      epochId: Number(epochId),
      rank: r,
      amount: amount.toString(),
      nonce: nonce.toString(),
      deadline,
      signature,
    };
  }

  function getLeaderboard(epochId) {
    if (!cfg.leaderboard) return [];
    return cfg.leaderboard.getTop(Number(epochId), 10);
  }

  /** 领奖签名：会话必须已通过全部 10 关，且链上进场记录仍然有效 */
  async function signReward(sessionId) {
    sweep();
    const s = sessions.get(String(sessionId || ""));
    if (!s) throw new Error("会话不存在或已过期");
    if (s.cleared < cfg.levelsPerTier) {
      throw new Error(`还没通关，已过 ${s.cleared} / ${cfg.levelsPerTier} 关`);
    }

    // 整档最短总时长：防止把 10 关拆到多个会话里绕过单关最小间隔
    const elapsedSec = (now() - s.createdAt) / 1000;
    if (elapsedSec < cfg.minRunSeconds) {
      throw new Error(
        `本档用时 ${elapsedSec.toFixed(0)} 秒，低于下限 ${cfg.minRunSeconds} 秒，请稍后再领`,
      );
    }

    // 行为检测：把这一局归档后重新评估，像脚本就拒签
    recordRun(s);
    const profile = assessBehavior(s.player);
    if (profile.flagged) {
      throw new Error(`该地址已被标记为异常，暂停发奖：${profile.flagReason}`);
    }

    const run = await readRun(s.player);
    if (!run.active) throw new Error("链上闯关已结束，无法领奖");
    if (run.tier !== s.tier) throw new Error("链上档位与会话不一致");

    const [reward, nonce] = await Promise.all([vault.rewardOf(s.tier), vault.nonces(s.player)]);
    const deadline = (await chainNow()) + cfg.signatureValidity;

    // 必须和合约 rewardDigest() 完全一致
    const digest = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256"],
        [chainId, vaultAddress, s.player, s.tier, reward, nonce, deadline],
      ),
    );
    const signature = await signerWallet.signMessage(getBytes(digest));

    // 一个会话只能换一次签名
    sessions.delete(s.id);
    if (activeByPlayer.get(s.player) === s.id) activeByPlayer.delete(s.player);

    return {
      ok: true,
      player: s.player,
      tier: s.tier,
      reward: reward.toString(),
      nonce: nonce.toString(),
      deadline,
      signature,
    };
  }

  function stats() {
    sweep();
    return {
      sessions: sessions.size,
      players: activeByPlayer.size,
      epochsTracked: epochScores.size,
      storePath: storePath || "(未开启落盘)",
      behaviorTracked: behavior.size,
      flagged: [...behavior.entries()]
        .filter(([, b]) => b.flagged)
        .map(([player, b]) => ({ player, reason: b.flagReason })),
      antiCheat: {
        minSecondsPerLevel: cfg.minSecondsPerLevel,
        minRunSeconds: cfg.minRunSeconds,
        maxSessionsPerPlayerPerDay: cfg.maxSessionsPerPlayerPerDay,
      },
    };
  }

  /** 进程退出前把积分刷盘 */
  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persist();
  }

  return {
    startSession,
    reportLevel,
    signReward,
    signLeaderboardReward,
    getLeaderboard,
    stats,
    flush,
    config: cfg,
  };
}
