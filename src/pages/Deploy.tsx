import { useState, useEffect } from "react";
import { ethers } from "ethers";
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
  DEPLOY_FACTORY_ADDRESS,
  getExplorerUrl,
  parseConstructorArgs,
  CHAIN_IDS,
} from "@/lib/contracts/deployer";
import { useAppStore } from "@/store";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";

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

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runDeploy = async () => {
    setErrorMessage("");
    setTxHash("");
    setContractAddress("");

    if (!wallet.isConnected || !wallet.signer) {
      setErrorMessage("请先连接钱包");
      return;
    }

    if (isWrongNetwork) {
      setErrorMessage(`当前网络不正确，请切换到 ${networkLabel}`);
      return;
    }

    if (mode === "manual") {
      if (!bytecode.trim() || !abi.trim()) {
        setErrorMessage("手动部署需要填写 Bytecode 和 ABI");
        return;
      }
      if (!bytecode.startsWith("0x")) {
        setErrorMessage("Bytecode 必须以 0x 开头");
        return;
      }
    }

    setStatus("pending");

    try {
      const valueWei = deployValue ? BigInt(Math.floor(Number(deployValue) * 1e18)) : 0n;
      let result: { address: string; deployTxHash: string };

      if (mode === "factory") {
        const argsBytes = constructorArgs.trim() ? new TextEncoder().encode(constructorArgs) : new Uint8Array();
        result = await deployViaFactory({
          signer: wallet.signer,
          bytecode: bytecode || "0x",
          args: ethers.hexlify(argsBytes),
          value: valueWei,
        });
      } else {
        result = await deployBytecode({
          signer: wallet.signer,
          bytecode,
          abi,
          constructorArgs: parseConstructorArgs(constructorArgs),
          value: valueWei,
        });
      }

      setContractAddress(result.address);
      setTxHash(result.deployTxHash);
      setStatus("success");

      addToken({
        name: tokenName || "Deployed Contract",
        symbol: tokenSymbol || "DEPLOY",
        address: result.address,
        deployer: wallet.account || "",
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
      showToast({ type: "success", message: "合约部署成功" });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMessage(detail);
      setStatus("error");
      addLog({
        type: "error",
        message: "合约部署失败",
        detail,
      });
      showToast({ type: "error", message: "部署失败" });
    }
  };

  const handleDeploy = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }
    if (isWrongNetwork) {
      await wallet.switchToBSC();
      return;
    }
    await runDeploy();
  };

  const handleBurnAndDeploy = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }
    if (isWrongNetwork) {
      await wallet.switchToBSC();
      return;
    }
    addLog({ type: "info", message: "开始销毁部署费并上链", detail: `销毁 ${BURN_AMOUNT} KIMI（概念）并调用部署流程` });
    await runDeploy();
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
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
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
                        <div className="text-xs text-[#6B7280]">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {mode === "factory" && DEPLOY_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000" && (
                <div className="mt-3 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                  <AlertCircle className="mb-1 inline-block h-3.5 w-3.5" />
                  工厂合约地址尚未配置，请部署后更新 src/lib/contracts/deployer.ts 中的 DEPLOY_FACTORY_ADDRESS
                </div>
              )}
            </Accordion>

            <Accordion id="bytecode" title="Bytecode / ABI" icon={Code2}>
              <div className="space-y-3">
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
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">ABI（手动模式必填）</label>
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
                    onClick={() => wallet.switchToBSC()}
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
              <h3 className="font-semibold text-white">销毁部署费</h3>
            </div>

            <div className="mb-4 rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4 text-center">
              <p className="text-xs text-[#9CA3AF]">销毁数量</p>
              <p className="mt-1 text-3xl font-bold text-[#FF6B6B]">{BURN_AMOUNT} KIMI</p>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>代币销毁是不可撤销的操作，请确认后再继续。</span>
            </div>

            <button
              onClick={handleBurnAndDeploy}
              disabled={status === "pending"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-3 text-sm font-semibold text-[#FF6B6B] transition-all hover:bg-[#FF6B6B]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {!wallet.isConnected ? "连接钱包并销毁部署" : isWrongNetwork ? "切换网络并部署" : "确认销毁并部署"}
            </button>
          </div>

          {/* Quick deploy card */}
          <div className="kimi-card">
            <div className="mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-[#2EDEDB]" />
              <h3 className="font-semibold text-white">快速部署</h3>
            </div>
            <p className="mb-4 text-xs text-[#9CA3AF]">跳过销毁费模拟，直接使用钱包部署到 {networkLabel}</p>
            <button
              onClick={handleDeploy}
              disabled={status === "pending" || (mode === "factory" && DEPLOY_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000")}
              className="kimi-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {status === "pending" ? "部署中..." : !wallet.isConnected ? "连接钱包" : isWrongNetwork ? "切换网络" : "一键部署"}
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
                        <code className="font-mono text-white">{contractAddress}</code>
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
                        <code className="font-mono text-white">{txHash}</code>
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

              {status === "error" && (
                <div className="flex items-start gap-2 text-sm text-[#FF6B6B]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-all">{errorMessage}</span>
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
              <li>粘贴 Solidity 源码或 Bytecode + ABI</li>
              <li>选择目标网络并连接钱包</li>
              <li>确认销毁费用后点击部署</li>
              <li>成功后可在「已发代币」查看</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
