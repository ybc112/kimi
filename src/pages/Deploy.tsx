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
} from "lucide-react";
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
  { value: "bsc", label: "BNB Smart Chain", icon: "🔶" },
  { value: "eth", label: "Ethereum", icon: "💠" },
  { value: "arb", label: "Arbitrum", icon: "🔵" },
  { value: "base", label: "Base", icon: "🛡️" },
];

const DEPLOY_MODES = [
  { value: "manual", label: "手动部署", icon: Code2, desc: "使用 Bytecode + ABI 直接上链" },
  { value: "factory", label: "工厂部署", icon: Factory, desc: "通过工厂合约统一部署" },
] as const;

type DeployMode = (typeof DEPLOY_MODES)[number]["value"];

export default function Deploy() {
  const { addLog } = useAppStore();
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

  useEffect(() => {
    const saved = localStorage.getItem("flap-generated-code");
    if (saved) setCode(saved);
  }, []);

  const expectedChainId = CHAIN_IDS[network];
  const isWrongNetwork = wallet.isConnected && wallet.chainId !== expectedChainId;

  const copyText = async (text: string, field: "address" | "tx") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDeploy = async () => {
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

      addLog({
        type: "success",
        message: `合约已部署到 ${network}: ${result.address}`,
        detail: `tx: ${result.deployTxHash}`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMessage(detail);
      setStatus("error");
      addLog({
        type: "error",
        message: "合约部署失败",
        detail,
      });
    }
  };

  const renderWalletCard = () => (
    <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
        <Wallet className="h-4 w-4 text-[#2EDEDB]" />
        钱包连接
      </h3>
      {!wallet.isConnected ? (
        <div className="space-y-3">
          <p className="text-xs text-[#84888C]">连接钱包后即可真实部署合约上链</p>
          <button
            onClick={wallet.connectWallet}
            disabled={wallet.loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            连接 MetaMask
          </button>
          {!wallet.hasMetaMask && <p className="text-xs text-red-400">请安装 MetaMask 插件</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#84888C]">已连接地址</span>
            <span className="font-mono text-xs text-white">
              {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#84888C]">当前网络</span>
            <span className={cn("text-xs", wallet.isBSC ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
              {wallet.chainId ? `Chain ID ${wallet.chainId}` : "--"}
            </span>
          </div>
          {isWrongNetwork && (
            <button
              onClick={() => wallet.switchToBSC()}
              className="w-full rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-2 text-xs font-medium text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20"
            >
              切换到 {networks.find((n) => n.value === network)?.label}
            </button>
          )}
          <button
            onClick={wallet.disconnectWallet}
            className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] py-2 text-xs text-[#9CA3AF] transition-colors hover:text-white"
          >
            断开连接
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
      <div>
        <h2 className="text-xl font-bold text-white">自定义部署合约</h2>
        <p className="text-xs text-[#84888C]">连接钱包，使用 Bytecode + ABI 或工厂合约真实部署上链</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:overflow-hidden">
        {/* Left: Parameters */}
        <div className="flex w-full flex-col gap-4 lg:w-[42%] lg:min-h-0 lg:overflow-auto">
          {renderWalletCard()}

          {/* Network */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Rocket className="h-4 w-4 text-[#D0FF00]" />
              部署网络
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {networks.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNetwork(n.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    network === n.value
                      ? "border-[#D0FF00]/50 bg-[#D0FF00]/10 text-white"
                      : "border-[#303236] bg-[#0B0D0E] text-[#9CA3AF] hover:border-[#D0FF00]/30"
                  )}
                >
                  <span>{n.icon}</span>
                  <span className="truncate">{n.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Deploy Mode */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-[#2EDEDB]" />
              部署方式
            </h3>
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
              <div className="mt-3 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mb-1 inline-block h-3.5 w-3.5" />
                工厂合约地址尚未配置，请部署后更新 src/lib/contracts/deployer.ts 中的 DEPLOY_FACTORY_ADDRESS
              </div>
            )}
          </div>

          {/* Bytecode / ABI / Args */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <FileCode className="h-4 w-4 text-[#D0FF00]" />
              部署参数
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">Bytecode</label>
                <textarea
                  value={bytecode}
                  onChange={(e) => setBytecode(e.target.value)}
                  placeholder="0x60806040..."
                  className="h-20 w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">ABI（手动模式必填）</label>
                <textarea
                  value={abi}
                  onChange={(e) => setAbi(e.target.value)}
                  placeholder='[{"inputs":[],"name":"...","type":"constructor"}]'
                  className="h-24 w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">构造函数参数</label>
                <input
                  type="text"
                  value={constructorArgs}
                  onChange={(e) => setConstructorArgs(e.target.value)}
                  placeholder='["MyToken", "MTK", 1000000] 或 MyToken, MTK, 1000000'
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">附带 ETH/BNB（可选）</label>
                <input
                  type="number"
                  value={deployValue}
                  onChange={(e) => setDeployValue(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 font-mono text-xs text-[#E8E8E8] outline-none placeholder:text-[#5F656D] focus:border-[#D0FF00]/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Code preview & deploy */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:min-h-0 lg:overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#23262A] px-5 py-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-[#D0FF00]" />
              <span className="text-sm font-medium text-white">合约源码</span>
            </div>
            <button
              onClick={() => setCode("")}
              className="text-xs text-[#84888C] transition-colors hover:text-white"
            >
              清空
            </button>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// 在此粘贴你的 Solidity 合约源码，用于预览与存档...\npragma solidity ^0.8.20;\n"
            className="flex-1 resize-none bg-[#0B0D0E] p-4 font-mono text-xs leading-relaxed text-[#E8E8E8] outline-none placeholder:text-[#5F656D] lg:p-5 lg:text-sm"
          />

          {/* Deploy action */}
          <div className="border-t border-[#23262A] p-5">
            {status === "error" && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">{errorMessage}</span>
              </div>
            )}

            {status === "success" && (
              <div className="mb-4 space-y-3 rounded-lg border border-[#D0FF00]/30 bg-[#D0FF00]/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[#D0FF00]">
                  <CheckCircle className="h-4 w-4" />
                  部署成功
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#84888C]">合约地址</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-white">{contractAddress}</code>
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
                    <span className="text-xs text-[#84888C]">交易哈希</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-white">{txHash}</code>
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

            <button
              onClick={handleDeploy}
              disabled={status === "pending" || !wallet.isConnected || (mode === "factory" && DEPLOY_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {status === "pending" ? "部署中..." : "一键部署"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
