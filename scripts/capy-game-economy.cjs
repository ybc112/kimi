#!/usr/bin/env node
/**
 * 卡皮巴拉游戏生态 —— 经济模型测试脚本
 *
 * 规则（来自需求）：
 *   第 1 关            免费体验
 *   第 2~11 关   (tier 0)  门票 20000，连过 10 关奖励 40000
 *   第 12~21 关  (tier 1)  门票 20000，连过 10 关奖励 40000 + 门票×10% = 42000
 *   第 22~31 关  (tier 2)  门票 20000，连过 10 关奖励 40000 + 门票×20% = 44000
 *   以此类推     (tier n)  奖励 = 门票 × (2 + 0.1n)
 *   失败         门票 20000 沉淀进游戏池，不退
 *   复活         再付 20000
 *   道具         5000 枚，全部销毁（不进池）
 *
 * 用法:
 *   node scripts/capy-game-economy.cjs
 *   node scripts/capy-game-economy.cjs --q=0.9 --players=2000 --pool=10000000
 *   node scripts/capy-game-economy.cjs --revive=restart   # 复活模式：restart | continue
 *
 * 纯 Node，无依赖。
 */

"use strict";

const TOKEN = {
  address: "0x839578f40b9a79a3fe891dd96079f3083e6e7777",
  symbol: "卡皮巴拉",
  decimals: 18,
  totalSupply: 1_000_000_000,
};

const RULES = {
  freeLevels: 1, // 第 1 关免费
  levelsPerTier: 10,
  ticket: 20_000,
  baseRewardMultiple: 2, // 40000 = 门票 × 2
  tierBonusPerTier: 0.1, // 每上一个 tier，奖励多给门票的 10%
  tierBonusCap: Infinity, // 需求里没写上限 —— 这是个问题，见报告
  itemCost: 5_000, // 全部销毁
};

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(a);
    if (m) out[m[1]] = m[2] === "" ? true : m[2];
  }
  return out;
}
const ARGS = parseArgs(process.argv);
const num = (k, d) => (ARGS[k] === undefined ? d : Number(ARGS[k]));
const str = (k, d) => (ARGS[k] === undefined ? d : String(ARGS[k]));

// 允许从命令行覆盖规则数值，方便试不同方案
RULES.ticket = num("ticket", RULES.ticket);
RULES.baseRewardMultiple = num("rewardMultiple", RULES.baseRewardMultiple);
RULES.tierBonusPerTier = num("tierBonus", RULES.tierBonusPerTier);
RULES.tierBonusCap = num("bonusCap", RULES.tierBonusCap);
RULES.itemCost = num("itemCost", RULES.itemCost);
RULES.levelsPerTier = num("levelsPerTier", RULES.levelsPerTier);

// ───────────────────────── 规则实现 ─────────────────────────

/** 第 level 关属于哪个 tier（第 1 关免费，不属于任何 tier） */
function tierOfLevel(level) {
  if (level <= RULES.freeLevels) return -1;
  return Math.floor((level - RULES.freeLevels - 1) / RULES.levelsPerTier);
}

/** tier n 覆盖的关卡区间 */
function tierRange(n) {
  const from = RULES.freeLevels + 1 + n * RULES.levelsPerTier;
  return [from, from + RULES.levelsPerTier - 1];
}

/** tier n 的门票 */
function ticketOf(_n) {
  return RULES.ticket;
}

/** tier n 一次通关 10 关的奖励 */
function rewardOf(n) {
  const bonusRate = Math.min(n * RULES.tierBonusPerTier, RULES.tierBonusCap);
  return RULES.ticket * (RULES.baseRewardMultiple + bonusRate);
}

/** tier n 的盈亏平衡「连过 10 关成功率」：门票 / 奖励 */
function breakEvenClearRate(n) {
  return ticketOf(n) / rewardOf(n);
}

