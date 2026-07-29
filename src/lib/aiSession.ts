import { ethers } from "ethers";
import { supabase } from "./supabase";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type CachedAiSession = {
  token: string;
  expiresAt: number;
  wallet: string;
  origin: string;
};

type FunctionErrorDetails = {
  message: string;
  code: string;
  status: number;
};

let cachedSession: CachedAiSession | null = null;

function getEthereumProvider(): EthereumProvider {
  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!ethereum) throw new Error("请先安装并打开支持 BSC 的钱包");
  return ethereum;
}

function buildWalletAccessMessage(input: {
  origin: string;
  address: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    "Kimi AI 安全访问授权",
    `站点: ${input.origin}`,
    `钱包: ${input.address.toLowerCase()}`,
    `时间: ${input.timestamp}`,
    `随机码: ${input.nonce}`,
    "此签名不会发送交易，也不会扣除代币。",
  ].join("\n");
}

async function readFunctionError(error: unknown): Promise<FunctionErrorDetails> {
  const fallback = error instanceof Error ? error.message : String(error);
  const response = (error as { context?: unknown } | null)?.context;
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json() as { error?: unknown; code?: unknown };
      return {
        message: typeof payload.error === "string" ? payload.error : fallback,
        code: typeof payload.code === "string" ? payload.code : "",
        status: response.status,
      };
    } catch {
      return { message: fallback, code: "", status: response.status };
    }
  }
  return { message: fallback, code: "", status: 0 };
}

async function readConnectedAccount(ethereum: EthereumProvider, requestAccess: boolean): Promise<string> {
  let accounts = await ethereum.request({ method: "eth_accounts" }) as string[];
  if ((!Array.isArray(accounts) || !accounts[0]) && requestAccess) {
    accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
  }
  if (!Array.isArray(accounts) || !accounts[0] || !ethers.isAddress(accounts[0])) {
    throw new Error("AI 功能需要先连接钱包");
  }
  return ethers.getAddress(accounts[0]);
}

function clearAiSession() {
  cachedSession = null;
}

async function requestCaptcha(): Promise<{ question: string; token: string }> {
  const { data, error } = await supabase.functions.invoke("deepseek-chat", {
    body: {},
    headers: { "x-kimi-ai-action": "request-captcha" },
  });
  if (error) {
    const details = await readFunctionError(error);
    throw new Error(details.message || "验证码获取失败");
  }
  if (typeof data?.question !== "string" || typeof data?.token !== "string") {
    throw new Error("验证码返回格式无效");
  }
  return data as { question: string; token: string };
}

async function createAiSession(): Promise<CachedAiSession> {
  const ethereum = getEthereumProvider();
  const address = await readConnectedAccount(ethereum, true);

  // Human verification: simple math challenge.
  const { question, token: captchaToken } = await requestCaptcha();
  const captchaAnswer = window.prompt(`人机验证：${question}\n请输入答案（数字）`);
  if (!captchaAnswer || !/^\d{1,3}$/.test(captchaAnswer.trim())) {
    throw new Error("需要正确输入验证码才能继续使用 AI 功能");
  }

  const browserProvider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
  const signer = await browserProvider.getSigner(address);
  const origin = window.location.origin.toLowerCase();
  const timestamp = Date.now();
  const nonce = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${timestamp}-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`;
  const signature = await signer.signMessage(buildWalletAccessMessage({ origin, address, timestamp, nonce }));

  const { data, error } = await supabase.functions.invoke("deepseek-chat", {
    body: { address, origin, timestamp, nonce, signature, captchaToken, captchaAnswer: captchaAnswer.trim() },
    headers: { "x-kimi-ai-action": "create-session" },
  });
  if (error) {
    const details = await readFunctionError(error);
    throw new Error(details.message || "AI 安全会话创建失败");
  }
  if (
    typeof data?.session !== "string" ||
    typeof data?.expiresAt !== "number" ||
    typeof data?.wallet !== "string"
  ) {
    throw new Error("AI 安全会话返回格式无效");
  }

  cachedSession = {
    token: data.session,
    expiresAt: data.expiresAt,
    wallet: ethers.getAddress(data.wallet),
    origin,
  };
  return cachedSession;
}

async function getAiSession(forceRefresh = false): Promise<CachedAiSession> {
  const ethereum = getEthereumProvider();
  if (!forceRefresh && cachedSession) {
    const currentAccount = await readConnectedAccount(ethereum, false).catch(() => "");
    const stillValid = cachedSession.expiresAt > Math.floor(Date.now() / 1000) + 30;
    if (
      stillValid &&
      currentAccount &&
      currentAccount.toLowerCase() === cachedSession.wallet.toLowerCase() &&
      cachedSession.origin === window.location.origin.toLowerCase()
    ) {
      return cachedSession;
    }
  }
  clearAiSession();
  return createAiSession();
}

export async function invokeProtectedAiFunction<T>(
  functionName: "deepseek-chat" | "generate-image",
  body: Record<string, unknown>
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await getAiSession(attempt > 0);
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: { "x-kimi-ai-session": session.token },
    });
    if (!error) return data as T;

    const details = await readFunctionError(error);
    const shouldRefresh =
      attempt === 0 &&
      (details.status === 401 || details.code.startsWith("AI_SESSION"));
    if (shouldRefresh) {
      clearAiSession();
      continue;
    }
    throw new Error(details.message || `${functionName} 调用失败`);
  }
  throw new Error("AI 安全会话创建失败");
}
