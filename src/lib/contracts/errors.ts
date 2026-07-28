export interface FriendlyContractError {
  summary: string;
  details: string;
}

type ErrorLike = {
  code?: string | number;
  shortMessage?: string;
  reason?: string;
  message?: string;
  info?: { error?: { code?: number; message?: string } };
};

function compact(value: string, maxLength = 2400) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

export function formatContractError(error: unknown, fallback = "交易执行失败"): FriendlyContractError {
  const value = (error ?? {}) as ErrorLike;
  const code = value.code ?? value.info?.error?.code;
  const raw = value.shortMessage || value.reason || value.info?.error?.message || value.message || String(error ?? fallback);
  const details = compact(value.message || raw || fallback);

  if (code === "ACTION_REJECTED" || code === 4001 || /user rejected|user denied/i.test(raw)) {
    return { summary: "你已取消钱包中的交易请求", details };
  }
  if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(raw)) {
    return { summary: "钱包原生币余额不足，无法支付交易金额或 Gas", details };
  }
  if (code === "UNCONFIGURED_NAME" || /unconfigured name/i.test(raw)) {
    return { summary: "交易参数中存在空地址，请检查接收地址和分红代币地址", details };
  }
  if (/InvalidFee/i.test(raw)) {
    return { summary: "链上创建费已经变化，请刷新费用后重试", details };
  }
  if (/InvalidInput/i.test(raw)) {
    return { summary: "KIMI 发币参数不符合合约限制，请检查总量、税率和名单", details };
  }
  if (/FeeTransferFailed/i.test(raw)) {
    return { summary: "KIMI 发币工厂无法转出创建费，请联系工厂管理员", details };
  }
  if (/Factory 运行时代码|发币工厂运行时代码|已核验源码|SnowballLaunchpad\.sol/i.test(raw)) {
    return { summary: "KIMI 发币工厂合约校验未通过，已阻止交易", details };
  }
  if (/missing revert data/i.test(raw) && /estimateGas/i.test(raw)) {
    return {
      summary: "交易预检失败：目标合约不支持当前方法，或字节码/构造参数不正确",
      details,
    };
  }
  if (/execution reverted/i.test(raw)) {
    return { summary: value.reason ? `合约拒绝交易：${value.reason}` : "合约拒绝了当前交易参数", details };
  }
  if (/network changed|chain/i.test(raw) && /wrong|unsupported|mismatch/i.test(raw)) {
    return { summary: "钱包网络与目标网络不一致", details };
  }

  return { summary: compact(raw || fallback, 240) || fallback, details };
}
