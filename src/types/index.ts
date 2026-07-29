export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  type: "info" | "error" | "success";
  message: string;
  detail?: string;
  timestamp: number;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  temperature?: number;
}

export interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

/** 已发代币真实数据结构（为接合约预留） */
export type TokenStatus = "pending" | "success" | "failed";
export type TokenType = "snowball" | "flap" | "meme" | "custom";

export interface IssuedToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  deployer: string;
  network: string;
  chainId: number;
  txHash: string;
  createdAt: number;
  status: TokenStatus;
  totalSupply?: string;
  type: TokenType;
  imageUrl?: string;
  tradingOpen?: boolean;
  pairAddress?: string;
  liquidityTxHash?: string;
  openTradingTxHash?: string;
}

/** 热搜榜真实数据结构 */
export interface TrendingItem {
  rank: number;
  name: string;
  symbol: string;
  address: string;
  price: string;
  change24h: string;
  volume24h: string;
  marketCap: string;
  hotScore: number;
  sparkline: number[];
  tag?: string;
  url?: string;
  pairAddress?: string;
  liquidity?: string;
  txCount24h?: number;
  pairCreatedAt?: number;
  updatedAt?: number;
  isOfficial?: boolean;
  source?: "dexscreener" | "fallback";
}

/** 首页今日统计 */
export interface TodayStats {
  generated: number;
  deployed: number;
  savedHours: number;
}

/** 首页最近动态 */
export interface ActivityItem {
  id: string;
  text: string;
  time: number;
  type: "generate" | "deploy" | "launch" | "page" | "system";
}

export interface ToastState {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
}

/** 审计结果等级 */
export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

/** 单条审计发现 */
export interface AuditFinding {
  rule: string;
  severity: AuditSeverity;
  message: string;
  suggestion: string;
  line?: number;
}

/** Solidity 静态审计报告 */
export interface AuditReport {
  score: number;
  findings: AuditFinding[];
  passed: boolean;
  summary: string;
  checkedAt: number;
}

/** 代币安全评分维度 */
export interface TokenSafetyDimension {
  name: string;
  pass: boolean;
  score: number;
  message: string;
}

/** 代币安全 / Honeypot 检测报告 */
export interface TokenSafetyReport {
  address: string;
  score: number;
  isHoneypot: boolean | null;
  canSell: boolean | null;
  owner: string;
  ownerRenounced: boolean;
  hasMintFunction: boolean;
  hasBlacklist: boolean;
  hasWhitelist: boolean;
  taxChangeable: boolean | null;
  buyTaxBp: number | null;
  sellTaxBp: number | null;
  lpLockedOrBurned: boolean | null;
  dimensions: TokenSafetyDimension[];
  warnings: string[];
  checkedAt: number;
}
