import { useState, useEffect, type ChangeEvent } from "react";
import {
  Rocket,
  Wallet,
  ShieldCheck,
  FileCode,
  Copy,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Code2,
  Factory,
  Flame,
  Info,
  Layers,
  Check,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";
import {
  deployBytecode,
  deployViaFactory,
  burnKimiTokens,
  DEPLOY_BURN_AMOUNT,
  getExplorerUrl,
  parseConstructorArgs,
  encodeConstructorArgs,
  getKimiBalance,
  parseDeployValue,
  IS_DEPLOY_FACTORY_CONFIGURED,
  CHAIN_IDS,
} from "@/lib/contracts/deployer";
import { useAppStore } from "@/store";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";
import { formatContractError } from "@/lib/contracts/errors";
import { TransactionError } from "@/components/TransactionError";

const networks = [
  { value: "bsc", label: "BNB Smart Chain", icon: "🔶", chainId: 56 },
  { value: "eth", label: "Ethereum", icon: "💠", chainId: 1 },
  { value: "arb", label: "Arbitrum One", icon: "🔵", chainId: 42161 },
  { value: "base", label: "Base", icon: "🛡️", chainId: 8453 },
];

const DEPLOY_MODES = [
  { value: "manual", label: "手动部署", icon: Code2, desc: "使用 Bytecode + ABI 直接上链" },
  { value: "factory", label: "工厂部署", icon: Factory, desc: "通过工厂合约统一部署" },
] as const;

type DeployMode = (typeof DEPLOY_MODES)[number]["value"];

const BURN_AMOUNT = "20,000";

export default function Deploy() {
  const { addLog, showToast } = useAppStore();
  const wallet = useWallet();
  const { addToken } = useIssuedTokens();
  const { recordDeploy } = useContractData();

  const [code, setCode] = useState("");
  const [bytecode, setBytecode] = useState("");
  const [abi, setAbi] = useState("");
  const [constructorArgs, setConstructorArgs] = useState("");
  const [network, setNetwork] = useState("bsc");
  const [mode, setMode] = useState<DeployMode>("manual");
  const [deployValue, setDeployValue] = useState("0");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("DEPLOY");

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [feeWarning, setFeeWarning] = useState<{ summary: string; details: string } | null>(null);
  const [deployPhase, setDeployPhase] = useState<"preflight" | "deploy" | "fee">("preflight");
  const [copiedField, setCopiedField] = useState<"address" | "tx" | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    network: true,
    mode: true,
    bytecode: true,
    args: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("flap-generated-code");
    if (saved) setCode(saved);
  }, []);

  const expectedChainId = CHAIN_IDS[network] ?? networks.find((n) => n.value === network)?.chainId;
  const isWrongNetwork = wallet.isConnected && wallet.chainId !== expectedChainId;
  const networkLabel = networks.find((n) => n.value === network)?.label || "BNB Smart Chain";

  const copyText = async (text: string, field: "address" | "tx") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast({ type: "success", message: "已复制" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showToast({ type: "success", message: "代码已复制" });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownload = () => {
    if (!code) return;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tokenName || "Contract"}.sol`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ type: "success", message: "文件已下载" });
  };

  const handleLoadLocal = () => {
    const saved = localStorage.getItem("flap-generated-code");
    if (saved) {
      setCode(saved);
      showToast({ type: "success", message: "已从本地加载代码" });
    } else {
      showToast({ type: "info", message: "本地没有保存的代码" });
    }
  };

  const handleArtifactUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const artifact = JSON.parse(await file.text()) as {
        abi?: unknown[];
        bytecode?: string | { object?: string };
        contractName?: string;
      };
      const artifactBytecode =
        typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode?.object || "";
      if (!Array.isArray(artifact.abi) || !artifactBytecode) {
        throw new Error("Artifact 必须包含 abi 和 bytecode 字段");
      }
      setAbi(JSON.stringify(artifact.abi, null, 2));
      setBytecode(artifactBytecode.startsWith("0x") ? artifactBytecode : `0x${artifactBytecode}`);
      if (artifact.contractName) setTokenName(artifact.contractName);
      showToast({ type: "success", message: "Artifact 已导入，可进行部署预检" });
    } catch (error) {
      const friendly = formatContractError(error, "Artifact 导入失败");
      setErrorMessage(friendly.summary);
      setErrorDetails(friendly.details);
      setStatus("error");
    }
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runDeploy = async (chargeKimi: boolean) => {
    setErrorMessage("");
    setErrorDetails("");
    setFeeWarning(null);
    setTxHash("");
    setContractAddress("");

    setStatus("pending");
    setDeployPhase("preflight");

    try {
      const signer = wallet.signer;
      const account = wallet.account;
      if (!wallet.isConnected || !signer || !account) throw new Error("请先连接钱包");
      if (isWrongNetwork) throw new Error(`当前网络不正确，请切换到 ${networkLabel}`);
      if (mode === "factory" && !IS_DEPLOY_FACTORY_CONFIGURED) {
        throw new Error("通用部署工厂未配置，请使用钱包直接部署");
      }
      if (chargeKimi && network !== "bsc") throw new Error("KIMI 部署费目前只支持 BNB Smart Chain");

      const valueWei = parseDeployValue(deployValue);
      const parsedArgs = parseConstructorArgs(constructorArgs);
      let result: { address: string; deployTxHash: string };

      if (chargeKimi) {
        const kimiBalance = await getKimiBalance(signer, account);
        if (kimiBalance < DEPLOY_BURN_AMOUNT) throw new Error("KIMI 余额不足，需要至少 20,000 KIMI");
      }

      setDeployPhase("deploy");
      if (mode === "factory") {
        const encodedArgs = encodeConstructorArgs(abi, parsedArgs);
        result = await deployViaFactory({
          signer,
          bytecode,
          encodedArgs,
          constructorValue: valueWei,
        });
      } else {
        result = await deployBytecode({
          signer,
          bytecode,
          abi,
          constructorArgs: parsedArgs,
          value: valueWei,
        });
      }

      setContractAddress(result.address);
      setTxHash(result.deployTxHash);

      addToken({
        name: tokenName || "Deployed Contract",
        symbol: tokenSymbol || "DEPLOY",
        address: result.address,
        deployer: account,
        network: networkLabel,
        chainId: expectedChainId || 56,
        txHash: result.deployTxHash,
        status: "success",
        totalSupply: "-",
        type: "custom",
      });
      recordDeploy(tokenName || "Deployed Contract");

      addLog({
        type: "success",
        message: `合约已部署到 ${networkLabel}: ${result.address}`,
        detail: `tx: ${result.deployTxHash}`,
      });
      if (chargeKimi) {
        setDeployPhase("fee");
        try {
          const burnResult = await burnKimiTokens({ signer, amount: DEPLOY_BURN_AMOUNT });
          addLog({ type: "success", message: "KIMI 部署费销毁成功", detail: `tx: ${burnResult.txHash}` });
        } catch (feeError) {
          const friendly = formatContractError(feeError, "KIMI 部署费支付失败");
          setFeeWarning({
            summary: `合约已经部署，但 20,000 KIMI 费用未完成：${friendly.summary}`,
            details: friendly.details,
          });
          addLog({ type: "error", message: "合约已部署，但 KIMI 费用未完成", detail: friendly.details });
        }
      }

      setStatus("success");
      showToast({ type: "success", message: "合约部署成功" });
    } catch (err) {
      const friendly = formatContractError(err, "合约部署失败");
      setErrorMessage(friendly.summary);
      setErrorDetails(friendly.details);
      setStatus("error");
      addLog({
        type: "error",
        message: "合约部署失败",
        detail: friendly.details,
      });
      showToast({ type: "error", message: friendly.summary });
    }
  };

  const handleDeploy = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }
    if (isWrongNetwork) {
      if (expectedChainId) await wallet.switchNetwork(expectedChainId);
      return;
    }
    await runDeploy(false);
  };

  const handleBurnAndDeploy = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }
    if (isWrongNetwork) {
      if (expectedChainId) await wallet.switchNetwork(expectedChainId);
      return;
    }
    await runDeploy(true);
  };

  const Accordion = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] overflow-hidden">
      <button
        onClick={() => toggleGroup(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#1A1D21]"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Icon className="h-4 w-4 text-[#D0FF00]" />
          {title}
        </span>
        {openGroups[id] ? <ChevronUp className="h-4 w-4 text-[#9CA3AF]" /> : <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />}
      </button>
      {openGroups[id] && <div className="border-t border-[#25282C] p-4">{children}</div>}
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      {/* Title header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="kimi-page-title">合约部署</h2>
          <p className="kimi-page-subtitle">Contract Deploy · 连接钱包，选择网络，将合约部署到目标链</p>
        </div>
      </div>

      {/* Main: left 55% code/params, right 45% deploy info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 55% */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* Code editor */}
          <div className="flex flex-col rounded-2xl border border-[#25282C] bg-[#111215] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#25282C] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileCode className="h-4 w-4 text-[#2EDEDB]" />
                合约源码
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadLocal}
                  className="kimi-btn-secondary py-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  加载
                </button>
                <button
                  onClick={handleCopyCode}
                  disabled={!code}
                  className="kimi-btn-secondary py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                  复制
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!code}
                  className="kimi-btn-secondary py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
              </div>
            </div>

            <div className="relative min-h-[360px] flex-1 bg-[#0A0B0D]">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// 在此粘贴你的 Solidity 合约源码...&#10;pragma solidity ^0.8.20;&#10;"
                className="absolute inset-0 z-10 w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-white outline-none lg:p-5"
                spellCheck={false}
              />
              <div className="pointer-events-none absolute inset-0 overflow-auto p-4 lg:p-5">
                <SyntaxHighlighter
                  language="solidity"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    background: "transparent",
                  }}
                  PreTag="div"
                >
                  {code || " "}
                </SyntaxHighlighter>
              </div>
            </div>
          </div>

          {/* Deploy params accordion */}
          <div className="space-y-3">
            <Accordion id="network" title="目标网络" icon={Layers}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {networks.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNetwork(n.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-all",
                      network === n.value
                        ? "border-[#D0FF00]/50 bg-[#D0FF00]/10 text-[#D0FF00]"
                        : "border-[#25282C] bg-[#111215] text-[#9CA3AF] hover:border-[#D0FF00]/30 hover:text-white"
                    )}
                  >
                    <span>{n.icon}</span>
                    {n.label}
                  </button>
                ))}
              </div>
            </Accordion>

            <Accordion id="mode" title="部署方式" icon={ShieldCheck}>
              <div className="space-y-2">
                {DEPLOY_MODES.map((m) => {
                  const Icon = m.icon;
                  const disabled = m.value === "factory" && !IS_DEPLOY_FACTORY_CONFIGURED;
                  return (
                    <button
                      key={m.value}
                      onClick={() => !disabled && setMode(m.value)}
                      disabled={disabled}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
                        mode === m.value
                          ? "border-[#D0FF00]/50 bg-[#D0FF00]/10"
                          : "border-[#25282C] bg-[#111215] hover:border-[#D0FF00]/30"
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4", mode === m.value ? "text-[#D0FF00]" : "text-[#9CA3AF]")} />
                      <div>
                        <div className={cn("text-sm font-medium", mode === m.value ? "text-white" : "text-[#9CA3AF]")}>
                          {m.label}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          {disabled ? "未配置兼容 deploy(bytes,bytes) 的通用部署工厂" : m.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!IS_DEPLOY_FACTORY_CONFIGURED && (
                <div className="mt-3 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                  <AlertCircle className="mb-1 inline-block h-3.5 w-3.5" />
                  已禁用旧版错误工厂地址。需要工厂部署时，请配置真正兼容 ABI 的 VITE_DEPLOY_FACTORY_ADDRESS。
                </div>
              )}
            </Accordion>

            <Accordion id="bytecode" title="Bytecode / ABI" icon={Code2}>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#2EDEDB]/30 bg-[#2EDEDB]/10 px-3 py-2.5 text-xs font-medium text-[#2EDEDB] transition-colors hover:bg-[#2EDEDB]/15">
                  <Upload className="h-3.5 w-3.5" />
                  导入 Hardhat / Foundry Artifact JSON
                  <input type="file" accept="application/json,.json" onChange={handleArtifactUpload} className="sr-only" />
                </label>
                <p className="text-[11px] leading-relaxed text-[#6B7280]">
                  Solidity 源码不能直接上链。请导入编译 Artifact，或手动填写 creation Bytecode 与 ABI。
                </p>
                <div>
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">Bytecode</label>
                  <textarea
                    value={bytecode}
                    onChange={(e) => setBytecode(e.target.value)}
                    placeholder="0x60806040..."
                    rows={3}
                    className="kimi-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">ABI（用于校验和编码构造参数）</label>
                  <textarea
                    value={abi}
                    onChange={(e) => setAbi(e.target.value)}
                    placeholder='[{"inputs":[],"name":"...","type":"constructor"}]'
                    rows={3}
                    className="kimi-input font-mono text-xs"
                  />
                </div>
              </div>
            </Accordion>

            <Accordion id="args" title="构造参数 / 代币信息" icon={Layers}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币名称</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="Deployed Contract"
                      className="kimi-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币符号</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder="DEPLOY"
                      className="kimi-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">构造函数参数</label>
                  <input
                    type="text"
                    value={constructorArgs}
                    onChange={(e) => setConstructorArgs(e.target.value)}
                    placeholder='["MyToken", "MTK", 1000000]'
                    className="kimi-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">附带 ETH/BNB（可选）</label>
                  <input
                    type="number"
                    value={deployValue}
                    onChange={(e) => setDeployValue(e.target.value)}
                    placeholder="0"
                    className="kimi-input font-mono text-xs"
                  />
                </div>
              </div>
            </Accordion>
          </div>
        </div>

        {/* Right: 45% deploy info */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Wallet card */}
          <div className="kimi-card">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D0FF00]/10">
                <Wallet className="h-4 w-4 text-[#D0FF00]" />
              </div>
              <h3 className="font-semibold text-white">钱包状态</h3>
            </div>

            {!wallet.isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-[#9CA3AF]">连接钱包后即可查看余额并部署合约</p>
                <button
                  onClick={wallet.connectWallet}
                  disabled={wallet.loading}
                  className="kimi-btn-primary w-full"
                >
                  {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  连接钱包
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">地址</span>
                  <span className="font-mono text-sm text-white">
                    {wallet.account?.slice(0, 8)}...{wallet.account?.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">网络</span>
                  <span className="flex items-center gap-1.5 text-sm text-white">
                    <span className={cn("h-2 w-2 rounded-full", wallet.isBSC ? "bg-[#D0FF00]" : "bg-[#FF6B6B]")} />
                    {wallet.chainId === 56 ? "BNB Smart Chain" : wallet.chainId === 1 ? "Ethereum" : `Chain ${wallet.chainId}`}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">余额</span>
                  <span className="text-sm font-medium text-white">{Number(wallet.balance).toFixed(4)} BNB</span>
                </div>
                {isWrongNetwork && (
                  <button
                    onClick={() => expectedChainId && wallet.switchNetwork(expectedChainId)}
                    className="w-full rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-2.5 text-sm font-medium text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20"
                  >
                    切换到 {networkLabel}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Burn fee card */}
          <div className="kimi-card">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B6B]/10">
                <Flame className="h-4 w-4 text-[#FF6B6B]" />
              </div>
              <h3 className="font-semibold text-white">安全部署并支付 KIMI</h3>
            </div>

            <div className="mb-4 rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4 text-center">
              <p className="text-xs text-[#9CA3AF]">销毁数量</p>
              <p className="mt-1 text-3xl font-bold text-[#FF6B6B]">{BURN_AMOUNT} KIMI</p>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#D0FF00]/25 bg-[#D0FF00]/5 p-3 text-xs text-[#C7E879]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>系统会先校验 Bytecode、ABI、构造参数并完成部署，确认合约地址后才请求销毁 {BURN_AMOUNT} KIMI。</span>
            </div>
            {network !== "bsc" && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>KIMI 费用只支持 BNB Smart Chain；其他网络请使用下方的钱包直接部署。</span>
              </div>
            )}

            <button
              onClick={handleBurnAndDeploy}
              disabled={status === "pending" || network !== "bsc"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-3 text-sm font-semibold text-[#FF6B6B] transition-all hover:bg-[#FF6B6B]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {!wallet.isConnected
                ? "连接钱包并安全部署"
                : isWrongNetwork
                  ? "切换网络并部署"
                  : status === "pending"
                    ? deployPhase === "preflight"
                      ? "正在校验部署参数…"
                      : deployPhase === "fee"
                        ? "部署成功，正在支付 KIMI…"
                        : "正在部署合约…"
                    : "安全部署并支付 KIMI"}
            </button>
          </div>

          {/* Quick deploy card */}
          <div className="kimi-card">
            <div className="mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-[#2EDEDB]" />
              <h3 className="font-semibold text-white">快速部署</h3>
            </div>
            <p className="mb-4 text-xs text-[#9CA3AF]">不收取 KIMI 平台费，仍会执行 Bytecode、ABI、构造参数和 Gas 预检。</p>
            <button
              onClick={handleDeploy}
              disabled={status === "pending" || (mode === "factory" && !IS_DEPLOY_FACTORY_CONFIGURED)}
              className="kimi-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {status === "pending"
                ? deployPhase === "preflight"
                  ? "正在预检…"
                  : "部署中…"
                : !wallet.isConnected
                  ? "连接钱包"
                  : isWrongNetwork
                    ? "切换网络"
                    : "钱包直接部署"}
            </button>
          </div>

          {/* Status card */}
          {(status === "error" || status === "success") && (
            <div
              className={cn(
                "kimi-card",
                status === "success" ? "border-[#D0FF00]/30 bg-[#D0FF00]/5" : "border-[#FF6B6B]/30 bg-[#FF6B6B]/5"
              )}
            >
              {status === "success" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-[#D0FF00]">
                    <CheckCircle className="h-4 w-4" />
                    部署成功
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">合约地址</span>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[180px] truncate font-mono text-white sm:max-w-[280px]">{contractAddress}</code>
                        <button onClick={() => copyText(contractAddress, "address")} className="text-[#9CA3AF] hover:text-white">
                          {copiedField === "address" ? <CheckCircle className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={getExplorerUrl(network, `/address/${contractAddress}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9CA3AF] hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">交易哈希</span>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[180px] truncate font-mono text-white sm:max-w-[280px]">{txHash}</code>
                        <button onClick={() => copyText(txHash, "tx")} className="text-[#9CA3AF] hover:text-white">
                          {copiedField === "tx" ? <CheckCircle className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={getExplorerUrl(network, `/tx/${txHash}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9CA3AF] hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status === "error" && <TransactionError summary={errorMessage} details={errorDetails} />}
              {status === "success" && feeWarning && (
                <div className="mt-4">
                  <TransactionError summary={feeWarning.summary} details={feeWarning.details} />
                </div>
              )}
            </div>
          )}

          {/* Info tip */}
          <div className="rounded-xl border border-[#25282C] bg-[#111215] p-4">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-[#2EDEDB]" />
              <span className="text-sm font-medium text-white">部署流程</span>
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-[#9CA3AF]">
              <li>导入编译 Artifact，或填写 creation Bytecode + ABI</li>
              <li>选择目标网络并连接钱包</li>
              <li>系统先预检参数与 Gas，再请求钱包部署</li>
              <li>选择 KIMI 模式时，部署成功后才支付费用</li>
              <li>成功后可在「已发代币」查看</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
