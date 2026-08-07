// 卡皮巴拉游戏后端（独立进程）
//
// 为什么单独一个进程：和 kimi 发射台的后端完全隔离，重启互不影响，
// 端口、.env、pm2 进程名都独立，不会再出现抢 8787 那种事。
//
// 需要的环境变量（放 .env 或 pm2 env）：
//   GAME_BACKEND_PORT        监听端口，默认 8793
//   GAME_VAULT_ADDRESS       CapyGameVault 合约地址
//   GAME_SIGNER_PRIVATE_KEY  签名钱包私钥（必须是合约里 signer() 那个地址）
//   GAME_RPC_URL             BSC RPC
//   GAME_CHAIN_ID            默认 56
//   GAME_CORS_ORIGINS        允许的前端域名，逗号分隔
//   GAME_STORE_PATH          排行榜积分落盘路径，默认 work/game-scores.json
//   GAME_MIN_SECONDS_PER_LEVEL   每关最少用时（秒），默认 15
//   GAME_MIN_RUN_SECONDS         整档最少用时（秒），默认 150
//   GAME_SIG_VALIDITY / GAME_MAX_SESSIONS_PER_DAY
//   GAME_LOGS_RPC_URL            排行榜扫链用的 RPC（必须支持 eth_getLogs）

import "dotenv/config";

import { createServer } from "node:http";
import path from "node:path";
import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } from "ethers";
import { createGameSessionService } from "./game-session.mjs";
import { createLeaderboardIndex } from "./leaderboard-index.mjs";

