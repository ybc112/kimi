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

const networks = [
  { value: "bsc", label: "BNB Smart Chain", icon: "🔶", chainId: 56 },
  { value: "eth", label: "Ethereum", icon: "💠", chainId: 1 },
  { value: "arb", label: "Arbitrum One", icon: "🔵", chainId: 42161 },
  { value: "base", label: "Base", icon: "🛡️", chainId: 8453 },
  { value: "robinhood", label: "Robinhood Chain", icon: "🟢", chainId: 138, badge: "new" },
];

const DEPLOY_MODES = [
  { value: "manual", label: "手动部署", icon: Code2, desc: "使用 Bytecode + ABI 直接上链" },
  { value: "factory", label: "工厂部署", icon: Factory, desc: "通过工厂合约统一部署" },
] as const;

type DeployMode = (typeof DEPLOY_MODES)[number]["value"];

const BURN_AMOUNT = "100,000";

const deploySteps = [
  { title: "编写或导入合约", desc: "在左侧编辑器粘贴 Solidity 源码，或从金库生成页面导入。" },
  { title: "选择目标网络", desc: "点击网络标签切换 BNB Smart Chain / Ethereum / Arbitrum / Base / Robinhood Chain。" },
  { title: "确认销毁费用", desc: "部署需要销毁 100,000 KIMI，销毁后不可撤销，请确认余额充足。" },
  { title: "编译并部署", desc: "编译通过后连接钱包，点击一键部署将合约发布到链上。" },
];