/** 由「连过 10 关成功率」反推单关通过率 */
function perLevelFromClear(p) {
  return Math.pow(p, 1 / RULES.levelsPerTier);
}

const fmt = (n, d = 0) =>
  Number(n).toLocaleString("zh-CN", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (x, d = 2) => (x * 100).toFixed(d) + "%";

// ───────────────── 第一部分：解析解（不用模拟就能算出来的）─────────────────

function reportBreakEven(maxTier) {
  console.log("\n" + "═".repeat(78));
  console.log("【一】各 tier 的盈亏平衡点（房子不赚不亏的临界通过率）");
  console.log("═".repeat(78));
  console.log(
    "tier  关卡区间      门票      奖励    奖励/门票  平衡:连过10关   平衡:单关" +
      "\n" + "─".repeat(78),
  );
  for (let n = 0; n <= maxTier; n++) {
    const [a, b] = tierRange(n);
    const t = ticketOf(n);
    const r = rewardOf(n);
    const p = breakEvenClearRate(n);
    const q = perLevelFromClear(p);
    console.log(
      `${String(n).padStart(3)}   ${String(a + "~" + b).padEnd(12)}` +
        `${fmt(t).padStart(7)}  ${fmt(r).padStart(8)}   ${(r / t).toFixed(2)}x   ` +
        `${pct(p).padStart(9)}     ${pct(q).padStart(8)}`,
    );
  }
  console.log("─".repeat(78));
  console.log("读法：玩家「连过 10 关」的实际成功率高于「平衡:连过10关」这一列，房子就开始亏。");
  console.log("      「平衡:单关」= 该临界值对应的单关通过率（假设每关独立同概率）。");
}

// ───────────────── 第二部分：蒙特卡洛模拟 ─────────────────

/**
 * 模拟一个玩家在某个 tier 的一次「完整闯关」直到成功或放弃。
 * reviveMode:
 *   "restart"  复活后从该 tier 第 1 关重新开始（等于重新买一张门票）
 *   "continue" 复活后从失败的那一关继续（保留已过关卡进度）
 * 返回 { ticketsPaid, itemsUsed, cleared }
 */
function playTier(tier, opt, rng) {
  const { q, reviveMode, maxRevives, itemUseRate, itemWinBoost } = opt;
  let ticketsPaid = 1; // 进场先买一张门票
  let itemsUsed = 0;
  let revives = 0;
  let progress = 0; // 已通过的关数

  while (true) {
    let winRate = q;
    if (itemUseRate > 0 && rng() < itemUseRate) {
      itemsUsed += 1;
      winRate = Math.min(1, q + itemWinBoost);
    }
    if (rng() < winRate) {
      progress += 1;
      if (progress >= RULES.levelsPerTier) return { ticketsPaid, itemsUsed, cleared: true };
    } else {
      if (revives >= maxRevives) return { ticketsPaid, itemsUsed, cleared: false };
      revives += 1;
      ticketsPaid += 1; // 复活再付一张门票
      if (reviveMode === "restart") progress = 0;
    }
  }
}

/** 可复现的伪随机数（mulberry32） */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 模拟整个生态：players 个玩家，每人从 tier 0 往上打，最多打 maxTiers 个 tier，
 * 或者钱包里的币花完 / 主动止盈为止。
 */
function simulate(opt) {
  const rng = makeRng(opt.seed);
  let pool = opt.pool; // 游戏池余额（门票沉淀进来，奖励从这里出）
  let burned = 0; // 道具销毁总量
  let poolMin = pool;
  let ruinedAt = null; // 池子第一次不够发奖的时刻
  let totalTickets = 0;
  let totalRewards = 0;
  let clears = 0;
  let runs = 0;
  const playerPnl = [];

  for (let i = 0; i < opt.players; i++) {
    let wallet = opt.playerWallet;
    let pnl = 0;
    for (let tier = 0; tier < opt.maxTiers; tier++) {
      const ticket = ticketOf(tier);
      const reward = rewardOf(tier);
      if (wallet < ticket) break; // 没钱进场了

      const r = playTier(tier, opt, rng);
      runs += 1;
      const paid = r.ticketsPaid * ticket;
      const burnedNow = r.itemsUsed * RULES.itemCost;
      if (wallet < paid + burnedNow) break; // 中途没钱复活/买道具，按放弃处理

      wallet -= paid + burnedNow;
      pnl -= paid + burnedNow;
      pool += paid; // 门票全部沉淀进池
      burned += burnedNow;
      totalTickets += paid;

      if (r.cleared) {
        if (pool < reward) {
          if (ruinedAt === null) ruinedAt = { player: i, tier, need: reward, have: pool };
          break; // 池子发不出奖，游戏事实上结束
        }
        pool -= reward;
        wallet += reward;
        pnl += reward;
        totalRewards += reward;
        clears += 1;
      } else {
        break; // 这一 tier 没过，本玩家结束（可改成继续重试同一 tier）
      }
      if (pool < poolMin) poolMin = pool;
    }
    playerPnl.push(pnl);
  }
  return { pool, poolMin, burned, ruinedAt, totalTickets, totalRewards, clears, runs, playerPnl };
}

// ───────────────── 第三部分：单关通过率扫描 ─────────────────

function reportSweep(baseOpt) {
  console.log("\n" + "═".repeat(78));
  console.log(`【二】单关通过率扫描（复活模式 = ${baseOpt.reviveMode}，每档 ${fmt(baseOpt.players)} 名玩家）`);
  console.log("═".repeat(78));
  console.log(
    "单关   连过10关   房子每局净收   池子期末余额    最低点     销毁     判定" +
      "\n" + "─".repeat(78),
  );
  for (const q of [0.7, 0.75, 0.8, 0.85, 0.88, 0.9, 0.909, 0.92, 0.933, 0.95, 0.97]) {
    const r = simulate({ ...baseOpt, q });
    const net = r.runs > 0 ? (r.totalTickets - r.totalRewards) / r.runs : 0;
    const clearRate = r.runs > 0 ? r.clears / r.runs : 0;
    const verdict = r.ruinedAt ? "❌ 池子被打穿" : net > 0 ? "✅ 房子赚" : "⚠️ 房子亏";
    console.log(
      `${pct(q, 1).padStart(5)}  ${pct(clearRate, 1).padStart(8)}  ` +
        `${fmt(net).padStart(12)}  ${fmt(r.pool).padStart(12)}  ${fmt(r.poolMin).padStart(10)}  ` +
        `${fmt(r.burned).padStart(9)}  ${verdict}`,
    );
  }
  console.log("─".repeat(78));
  console.log("「房子每局净收」= (收到的门票 − 发出的奖励) / 总局数，为负就是在亏。");
}

// ───────────────── 第四部分：单场景详细报告 ─────────────────

function reportDetail(opt) {
  const r = simulate(opt);
  const wins = r.playerPnl.filter((x) => x > 0).length;
  const avg = r.playerPnl.reduce((a, b) => a + b, 0) / (r.playerPnl.length || 1);
  console.log("\n" + "═".repeat(78));
  console.log("【三】指定场景详细结果");
  console.log("═".repeat(78));
  console.log(`  单关通过率        ${pct(opt.q, 1)}    复活模式 ${opt.reviveMode}（上限 ${opt.maxRevives} 次）`);
  console.log(`  玩家数            ${fmt(opt.players)}，每人初始 ${fmt(opt.playerWallet)} ${TOKEN.symbol}`);
  console.log(`  道具使用率        ${pct(opt.itemUseRate, 0)}，每次 +${pct(opt.itemWinBoost, 0)} 通过率，花费 ${fmt(RULES.itemCost)}`);
  console.log(`  游戏池初始        ${fmt(opt.pool)}`);
  console.log("  " + "─".repeat(74));
  console.log(`  总局数            ${fmt(r.runs)}，其中通关 ${fmt(r.clears)} 局（${pct(r.runs ? r.clears / r.runs : 0, 1)}）`);
  console.log(`  门票流入池子      ${fmt(r.totalTickets)}`);
  console.log(`  奖励流出池子      ${fmt(r.totalRewards)}`);
  console.log(`  池子净变化        ${fmt(r.totalTickets - r.totalRewards)}  → 期末 ${fmt(r.pool)}（最低到过 ${fmt(r.poolMin)}）`);
  console.log(`  道具销毁          ${fmt(r.burned)}（占总量 ${pct(r.burned / TOKEN.totalSupply, 4)}）`);
  console.log(`  玩家盈利人数      ${fmt(wins)} / ${fmt(r.playerPnl.length)}（${pct(r.playerPnl.length ? wins / r.playerPnl.length : 0, 1)}）`);
  console.log(`  玩家人均盈亏      ${fmt(avg)}`);
  if (r.ruinedAt) {
    console.log(`  ❌ 池子被打穿      第 ${r.ruinedAt.player} 名玩家在 tier ${r.ruinedAt.tier} 通关，` +
      `需发 ${fmt(r.ruinedAt.need)} 但池里只有 ${fmt(r.ruinedAt.have)}`);
  } else {
    console.log("  ✅ 池子全程有钱发奖");
  }
  return r;
}

// ───────────────── 第五部分：两种复活模式对照 ─────────────────

function reportCompare(baseOpt) {
  console.log("\n" + "═".repeat(78));
  console.log("【二b】两种复活规则对照（这一条会直接决定生死，必须先定下来）");
  console.log("═".repeat(78));
  console.log("           复活=continue（死哪关从哪关继续）        复活=restart（从本档第1关重来）");
  console.log("单关     通关率   每局净收   池子结果        通关率   每局净收   池子结果");
  console.log("─".repeat(78));
  const rows = [];
  for (const q of [0.8, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94]) {
    const line = [pct(q, 0).padStart(5)];
    const rec = { q };
    for (const mode of ["continue", "restart"]) {
      const r = simulate({ ...baseOpt, q, reviveMode: mode, itemUseRate: 0, itemWinBoost: 0 });
      const net = r.runs > 0 ? (r.totalTickets - r.totalRewards) / r.runs : 0;
      const cr = r.runs > 0 ? r.clears / r.runs : 0;
      rec[mode] = { net, cr, ruined: !!r.ruinedAt };
      line.push(
        `${pct(cr, 1).padStart(7)} ${fmt(net).padStart(10)}  ${(r.ruinedAt ? "❌打穿" : net > 0 ? "✅安全" : "⚠️亏").padEnd(8)}`,
      );
    }
    rows.push(rec);
    console.log(line.join(" "));
  }
  console.log("─".repeat(78));
  const be = (mode) => {
    let lo = null;
    for (const r of rows) if (r[mode].net > 0) lo = r.q;
    return lo;
  };
  console.log(`continue 模式：单关通过率高于约 ${pct((be("continue") ?? 0) + 0.02, 0)} 房子开始亏`);
  console.log(`restart  模式：单关通过率高于约 ${pct((be("restart") ?? 0) + 0.02, 0)} 房子开始亏`);
  console.log("→ 同一套数值，两种复活规则的安全边界差好几个百分点。规则文档必须写清楚。");
}

// ───────────────── 第六部分：设计风险自检 ─────────────────

function reportRisks() {
  console.log("\n" + "═".repeat(78));
  console.log("【四】规则本身的设计风险");
  console.log("═".repeat(78));

  // 1) tier 奖励无上限
  const t = RULES.ticket;
  const dangerous = [];
  for (let n = 0; n <= 200; n++) {
    if (breakEvenClearRate(n) <= 0.1) { dangerous.push(n); break; }
  }
  console.log("1) tier 奖励没有上限（需求里写「以此类推」）");
  console.log(`   tier 0 奖励 ${fmt(rewardOf(0))}（${(rewardOf(0)/t).toFixed(1)}x 门票），` +
    `tier 20 → ${fmt(rewardOf(20))}（${(rewardOf(20)/t).toFixed(1)}x），` +
    `tier 100 → ${fmt(rewardOf(100))}（${(rewardOf(100)/t).toFixed(1)}x）`);
  if (dangerous.length) {
    const n = dangerous[0];
    console.log(`   到 tier ${n} 时，只要连过 10 关的成功率超过 ${pct(breakEvenClearRate(n))} 房子就亏，` +
      `对应单关只要 ${pct(perLevelFromClear(breakEvenClearRate(n)))}`);
  }
  console.log("   → 必须给 tierBonusCap 设上限，或者让关卡难度随 tier 上升。");

  // 2) 道具烧掉不补池
  console.log("\n2) 道具费全部销毁，不进游戏池");
  console.log(`   道具收入对奖池零贡献，池子只能靠「玩家失败的门票」补充。`);
  console.log("   → 如果想让池子更稳，考虑道具费一部分进池、一部分销毁。");

  // 3) 池子需要多少初始资金
  console.log("\n3) 冷启动需要的初始奖池");
  for (const k of [10, 50, 100, 500]) {
    console.log(`   要能连续兜住 ${String(k).padStart(3)} 次 tier-0 通关，池子至少 ${fmt(k * rewardOf(0))} ${TOKEN.symbol}` +
      `（占总量 ${pct((k * rewardOf(0)) / TOKEN.totalSupply, 3)}）`);
  }

  // 4) 单关免费体验被刷
  console.log("\n4) 第 1 关免费");
  console.log("   免费关不收门票也不发奖，只要不给奖励就没有经济风险；但要防止用免费关刷链上交互量。");
}

// ───────────────── main ─────────────────

function main() {
  console.log("═".repeat(78));
  console.log("卡皮巴拉游戏生态 —— 经济模型测试");
  console.log("═".repeat(78));
  console.log(`代币  ${TOKEN.symbol}  ${TOKEN.address}`);
  console.log(`      decimals ${TOKEN.decimals}，总量 ${fmt(TOKEN.totalSupply)} 枚（普通 ERC20，无税、无开盘锁）`);
  console.log(`规则  第 1 关免费；每 ${RULES.levelsPerTier} 关一档，门票 ${fmt(RULES.ticket)}，` +
    `奖励 = 门票 × (${RULES.baseRewardMultiple} + ${RULES.tierBonusPerTier}×tier)；道具 ${fmt(RULES.itemCost)} 全销毁`);

  const opt = {
    q: num("q", 0.9),
    players: num("players", 5000),
    playerWallet: num("wallet", 500_000),
    pool: num("pool", 10_000_000),
    maxTiers: num("maxTiers", 30),
    maxRevives: num("maxRevives", 3),
    itemUseRate: num("itemUseRate", 0.2),
    itemWinBoost: num("itemWinBoost", 0.05),
    reviveMode: str("revive", "continue"),
    seed: num("seed", 42),
  };

  reportBreakEven(num("maxTier", 10));
  reportSweep({ ...opt, itemUseRate: 0, itemWinBoost: 0 });
  reportCompare({ ...opt, players: Math.min(opt.players, 3000), pool: 50_000_000 });
  reportDetail(opt);
  reportRisks();

  console.log("\n" + "═".repeat(78));
  console.log("提示：改参数试试");
  console.log("  --q=0.85            单关通过率");
  console.log("  --revive=restart    复活后从该档第 1 关重来（默认 continue：从死掉那关继续）");
  console.log("  --pool=5000000      初始奖池");
  console.log("  --players=20000     玩家数");
  console.log("═".repeat(78) + "\n");
}

main();