const PORT = Number(process.env.GAME_BACKEND_PORT || 8793);
const CHAIN_ID = Number(process.env.GAME_CHAIN_ID || 56);
const RPC_URL = process.env.GAME_RPC_URL || process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
const VAULT = process.env.GAME_VAULT_ADDRESS || "";
const SIGNER_KEY = process.env.GAME_SIGNER_PRIVATE_KEY || "";
const STORE_PATH = path.resolve(
  process.env.GAME_STORE_PATH || path.join(process.cwd(), "work", "game-scores.json"),
);
const CORS_ORIGINS = String(
  process.env.GAME_CORS_ORIGINS || "https://www.kpblgame.com,https://kpblgame.com",
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RATE_WINDOW_MS = Number(process.env.GAME_RATE_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.GAME_RATE_LIMIT || 240);

if (!isAddress(VAULT)) throw new Error("缺少 GAME_VAULT_ADDRESS（CapyGameVault 合约地址）");
if (!SIGNER_KEY) throw new Error("缺少 GAME_SIGNER_PRIVATE_KEY（签名钱包私钥）");

const VAULT_ABI = [
  "function runs(address) view returns (uint32 tier, uint32 ticketsPaid, uint64 startedAt, bool active)",
  "function nextTier(address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function rewardOf(uint256) view returns (uint256)",
  "function poolBalance() view returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function leaderboardRewardCap(uint8) view returns (uint16)",
  "function signer() view returns (address)",
  "function paused() view returns (bool)",
];

const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const signerWallet = new Wallet(SIGNER_KEY);
const vaultAddress = getAddress(VAULT);
const vault = new Contract(vaultAddress, VAULT_ABI, provider);

// 排行榜：只认链上 RewardClaimed 事件，客户端上报刷不了分
// 注意：blastapi 之类的免费 RPC 直接拒绝 eth_getLogs，所以索引器单独用一个支持日志查询的 RPC
const LOGS_RPC_URL = process.env.GAME_LOGS_RPC_URL || "https://bsc.publicnode.com";
const logsProvider =
  LOGS_RPC_URL === RPC_URL ? provider : new JsonRpcProvider(LOGS_RPC_URL, CHAIN_ID, { staticNetwork: true });
const leaderboard = createLeaderboardIndex({
  provider: logsProvider,
  vaultAddress,
  startBlock: Number(process.env.GAME_START_BLOCK || 114454472),
  storePath: path.resolve(
    process.env.GAME_LEADERBOARD_STORE || path.join(process.cwd(), "work", "leaderboard-index.json"),
  ),
  pollMs: Number(process.env.GAME_LEADERBOARD_POLL_MS || 60_000),
  chunkBlocks: Number(process.env.GAME_LEADERBOARD_CHUNK || 2000),
  confirmations: Number(process.env.GAME_LEADERBOARD_CONFIRMATIONS || 5),
});

const gameSessions = createGameSessionService({
  vault,
  vaultAddress,
  signerWallet,
  chainId: CHAIN_ID,
  provider,
  storePath: STORE_PATH,
  leaderboard,
  minSecondsPerLevel: Number(process.env.GAME_MIN_SECONDS_PER_LEVEL || 15),
  minRunSeconds: Number(process.env.GAME_MIN_RUN_SECONDS || 150),
  signatureValidity: Number(process.env.GAME_SIG_VALIDITY || 600),
  maxSessionsPerPlayerPerDay: Number(process.env.GAME_MAX_SESSIONS_PER_DAY || 50),
});

// ───────────────── 工具 ─────────────────

const buckets = new Map();
function rateLimit(request) {
  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const nowMs = Date.now();
  const b = buckets.get(ip);
  if (!b || nowMs - b.start > RATE_WINDOW_MS) {
    buckets.set(ip, { start: nowMs, count: 1 });
    return;
  }
  b.count += 1;
  if (b.count > RATE_MAX) throw new Error("请求过于频繁，请稍后再试");
}

function setCors(request, response) {
  const origin = String(request.headers.origin || "");
  // 允许列表命中才回 origin；命中不了就不给 CORS 头，浏览器自然拦掉
  if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes("*")) {
    response.setHeader("Access-Control-Allow-Origin", CORS_ORIGINS.includes("*") ? "*" : origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

// ───────────────── 路由 ─────────────────

const server = createServer(async (request, response) => {
  try {
    setCors(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const p = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" && (p === "/health" || p === "/")) {
      const [signerOnChain, paused, pool, epoch] = await Promise.all([
        vault.signer().catch(() => "?"),
        vault.paused().catch(() => null),
        vault.poolBalance().catch(() => 0n),
        vault.currentEpoch().catch(() => 0n),
      ]);
      const signerMatches =
        String(signerOnChain).toLowerCase() === signerWallet.address.toLowerCase();
      sendJson(response, 200, {
        ok: true,
        service: "capy-game-backend",
        chainId: CHAIN_ID,
        vault: vaultAddress,
        signer: signerWallet.address,
        signerMatchesOnChain: signerMatches,
        paused,
        poolBalance: pool.toString(),
        currentEpoch: Number(epoch),
        corsOrigins: CORS_ORIGINS,
        ...gameSessions.stats(),
        leaderboard: leaderboard.stats(),
      });
      return;
    }

    if (request.method === "GET" && p === "/api/game/leaderboard") {
      const epoch = url.searchParams.get("epoch");
      const epochId = epoch ? Number(epoch) : Number(await vault.currentEpoch());
      sendJson(response, 200, { ok: true, epoch: epochId, top: gameSessions.getLeaderboard(epochId) });
      return;
    }

    if (request.method === "GET" && p === "/api/game/stats") {
      sendJson(response, 200, { ok: true, ...gameSessions.stats(), leaderboard: leaderboard.stats() });
      return;
    }

    if (request.method === "POST") {
      rateLimit(request);
      const body = await readBody(request);

      if (p === "/api/game/session/start") {
        const player = String(body.player || "");
        if (!isAddress(player)) return sendJson(response, 400, { error: "玩家地址不合法" });
        return sendJson(response, 200, await gameSessions.startSession(player));
      }

      if (p === "/api/game/session/level") {
        return sendJson(
          response,
          200,
          await gameSessions.reportLevel(body.sessionId, Number(body.level)),
        );
      }

      if (p === "/api/game/sign-reward") {
        return sendJson(response, 200, await gameSessions.signReward(body.sessionId));
      }

      if (p === "/api/game/leaderboard/claim") {
        const player = String(body.player || "");
        if (!isAddress(player)) return sendJson(response, 400, { error: "玩家地址不合法" });
        return sendJson(
          response,
          200,
          await gameSessions.signLeaderboardReward(player, Number(body.epochId), Number(body.rank)),
        );
      }
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, 400, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  console.log(`卡皮巴拉游戏后端启动，监听 :${PORT}`);
  console.log(`  合约      ${vaultAddress}`);
  console.log(`  签名地址  ${signerWallet.address}`);
  console.log(`  RPC       ${RPC_URL}`);
  console.log(`  日志 RPC  ${LOGS_RPC_URL}（排行榜扫链用，必须支持 eth_getLogs）`);
  console.log(`  积分落盘  ${STORE_PATH}`);
  console.log(`  允许来源  ${CORS_ORIGINS.join(", ")}`);
  leaderboard.start();
  console.log("  排行榜    只统计链上 RewardClaimed 事件，已开始扫链");
  // 启动自检：签名钱包必须和链上 signer() 一致，否则所有领奖都会 BadSignature
  vault
    .signer()
    .then((onChain) => {
      const ok = String(onChain).toLowerCase() === signerWallet.address.toLowerCase();
      console.log(
        ok
          ? "  ✅ 签名钱包与链上 signer() 一致"
          : `  ❌ 签名钱包不匹配！链上 signer() = ${onChain}，本地 = ${signerWallet.address}，领奖会全部失败`,
      );
    })
    .catch((e) => console.error("  ⚠️ 读取链上 signer() 失败：", e.shortMessage || e.message));
});

function shutdown(signal) {
  console.log(`收到 ${signal}，刷盘后退出`);
  try {
    leaderboard.stop();
    gameSessions.flush();
  } catch (error) {
    console.error("刷盘失败:", error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
// 定期刷盘，防止进程被 kill -9 丢积分
setInterval(() => gameSessions.flush(), 60_000).unref();