export default function Deploy() {
  const { addLog, showToast, addIssuedToken } = useAppStore();
  const wallet = useWallet();

  const [code, setCode] = useState("");
  const [bytecode, setBytecode] = useState("");
  const [abi, setAbi] = useState("");
  const [constructorArgs, setConstructorArgs] = useState("");
  const [network, setNetwork] = useState("bsc");
  const [mode, setMode] = useState<DeployMode>("manual");
  const [deployValue, setDeployValue] = useState("0");

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedField, setCopiedField] = useState<"address" | "tx" | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("flap-generated-code");
    if (saved) setCode(saved);
  }, []);

  const expectedChainId = CHAIN_IDS[network] ?? networks.find((n) => n.value === network)?.chainId;
  const isWrongNetwork = wallet.isConnected && wallet.chainId !== expectedChainId;

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
    a.download = "Contract.sol";
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

  const handleCompile = () => {
    addLog({ type: "info", message: "编译服务稍后接入", detail: "当前为占位功能，请使用 Remix / Hardhat 本地编译后粘贴 Bytecode 与 ABI" });
    setErrorMessage("");
    showToast({ type: "info", message: "编译服务稍后接入" });
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
      setErrorMessage(`当前网络不正确，请切换到 ${networks.find((n) => n.value === network)?.label}`);
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

      addIssuedToken({
        name: "Deployed Contract",
        symbol: "DEPLOY",
        address: result.address,
        network: networks.find((n) => n.value === network)?.label || "BNB Smart Chain",
        status: "active",
        txHash: result.deployTxHash,
        type: "vault",
        source: "deploy",
      });

      addLog({
        type: "success",
        message: `合约已部署到 ${network}: ${result.address}`,
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

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      {/* Title header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#23262A] bg-[#15171A] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">合约部署</h2>
            <span className="rounded border border-[#D0FF00]/30 bg-[#D0FF00]/10 px-2 py-0.5 text-xs font-medium text-[#D0FF00]">
              DEPLOY · ON-CHAIN
            </span>
          </div>
          <p className="text-sm text-[#84888C]">
            连接钱包，选择网络，销毁 KIMI 部署费后将合约真实部署到目标链
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#23262A] bg-[#0B0D0E] px-3 py-2 text-xs text-[#9CA3AF]">
            <Wallet className="h-4 w-4" />
            {wallet.isConnected ? (
              <span className={wallet.isBSC ? "text-[#D0FF00]" : "text-white"}>
                {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
              </span>
            ) : (
              <span>未连接</span>
            )}
          </div>
          {isWrongNetwork && (
            <button
              onClick={() => wallet.switchToBSC()}
              className="rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-2 text-xs font-medium text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20"
            >
              切到 {networks.find((n) => n.value === network)?.label}
            </button>
          )}
        </div>
      </div>

      {/* Main editor + burn card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: code editor */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col rounded-xl border border-[#23262A] bg-[#15171A] overflow-hidden">
            {/* Network tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-[#23262A] p-2">
              {networks.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNetwork(n.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    network === n.value
                      ? "border-[#D0FF00]/50 bg-[#D0FF00]/10 text-white"
                      : "border-transparent bg-[#0B0D0E] text-[#9CA3AF] hover:border-[#303236] hover:text-white"
                  )}
                >
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                  {n.badge && (
                    <span className="rounded bg-[#FF6B6B]/20 px-1 py-0.5 text-[10px] text-[#FF6B6B]">{n.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23262A] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <FileCode className="h-4 w-4 text-[#D0FF00]" />
                合约源码
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadLocal}
                  className="flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-2.5 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  从本地加载
                </button>
                <button
                  onClick={handleCopyCode}
                  disabled={!code}
                  className="flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-2.5 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:opacity-40"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                  复制
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!code}
                  className="flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-2.5 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
                <button
                  onClick={() => setCode("")}
                  className="text-xs text-[#84888C] transition-colors hover:text-white"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="relative min-h-[420px] flex-1 bg-[#0B0D0E]">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// 在此粘贴你的 Solidity 合约源码...\npragma solidity ^0.8.20;\n"
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
        </div>

        {/* Right: burn fee + deploy config */}
        <div className="flex flex-col gap-4">
          {/* Burn fee card */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B6B]/10">
                <Flame className="h-4 w-4 text-[#FF6B6B]" />
              </div>
              <h3 className="font-semibold text-white">销毁部署费</h3>
            </div>

            <div className="mb-4 rounded-lg border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4 text-center">
              <p className="text-xs text-[#84888C]">销毁数量</p>
              <p className="mt-1 text-3xl font-bold text-[#FF6B6B]">{BURN_AMOUNT} KIMI</p>
            </div>

            <div className="mb-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#84888C]">智能地址</span>
                <span className="font-mono text-white">0xD0FF...0001</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#84888C]">代币合约</span>
                <span className="font-mono text-white">0xKIMI...TOKEN</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#84888C]">目标网络</span>
                <span className="text-white">{networks.find((n) => n.value === network)?.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#84888C]">部署网络</span>
                <span className="text-[#D0FF00]">BNB Smart Chain</span>
              </div>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>警告：代币销毁是不可撤销的操作，请确认后再继续。</span>
            </div>

            <button
              onClick={handleBurnAndDeploy}
              disabled={status === "pending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B6B]/10 py-2.5 text-sm font-medium text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flame className="h-4 w-4" />
              )}
              {!wallet.isConnected ? "连接钱包并销毁部署" : isWrongNetwork ? "切换网络并部署" : "确认销毁并部署"}
            </button>
          </div>

          {/* Deploy config */}
          <div className="flex flex-col gap-4 rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-[#2EDEDB]" />
              部署配置
            </h3>

            {/* Mode */}
            <div className="space-y-2">
              {DEPLOY_MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      mode === m.value
                        ? "border-[#D0FF00]/50 bg-[#D0FF00]/10"
                        : "border-[#303236] bg-[#0B0D0E] hover:border-[#D0FF00]/30"
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4", mode === m.value ? "text-[#D0FF00]" : "text-[#9CA3AF]")} />
                    <div>
                      <div className={cn("text-sm font-medium", mode === m.value ? "text-white" : "text-[#9CA3AF]")}>
                        {m.label}
                      </div>
                      <div className="text-xs text-[#84888C]">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {mode === "factory" && DEPLOY_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000" && (
              <div className="rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mb-1 inline-block h-3.5 w-3.5" />
                工厂合约地址尚未配置，请部署后更新 src/lib/contracts/deployer.ts 中的 DEPLOY_FACTORY_ADDRESS
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">Bytecode</label>
                <textarea
                  value={bytecode}
                  onChange={(e) => setBytecode(e.target.value)}
                  placeholder="0x60806040..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-2.5 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">ABI（手动模式必填）</label>
                <textarea
                  value={abi}
                  onChange={(e) => setAbi(e.target.value)}
                  placeholder='[{"inputs":[],"name":"...","type":"constructor"}]'
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-2.5 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">构造函数参数</label>
                <input
                  type="text"
                  value={constructorArgs}
                  onChange={(e) => setConstructorArgs(e.target.value)}
                  placeholder='["MyToken", "MTK", 1000000]'
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] p-2.5 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">附带 ETH/BNB（可选）</label>
                <input
                  type="number"
                  value={deployValue}
                  onChange={(e) => setDeployValue(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] p-2.5 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
            </div>

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">{errorMessage}</span>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-2 rounded-lg border border-[#D0FF00]/30 bg-[#D0FF00]/10 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-[#D0FF00]">
                  <CheckCircle className="h-4 w-4" />
                  部署成功
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#84888C]">合约地址</span>
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
                  <span className="text-[#84888C]">交易哈希</span>
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
            )}

            <button
              onClick={handleDeploy}
              disabled={status === "pending" || (mode === "factory" && DEPLOY_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {status === "pending" ? "部署中..." : !wallet.isConnected ? "连接钱包" : isWrongNetwork ? "切换网络" : "一键部署"}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: deploy process */}
      <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-[#2EDEDB]" />
          <h3 className="text-sm font-semibold text-white">部署流程说明</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deploySteps.map((step, index) => (
            <div key={index} className="relative rounded-lg border border-[#23262A] bg-[#0B0D0E] p-4">
              <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#23262A] text-xs font-bold text-[#D0FF00]">
                {index + 1}
              </span>
              <h4 className="mb-1 text-sm font-medium text-white">{step.title}</h4>
              <p className="text-xs leading-relaxed text-[#84888C]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
