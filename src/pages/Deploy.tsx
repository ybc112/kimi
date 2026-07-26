import { useState, useEffect } from "react";
import { Rocket, Wallet, ShieldCheck, Coins, Copy, CheckCircle, AlertCircle } from "lucide-react";

const networks = [
  { value: "bsc", label: "BNB Smart Chain", icon: "🔶" },
  { value: "eth", label: "Ethereum", icon: "💠" },
  { value: "arb", label: "Arbitrum", icon: "🔵" },
  { value: "base", label: "Base", icon: "🛡️" },
];

const KIMI_PRICE = "100,000";
const RECEIVING_WALLET = "0xKimi...DeployVault";

export default function Deploy() {
  const [code, setCode] = useState("");
  const [network, setNetwork] = useState("bsc");
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"preview" | "pay" | "deploying" | "success">("preview");
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("flap-generated-code");
    if (saved) setCode(saved);
  }, []);

  const handleDeploy = () => {
    if (!code.trim()) return;
    setShowModal(true);
    setStep("pay");
  };

  const handlePay = () => {
    setStep("deploying");
    setTimeout(() => {
      setTxHash("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));
      setStep("success");
    }, 2500);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(RECEIVING_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    setStep("preview");
    setTxHash("");
  };

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-3rem)]">
      <div>
        <h2 className="text-xl font-bold text-white">自定义部署合约</h2>
        <p className="text-xs text-[#84888C]">粘贴 Solidity 代码，支付 KIMI 一键部署上链</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:overflow-hidden">
        {/* Left: Code input */}
        <div className="flex w-full flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:w-[55%] lg:overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#23262A] px-5 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#D0FF00]" />
              <span className="text-sm font-medium text-white">合约代码</span>
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
            placeholder="// 在此粘贴你的 Solidity 合约代码...\npragma solidity ^0.8.20;\n"
            className="flex-1 resize-none bg-[#0B0D0E] p-4 font-mono text-xs leading-relaxed text-[#E8E8E8] outline-none placeholder:text-[#5F656D] lg:p-5 lg:text-sm"
            style={{ minHeight: "320px" }}
          />
        </div>

        {/* Right: Settings */}
        <div className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:overflow-auto">
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Wallet className="h-4 w-4 text-[#2EDEDB]" />
              部署网络
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {networks.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNetwork(n.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    network === n.value
                      ? "border-[#D0FF00]/50 bg-[#D0FF00]/10 text-white"
                      : "border-[#303236] bg-[#0B0D0E] text-[#9CA3AF] hover:border-[#D0FF00]/30"
                  }`}
                >
                  <span>{n.icon}</span>
                  <span className="truncate">{n.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Coins className="h-4 w-4 text-[#D0FF00]" />
              部署费用
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#84888C]">KIMI 代币支付</span>
                <span className="font-bold text-[#D0FF00]">{KIMI_PRICE} KIMI</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#84888C]">Gas 费用</span>
                <span className="text-white">由钱包承担</span>
              </div>
              <div className="border-t border-[#23262A] pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#84888C]">总计</span>
                  <span className="font-bold text-white">{KIMI_PRICE} KIMI + Gas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-[#D0FF00]/5 p-3 text-xs text-[#9CA3AF]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D0FF00]" />
              <p>
                部署前请确认代码已通过安全审计。支付 {KIMI_PRICE} KIMI 后将由 Kimi
                部署服务自动完成上链。
              </p>
            </div>
            <button
              onClick={handleDeploy}
              disabled={!code.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Rocket className="h-4 w-4" />
              一键部署
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#23262A] bg-[#15171A] p-6">
            {step === "pay" && (
              <>
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#D0FF00]/10">
                    <Coins className="h-7 w-7 text-[#D0FF00]" />
                  </div>
                  <h3 className="text-lg font-bold text-white">支付 KIMI 完成部署</h3>
                  <p className="mt-1 text-xs text-[#84888C]">请向以下地址转入 {KIMI_PRICE} KIMI</p>
                </div>

                <div className="mb-5 space-y-3">
                  <div className="rounded-lg border border-[#303236] bg-[#0B0D0E] p-3">
                    <p className="mb-1 text-xs text-[#84888C]">收款地址</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate text-sm text-[#D0FF00]">{RECEIVING_WALLET}</code>
                      <button onClick={copyAddress} className="text-[#9CA3AF] hover:text-white">
                        {copied ? <CheckCircle className="h-4 w-4 text-[#D0FF00]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#303236] bg-[#0B0D0E] p-3">
                    <span className="text-xs text-[#84888C]">支付金额</span>
                    <span className="font-bold text-white">{KIMI_PRICE} KIMI</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#303236] bg-[#0B0D0E] p-3">
                    <span className="text-xs text-[#84888C]">部署网络</span>
                    <span className="text-sm text-white">{networks.find((n) => n.value === network)?.label}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-[#303236] bg-[#0B0D0E] py-2.5 text-sm text-[#9CA3AF] transition-colors hover:text-white"
                  >
                    取消
                  </button>
                  <button
                    onClick={handlePay}
                    className="flex-1 rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    已支付，立即部署
                  </button>
                </div>
              </>
            )}

            {step === "deploying" && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#23262A] border-t-[#D0FF00]" />
                <h3 className="text-lg font-bold text-white">正在部署中</h3>
                <p className="mt-2 text-xs text-[#84888C]">Kimi 部署服务正在编译并提交上链...</p>
              </div>
            )}

            {step === "success" && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D0FF00]/10">
                  <CheckCircle className="h-8 w-8 text-[#D0FF00]" />
                </div>
                <h3 className="text-lg font-bold text-white">部署成功</h3>
                <p className="mt-1 text-xs text-[#84888C]">合约已部署到 {networks.find((n) => n.value === network)?.label}</p>
                <div className="mt-4 rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-left">
                  <p className="mb-1 text-xs text-[#84888C]">交易哈希</p>
                  <code className="block break-all text-xs text-[#D0FF00]">{txHash}</code>
                </div>
                <button
                  onClick={closeModal}
                  className="mt-5 w-full rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
