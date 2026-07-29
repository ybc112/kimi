import type { AuditFinding, AuditReport } from "@/types";

export type AuditSeverity = AuditFinding["severity"];

const SEVERITY_WEIGHT: Record<AuditSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

const MAX_DEDUCTION = 100;

function finding(
  rule: string,
  severity: AuditSeverity,
  message: string,
  suggestion: string,
  line?: number
): AuditFinding {
  return { rule, severity, message, suggestion, line };
}

function normalizeCode(code: string): string {
  // Strip comments to reduce false positives.
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

function extractLineNumber(code: string, index: number): number | undefined {
  if (index < 0) return undefined;
  return code.slice(0, index).split("\n").length;
}

export function auditSolidityCode(rawCode: string): AuditReport {
  const findings: AuditFinding[] = [];
  const code = normalizeCode(rawCode);

  // 1. Reentrancy: external calls without nonReentrant.
  const externalCallPattern = /\b(call|send|transfer|delegatecall|staticcall)\s*\(/g;
  const externalCallCount = countMatches(code, externalCallPattern);
  const hasNonReentrant = /\bnonReentrant\b/i.test(code);
  const hasReentrancyGuardImport = /ReentrancyGuard/i.test(rawCode);
  if (externalCallCount > 0 && !(hasNonReentrant || hasReentrancyGuardImport)) {
    findings.push(
      finding(
        "重入攻击风险",
        "high",
        `检测到 ${externalCallCount} 处低级外部调用，但合约未使用 nonReentrant 修饰符或 ReentrancyGuard。`,
        "引入 OpenZeppelin ReentrancyGuard 并在任何发送 ETH 或外部调用的函数上添加 nonReentrant；遵循 checks-effects-interactions 模式。"
      )
    );
  }

  // 2. Division by zero.
  const divPattern = /\/\s*[^/\s]+/g;
  const divCount = countMatches(code, divPattern);
  const requireZeroChecks = countMatches(code, /require\s*\([^)]*\b!=\s*0\b/gi);
  if (divCount > 0 && requireZeroChecks < Math.max(1, divCount / 2)) {
    findings.push(
      finding(
        "除零风险",
        "medium",
        `检测到 ${divCount} 处除法，但零值检查不足。`,
        "在除法前通过 require 或 if 检查除数不为 0；对价格/比例计算使用乘法溢出保护。"
      )
    );
  }

  // 3. Tax basis points overflow / unreasonable tax.
  const hasTaxCheck =
    /totalTax\s*<=\s*\d{3,4}/i.test(code) ||
    /require\s*\(\s*[^(]*\+[^(]*<=\s*\d{3,4}/i.test(code);
  if (/tax|fee|bp/i.test(code) && !hasTaxCheck) {
    findings.push(
      finding(
        "税率溢出风险",
        "high",
        "检测到税率/手续费相关逻辑，但未看到显式的总税率上限检查。",
        "确保买入与卖出的总税率分别不超过 2500 basis points（25%），并在运行时校验。"
      )
    );
  }

  // 4. Excessive owner privileges.
  const ownerFunctions = [
    "mint",
    "burn",
    "setTax",
    "setFee",
    "setMaxTx",
    "setMaxWallet",
    "blacklist",
    "whitelist",
    "renounceOwnership",
    "transferOwnership",
    "setRouter",
    "setPair",
  ];
  const privilegedFunctionMatches = ownerFunctions.filter((fn) =>
    new RegExp(`\\b${fn}\\b`, "i").test(code)
  );
  const hasOnlyOwner = /onlyOwner/i.test(code);
  if (privilegedFunctionMatches.length > 0 && !hasOnlyOwner) {
    findings.push(
      finding(
        "权限控制缺失",
        "critical",
        `检测到敏感函数（${privilegedFunctionMatches.join("、")}），但未看到 onlyOwner 或类似访问控制。`,
        "为所有管理员函数添加 onlyOwner / onlyGuardian / role-based access control。"
      )
    );
  } else if (privilegedFunctionMatches.length >= 4 && hasOnlyOwner) {
    findings.push(
      finding(
        "Owner 权限过大",
        "medium",
        `Owner 拥有 ${privilegedFunctionMatches.length} 项敏感权限（${privilegedFunctionMatches.join("、")}），可能导致信任风险。`,
        "考虑放弃部分权限、使用多签钱包作为 Owner、或设置时间锁（Timelock）。"
      )
    );
  }

  // 5. Mint backdoor.
  const hasMint = /\bmint\s*\(/i.test(code);
  const hasOwnerCanMint = /function\s+mint\b[^;]*onlyOwner/i.test(code);
  if (hasOwnerCanMint) {
    findings.push(
      finding(
        "Owner 可增发代币",
        "high",
        "检测到 onlyOwner 修饰的 mint 函数，Owner 可无限增发。",
        "如非必要，移除 mint 函数；若需增发，使用 DAO + Timelock 控制。"
      )
    );
  } else if (hasMint) {
    findings.push(
      finding(
        "存在增发逻辑",
        "medium",
        "检测到 mint 函数，请确认其调用者权限与上限。",
        "限制 mint 调用者，设置硬上限，并在 UI 中向用户披露。"
      )
    );
  }

  // 6. Blacklist / whitelist traps.
  if (/blacklist|isBlacklisted/i.test(code)) {
    findings.push(
      finding(
        "黑名单机制",
        "medium",
        "检测到黑名单功能，Owner 可阻止特定地址卖出或转账。",
        "如必须保留，建议由多签/DAO 管理，并在项目文档中明确披露。"
      )
    );
  }
  if (/whitelist|isWhitelisted/i.test(code)) {
    findings.push(
      finding(
        "白名单机制",
        "low",
        "检测到白名单功能，可能影响普通用户交易。",
        "确认白名单仅在开盘前使用，开盘后及时关闭或移除。"
      )
    );
  }

  // 7. Self-destruct / delegatecall.
  if (/\bselfdestruct\b/i.test(code)) {
    const index = rawCode.toLowerCase().indexOf("selfdestruct");
    findings.push(
      finding(
        "自毁函数",
        "critical",
        "检测到 selfdestruct，合约可被强制销毁并转移余额。",
        "除非必要，移除 selfdestruct；若保留，需由多签或 DAO 控制。",
        extractLineNumber(rawCode, index)
      )
    );
  }
  if (/\bdelegatecall\b/i.test(code)) {
    findings.push(
      finding(
        "Delegatecall 风险",
        "high",
        "检测到 delegatecall，可能导致存储槽覆盖或代码被替换。",
        "确保 delegatecall 的目标地址可信且不可被任意用户指定；优先使用静态库。"
      )
    );
  }

  // 8. tx.origin.
  if (/\btx\.origin\b/i.test(code)) {
    findings.push(
      finding(
        "tx.origin 钓鱼风险",
        "high",
        "使用 tx.origin 做权限判断会被钓鱼合约绕过。",
        "所有权限检查应使用 msg.sender，而非 tx.origin。"
      )
    );
  }

  // 9. Block timestamp dependence.
  if (/\bblock\.timestamp\b/i.test(code)) {
    findings.push(
      finding(
        "区块时间依赖",
        "low",
        "检测到 block.timestamp 使用，矿工可在小范围内操控。",
        "避免将 block.timestamp 用于精确的时间或随机数判断；如用于时间锁需留足容差。"
      )
    );
  }

  // 10. Missing zero-address checks.
  const addressSetters = countMatches(code, /function\s+set[A-Z]\w+\s*\([^)]*address/i);
  const zeroChecks = countMatches(code, /require\s*\([^)]*\b(0x0|zero|ZeroAddress)\b/gi);
  if (addressSetters > 0 && zeroChecks < addressSetters) {
    findings.push(
      finding(
        "缺少零地址检查",
        "medium",
        `检测到 ${addressSetters} 个地址设置函数，但零地址检查不足。`,
        "在所有设置地址的函数开头添加 require(addr != address(0))。"
      )
    );
  }

  // 11. Unchecked low-level calls.
  const lowLevelCalls = countMatches(code, /\.call\s*\{[^}]*\}\s*\(/g);
  const callResultChecks = countMatches(code, /\(\s*bool\s+\w+\s*,\s*[^)]+\)\s*=\s*[^.]*\.call/gi);
  if (lowLevelCalls > 0 && callResultChecks < lowLevelCalls) {
    findings.push(
      finding(
        "未检查低级调用返回值",
        "high",
        `检测到 ${lowLevelCalls} 处 .call{{...}}()，但返回值检查不完整。`,
        "始终检查 call 返回的 bool 与 data；或使用 Address.sendValue / callWithValue。"
      )
    );
  }

  // 12. Floating pragma.
  if (/pragma\s+solidity\s+\^0\.\d+/i.test(code)) {
    findings.push(
      finding(
        "浮动编译版本",
        "low",
        "使用浮动 pragma（^x.y.z）可能导致不同编译器版本行为差异。",
        "生产合约建议使用固定版本，如 pragma solidity 0.8.24;"
      )
    );
  }

  // 13. receive / fallback without guards.
  if (/receive\s*\(\s*\)\s*external\s+payable/i.test(code) && !/nonReentrant/i.test(code)) {
    findings.push(
      finding(
        "receive() 缺少重入保护",
        "medium",
        "receive() 函数可直接接收 ETH，建议添加重入保护或限制来源。",
        "在 receive() 上添加 nonReentrant，或仅允许已知合约地址调用。"
      )
    );
  }

  // 14. Unbounded loops / external array writes.
  if (/for\s*\([^)]*\.length\s*\+\+/i.test(code) || /for\s*\([^)]*\.length\s*--/i.test(code)) {
    findings.push(
      finding(
        "无界循环风险",
        "medium",
        "检测到基于动态数组长度的循环，可能因 Gas 耗尽导致拒绝服务。",
        "限制单次处理数量，使用分页或拉取模式，避免在循环中写入存储。"
      )
    );
  }

  // 15. SafeMath not needed in 0.8+ but checked.
  if (/using\s+SafeMath/i.test(code) && /pragma\s+solidity\s+0\.8\./i.test(code)) {
    findings.push(
      finding(
        "冗余 SafeMath",
        "info",
        "Solidity 0.8+ 已内置溢出检查，使用 SafeMath 是冗余的。",
        "移除 SafeMath，使用原生算术以节省 Gas。"
      )
    );
  }

  // 16. Missing event emission on state changes.
  const stateChangingFunctions = countMatches(code, /function\s+set[A-Z]\w+\s*\([^)]*\)\s*(?:external|public)/gi);
  const eventEmissions = countMatches(code, /\bemit\s+\w+\s*\(/g);
  if (stateChangingFunctions > 0 && eventEmissions < stateChangingFunctions) {
    findings.push(
      finding(
        "状态变更缺少事件",
        "low",
        "关键状态变更函数可能未发射事件，不利于链上审计与前端监听。",
        "为所有修改状态的管理函数定义并发射对应事件。"
      )
    );
  }

  // 17. Hardcoded addresses / secrets.
  if (/0x[a-fA-F0-9]{40}/.test(code)) {
    findings.push(
      finding(
        "硬编码地址",
        "info",
        "合约中检测到硬编码地址，请确认其正确性。",
        "敏感地址建议通过构造函数或 setter 注入，并在部署时校验。"
      )
    );
  }

  // Calculate score.
  let deduction = 0;
  findings.forEach((f) => {
    deduction += SEVERITY_WEIGHT[f.severity];
  });
  deduction = Math.min(deduction, MAX_DEDUCTION);
  const score = Math.max(0, 100 - deduction);

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const passed = score >= 70 && criticalCount === 0 && highCount === 0;

  let summary: string;
  if (passed) {
    summary = `审计通过，得分 ${score}/100，未发现严重或高危问题。`;
  } else if (criticalCount > 0) {
    summary = `发现 ${criticalCount} 个严重问题，得分 ${score}/100，部署前必须修复。`;
  } else if (highCount > 0) {
    summary = `发现 ${highCount} 个高危问题，得分 ${score}/100，建议修复后再部署。`;
  } else {
    summary = `审计发现中低风险问题，得分 ${score}/100，可根据建议优化。`;
  }

  return {
    score,
    findings: findings.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]),
    passed,
    summary,
    checkedAt: Date.now(),
  };
}

export function severityColor(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return "text-[#FF6B6B]";
    case "high":
      return "text-[#FF8A8A]";
    case "medium":
      return "text-[#F59E0B]";
    case "low":
      return "text-[#2EDEDB]";
    case "info":
      return "text-[#9CA3AF]";
    default:
      return "text-[#9CA3AF]";
  }
}

export function severityBg(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-[#FF6B6B]/10 border-[#FF6B6B]/30";
    case "high":
      return "bg-[#FF8A8A]/10 border-[#FF8A8A]/30";
    case "medium":
      return "bg-[#F59E0B]/10 border-[#F59E0B]/30";
    case "low":
      return "bg-[#2EDEDB]/10 border-[#2EDEDB]/30";
    case "info":
      return "bg-[#111215] border-[#25282C]";
    default:
      return "bg-[#111215] border-[#25282C]";
  }
}
