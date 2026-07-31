import { useState, useEffect, useMemo, type ChangeEvent } from "react";
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
  Coins,
} from "lucide-react";
import { SyntaxHighlighter, vscDarkPlus } from "@/lib/syntaxHighlighter";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";
import {
  deployBytecode,
  chargeKimiTokens,
  DEPLOY_BURN_AMOUNT,
  getExplorerUrl,
  parseConstructorArgs,
  encodeConstructorArgs,
  getKimiBalance,
  parseDeployValue,
  preflightBytecodeDeployment,
  CHAIN_IDS,
  normalizeBytecode,
  extractDeploymentArtifact,
} from "@/lib/contracts/deployer";
import {
  BSC_USDT_ADDRESS,
  SNOWBALL_LAUNCHPAD_ADDRESS,
  buildCreateTokenParams,
  fetchSnowballLaunchpadStatus,
  preflightCreateToken,
  submitCreateToken,
  type CreateTokenFormValues,
  type SnowballLaunchpadStatus,
} from "@/lib/contracts/snowball";
import { buildTemplateDeployment, DEPLOY_TEMPLATES } from "@/lib/contracts/deployTemplates";
import { useAppStore } from "@/store";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";
import { formatContractError } from "@/lib/contracts/errors";
import { TransactionError } from "@/components/TransactionError";
import { SnowballFactoryForm } from "@/components/SnowballFactoryForm";
import { safeGetItem } from "@/lib/storage";

const networks = [
  { value: "bsc", label: "BNB Smart Chain", icon: "🔶", chainId: 56 },
  { value: "eth", label: "Ethereum", icon: "💠", chainId: 1 },
  { value: "arb", label: "Arbitrum One", icon: "🔵", chainId: 42161 },
  { value: "base", label: "Base", icon: "🛡️", chainId: 8453 },
];

const DEPLOY_MODES = [
  { value: "manual", label: "手动部署", icon: Code2, desc: "使用 Bytecode + ABI 直接上链" },
  {
    value: "factory",
    label: "工厂部署",
    icon: Factory,
    desc: "通过已验证的 KIMI 普通发币工厂在 BSC 创建代币",
  },
] as const;

type DeployMode = (typeof DEPLOY_MODES)[number]["value"];

const BURN_AMOUNT = "20,000";

const DEFAULT_SNOWBALL_FORM: CreateTokenFormValues = {
  name: "",
  symbol: "",
  totalSupply: "1000000000",
  hiddenFeeReceiver: "",
  rewardToken: BSC_USDT_ADDRESS,
  buyHiddenTaxBp: "0",
  buyBurnBp: "0",
  buyLiquidityBp: "0",
  buyDividendBp: "0",
  sellHiddenTaxBp: "0",
  sellBurnBp: "0",
  sellLiquidityBp: "0",
  sellDividendBp: "0",
  ordinaryWhitelist: "",
  limitAccounts: "",
  limitQuotas: "",
  limitModeEnabled: false,
  requestAutoVerify: true,
};

export default function Deploy() {
  const { addLog, showToast } = useAppStore();
  const wallet = useWallet();
  const { addToken } = useIssuedTokens();
  const { recordDeploy, recordLaunch } = useContractData();

  const [code, setCode] = useState("");
  const [bytecode, setBytecode] = useState("");
  const [abi, setAbi] = useState("");
  const [constructorArgs, setConstructorArgs] = useState("");
  const [network, setNetwork] = useState("bsc");
  const [mode, setMode] = useState<DeployMode>("manual");
  const [deployValue, setDeployValue] = useState("0");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("DEPLOY");
  const [templateSupply, setTemplateSupply] = useState("1000000000");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [snowballForm, setSnowballForm] = useState<CreateTokenFormValues>(DEFAULT_SNOWBALL_FORM);
  const [launchpadStatus, setLaunchpadStatus] = useState<SnowballLaunchpadStatus | null>(null);
  const [factoryFee, setFactoryFee] = useState<bigint | null>(null);
  const [factoryFeeReadState, setFactoryFeeReadState] = useState<"loading" | "ready" | "error">("loading");
  const [factoryFeeReadError, setFactoryFeeReadError] = useState("");

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
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
    const saved = safeGetItem("flap-generated-code");
    if (saved) setCode(saved);
  }, []);

  useEffect(() => {
    let active = true;
    fetchSnowballLaunchpadStatus()
      .then((status) => {
        if (!active) return;
        setLaunchpadStatus(status);
        setFactoryFee(status.createFee);
        setFactoryFeeReadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setFactoryFeeReadState("error");
        setFactoryFeeReadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const template = DEPLOY_TEMPLATES.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    try {
      const deployment = buildTemplateDeployment(template, {
        name: tokenName,
        symbol: tokenSymbol,
        supply: templateSupply,
      });
      setConstructorArgs(deployment.constructorArgs);
    } catch {
      setConstructorArgs("");
    }
  }, [selectedTemplateId, templateSupply, tokenName, tokenSymbol]);

  const updateSnowballForm = <K extends keyof CreateTokenFormValues>(key: K, value: CreateTokenFormValues[K]) => {
    setSnowballForm((current) => ({ ...current, [key]: value }));
  };

  const expectedChainId = mode === "factory"
    ? 56
    : CHAIN_IDS[network] ?? networks.find((n) => n.value === network)?.chainId;
  const isWrongNetwork = wallet.isConnected && wallet.chainId !== expectedChainId;
  const networkLabel = mode === "factory"
    ? "BNB Smart Chain"
    : networks.find((n) => n.value === network)?.label || "BNB Smart Chain";
  const walletNetworkLabel = networks.find((item) => item.chainId === wallet.chainId)?.label || (wallet.chainId ? `Chain ${wallet.chainId}` : "未连接");
  const nativeSymbol = wallet.chainId === 56 ? "BNB" : "ETH";
  const deploymentChecks = useMemo(() => {
    const check = (label: string, action: () => void) => {
      try {
        action();
        return { label, pass: true, detail: "" };
      } catch (error) {
        return { label, pass: false, detail: error instanceof Error ? error.message : String(error) };
      }
    };
    if (mode === "factory") {
      return [
        check("KIMI 发币参数", () => {
          buildCreateTokenParams(snowballForm, {
            defaultHiddenFeeReceiver: wallet.account || "0x000000000000000000000000000000000000dEaD",
            defaultRewardToken: BSC_USDT_ADDRESS,
          });
        }),
        check("KIMI 发币工厂", () => {
          if (!SNOWBALL_LAUNCHPAD_ADDRESS) throw new Error("KIMI 发币工厂地址未配置");
        }),
        check("KIMI 网络（BSC）", () => {
          if (network !== "bsc") throw new Error("KIMI 发币工厂仅支持 BNB Smart Chain");
        }),
      ];
    }
    return [
      check("Creation Bytecode", () => { normalizeBytecode(bytecode); }),
      check("ABI 与构造参数", () => {
        const template = DEPLOY_TEMPLATES.find((item) => item.id === selectedTemplateId);
        const args = template
          ? buildTemplateDeployment(template, {
              name: tokenName,
              symbol: tokenSymbol,
              supply: templateSupply,
            }).constructorArgs
          : constructorArgs;
        encodeConstructorArgs(abi, parseConstructorArgs(args));
      }),
      check("附带原生币金额", () => { parseDeployValue(deployValue); }),
    ];
  }, [
    abi,
    bytecode,
    constructorArgs,
    deployValue,
    mode,
    network,
    selectedTemplateId,
    snowballForm,
    templateSupply,
    tokenName,
    tokenSymbol,
    wallet.account,
  ]);
  const deploymentInputError = deploymentChecks.find((item) => !item.pass)?.detail || "";
  const deploymentReady = !deploymentInputError;

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
    const saved = safeGetItem("flap-generated-code");
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
      const artifact = extractDeploymentArtifact(JSON.parse(await file.text()));
      setAbi(JSON.stringify(artifact.abi, null, 2));
      setBytecode(artifact.bytecode);
      if (artifact.contractName) setTokenName(artifact.contractName);
      setSelectedTemplateId("");
      setErrorMessage("");
      setErrorDetails("");
      setStatus("idle");
      showToast({ type: "success", message: "Artifact 已导入，可进行部署预检" });
    } catch (error) {
      const friendly = formatContractError(error, "Artifact 导入失败");
      setErrorMessage(friendly.summary);
      setErrorDetails(friendly.details);
      setStatus("error");
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    try {
      const template = DEPLOY_TEMPLATES.find((item) => item.id === templateId);
      if (!template) throw new Error("未找到部署模板");
      const defaultName = tokenName.trim() || (template.id === "fixed-supply" ? "Kimi Token" : "Kimi Plus");
      const currentSymbol = tokenSymbol.trim();
      const defaultSymbol = !currentSymbol || currentSymbol === "DEPLOY"
        ? template.id === "fixed-supply" ? "KIMI" : "KPLUS"
        : currentSymbol;
      const deployment = buildTemplateDeployment(template, {
        name: defaultName,
        symbol: defaultSymbol,
        supply: templateSupply,
      });
      setTokenName(deployment.name);
      setTokenSymbol(deployment.symbol);
      setAbi(deployment.abi);
      setBytecode(deployment.bytecode);
      setConstructorArgs(deployment.constructorArgs);
      setMode("manual");
      setSelectedTemplateId(template.id);
      setOpenGroups((current) => ({ ...current, bytecode: true, args: true }));
      setErrorMessage("");
      setErrorDetails("");
      setStatus("idle");
      showToast({ type: "success", message: `${template.title} 已载入，可连接钱包部署` });
    } catch (error) {
      const friendly = formatContractError(error, "模板载入失败");
      setErrorMessage(friendly.summary);
      setErrorDetails(friendly.details);
      setStatus("error");
    }
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleModeSelect = (nextMode: DeployMode) => {
    setMode(nextMode);
    if (nextMode === "factory") {
      setNetwork("bsc");
      setOpenGroups((current) => ({ ...current, network: true, mode: true }));
    }
    setStatus("idle");
    setErrorMessage("");
    setErrorDetails("");
  };

  const runDeploy = async (chargeKimi: boolean) => {
    setErrorMessage("");
    setErrorDetails("");
    setTxHash("");
    setContractAddress("");

    setStatus("pending");
    setDeployPhase("preflight");

    let kimiBurnTxHash = "";
    try {
      const signer = wallet.signer;
      const account = wallet.account;
      if (!wallet.isConnected || !signer || !account) throw new Error("请先连接钱包");
      if (isWrongNetwork) throw new Error(`当前网络不正确，请切换到 ${networkLabel}`);
      if (mode === "factory" && network !== "bsc") throw new Error("KIMI 发币工厂仅支持 BNB Smart Chain");
      if (chargeKimi && expectedChainId !== 56) throw new Error("KIMI 部署费目前只支持 BNB Smart Chain");
      if (!chargeKimi && expectedChainId === 56) throw new Error("BSC 发币和部署必须先扣除 20,000 官方 KIMI");

      let result: { address: string; deployTxHash: string };
      let deployedName = tokenName || "Deployed Contract";
      let deployedSymbol = tokenSymbol || "DEPLOY";
      let deployedSupply = "-";
      let deployedType: "snowball" | "custom" = "custom";

      if (chargeKimi) {
        const kimiBalance = await getKimiBalance(signer, account);
        if (kimiBalance < DEPLOY_BURN_AMOUNT) throw new Error("KIMI 余额不足，需要至少 20,000 KIMI");
      }

      if (mode === "factory") {
        const params = buildCreateTokenParams(snowballForm, {
          defaultHiddenFeeReceiver: account,
          defaultRewardToken: BSC_USDT_ADDRESS,
        });
        const preflight = await preflightCreateToken(signer, params);
        setFactoryFee(preflight.fee);
        setFactoryFeeReadState("ready");
        setFactoryFeeReadError("");
        setLaunchpadStatus((current) => current ? { ...current, createFee: preflight.fee } : current);
        addLog({
          type: "success",
          message: "KIMI 工厂发币预检通过",
          detail: `预计 Gas ${preflight.gasEstimate.toString()}，预计代币地址 ${preflight.predictedToken}`,
        });
        if (chargeKimi) {
          setDeployPhase("fee");
          const burnResult = await chargeKimiTokens({ signer, amount: DEPLOY_BURN_AMOUNT });
          kimiBurnTxHash = burnResult.txHash;
          addLog({ type: "success", message: "20,000 官方 KIMI 已转入销毁地址", detail: `tx: ${burnResult.txHash}` });
        }
        setDeployPhase("deploy");
        const launched = await submitCreateToken(signer, params, preflight.fee);
        setFactoryFee(launched.paidFee);
        result = { address: launched.tokenAddress, deployTxHash: launched.txHash };
        deployedName = params.name;
        deployedSymbol = params.symbol;
        deployedSupply = snowballForm.totalSupply;
        deployedType = "snowball";
      } else {
        const valueWei = parseDeployValue(deployValue);
        const template = DEPLOY_TEMPLATES.find((item) => item.id === selectedTemplateId);
        const currentConstructorArgs = template
          ? buildTemplateDeployment(template, {
              name: tokenName,
              symbol: tokenSymbol,
              supply: templateSupply,
            }).constructorArgs
          : constructorArgs;
        const parsedArgs = parseConstructorArgs(currentConstructorArgs);
        const gasEstimate = await preflightBytecodeDeployment({
          signer,
          bytecode,
          abi,
          constructorArgs: parsedArgs,
          value: valueWei,
        });
        addLog({ type: "success", message: "合约部署预检通过", detail: `预计 Gas ${gasEstimate.toString()}` });
        if (chargeKimi) {
          setDeployPhase("fee");
          const burnResult = await chargeKimiTokens({ signer, amount: DEPLOY_BURN_AMOUNT });
          kimiBurnTxHash = burnResult.txHash;
          addLog({ type: "success", message: "20,000 官方 KIMI 已转入销毁地址", detail: `tx: ${burnResult.txHash}` });
        }
        setDeployPhase("deploy");
        result = await deployBytecode({
          signer,
          bytecode,
          abi,
          constructorArgs: parsedArgs,
          value: valueWei,
          skipPreflight: true,
        });
      }

      setContractAddress(result.address);
      setTxHash(result.deployTxHash);

      try {
        addToken({
          name: deployedName,
          symbol: deployedSymbol,
          address: result.address,
          deployer: account,
          network: networkLabel,
          chainId: expectedChainId || 56,
          txHash: result.deployTxHash,
          status: "success",
          totalSupply: deployedSupply,
          type: deployedType,
          tradingOpen: mode === "factory" ? false : undefined,
        });
        if (mode === "factory") recordLaunch(deployedName);
        else recordDeploy(deployedName);
      } catch (recordError) {
        addLog({
          type: "error",
          message: `${mode === "factory" ? "代币已经创建" : "合约已经部署"}，但本地记录保存失败`,
          detail: recordError instanceof Error ? recordError.message : String(recordError),
        });
      }

      addLog({
        type: "success",
        message: mode === "factory"
          ? `KIMI 普通代币已创建: ${result.address}`
          : `合约已部署到 ${networkLabel}: ${result.address}`,
        detail: `tx: ${result.deployTxHash}`,
      });

      setStatus("success");
      showToast({ type: "success", message: mode === "factory" ? "KIMI 代币发射成功" : "合约部署成功" });
    } catch (err) {
      const friendly = formatContractError(err, mode === "factory" ? "KIMI 工厂发币失败" : "合约部署失败");
      const summary = kimiBurnTxHash
        ? `20,000 KIMI 已销毁，但后续${mode === "factory" ? "发币" : "部署"}未完成：${friendly.summary}`
        : friendly.summary;
      const details = kimiBurnTxHash
        ? `${friendly.details}\nKIMI 销毁交易：https://bscscan.com/tx/${kimiBurnTxHash}`
        : friendly.details;
      setErrorMessage(summary);
      setErrorDetails(details);
      setStatus("error");
      addLog({
        type: "error",
        message: mode === "factory" ? "KIMI 工厂发币失败" : "合约部署失败",
        detail: details,
      });
      showToast({ type: "error", message: summary });
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
    if (expectedChainId === 56) {
      await runDeploy(true);
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
          <h2 className="kimi-page-title">合约部署与工厂发币</h2>
          <p className="kimi-page-subtitle">Contract Deploy · 手动部署编译产物，或通过 KIMI 普通发币工厂在 BSC 创建代币</p>
        </div>
      </div>

      {mode === "manual" && <section className="rounded-2xl border border-[#D0FF00]/20 bg-gradient-to-br from-[#15180C] via-[#111215] to-[#0E1012] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Coins className="h-4 w-4 text-[#D0FF00]" />
              一键部署标准代币
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">模板已在本项目中通过 solc 编译，无需另外准备 Bytecode 或 ABI。</p>
          </div>
          <span className="w-fit rounded-full border border-[#D0FF00]/25 bg-[#D0FF00]/10 px-2.5 py-1 text-[11px] font-medium text-[#D0FF00]">
            已编译 · 可预检
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {DEPLOY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  selectedTemplateId === template.id
                    ? "border-[#D0FF00]/50 bg-[#D0FF00]/10"
                    : "border-[#303236] bg-[#0A0B0D]/80 hover:border-[#D0FF00]/30"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{template.title}</span>
                  {selectedTemplateId === template.id && <CheckCircle className="h-4 w-4 text-[#D0FF00]" />}
                </div>
                <p className="text-xs leading-relaxed text-[#9CA3AF]">{template.description}</p>
                <span className="mt-3 inline-flex text-xs font-medium text-[#D0FF00]">
                  {selectedTemplateId === template.id ? "模板已载入" : "载入模板 →"}
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[#303236] bg-[#0A0B0D]/80 p-4">
            <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">初始总供应量</label>
            <input
              type="text"
              inputMode="numeric"
              value={templateSupply}
              onChange={(event) => setTemplateSupply(event.target.value)}
              className="kimi-input font-mono"
              placeholder="1000000000"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">填写完整代币数量，不需要手动添加 18 位小数。</p>
          </div>
        </div>
      </section>}

      {/* Main: left 55% code/params, right 45% deploy info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 55% */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {mode === "factory" && (
            <SnowballFactoryForm
              form={snowballForm}
              onChange={updateSnowballForm}
              launchpadStatus={launchpadStatus}
              currentFee={factoryFee}
              feeReadState={factoryFeeReadState}
              feeReadError={factoryFeeReadError}
            />
          )}

          {/* Code editor */}
          {mode === "manual" && <div className="flex flex-col overflow-hidden rounded-2xl border border-[#25282C] bg-[#111215]">
            <div className="flex items-center justify-between gap-2 border-b border-[#25282C] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileCode className="h-4 w-4 text-[#2EDEDB]" />
                源码参考
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadLocal}
                  className="kimi-btn-secondary px-2.5 py-1.5 text-xs"
                  title="加载 AI 生成的本地 Solidity 源码"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">加载</span>
                </button>
                <button
                  onClick={handleCopyCode}
                  disabled={!code}
                  className="kimi-btn-secondary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  title="复制 Solidity 源码"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">复制</span>
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!code}
                  className="kimi-btn-secondary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  title="下载 Solidity 源码"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">下载</span>
                </button>
              </div>
            </div>

            <div className="border-b border-[#25282C] bg-[#0A0B0D] px-4 py-2 text-[11px] text-[#6B7280]">
              源码仅用于阅读和保存；真正部署使用下方的 creation Bytecode 与 ABI。
            </div>

            <div className="relative min-h-[220px] flex-1 bg-[#0A0B0D] sm:min-h-[260px] lg:min-h-[280px]">
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
          </div>}

          {/* Deploy params accordion */}
          <div className="space-y-3">
            <Accordion id="network" title="目标网络" icon={Layers}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {networks.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNetwork(n.value)}
                    disabled={mode === "factory" && n.value !== "bsc"}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-35",
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
              {mode === "factory" && (
                <p className="mt-3 text-xs leading-relaxed text-[#7DE9E7]">
                  KIMI 普通发币工厂当前只在 BNB Smart Chain 主网提供已核验部署。
                </p>
              )}
            </Accordion>

            <Accordion id="mode" title="部署方式" icon={ShieldCheck}>
              <div className="space-y-2">
                {DEPLOY_MODES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => handleModeSelect(m.value)}
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
              <div className="mt-3 rounded-lg border border-[#2EDEDB]/20 bg-[#2EDEDB]/5 p-3 text-xs leading-relaxed text-[#7DE9E7]">
                工厂模式固定调用已核验的 KIMI 普通发币工厂；手动模式继续支持任意已编译 Artifact。
              </div>
            </Accordion>

            {mode === "manual" && <Accordion id="bytecode" title="Bytecode / ABI" icon={Code2}>
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
                    onChange={(e) => {
                      setBytecode(e.target.value);
                      setSelectedTemplateId("");
                    }}
                    placeholder="0x60806040..."
                    rows={3}
                    className="kimi-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#9CA3AF]">ABI（用于校验和编码构造参数）</label>
                  <textarea
                    value={abi}
                    onChange={(e) => {
                      setAbi(e.target.value);
                      setSelectedTemplateId("");
                    }}
                    placeholder='[{"inputs":[],"name":"...","type":"constructor"}]'
                    rows={3}
                    className="kimi-input font-mono text-xs"
                  />
                </div>
              </div>
            </Accordion>}

            {mode === "manual" && <Accordion id="args" title="构造参数 / 代币信息" icon={Layers}>
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
            </Accordion>}
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
                <p className="text-sm text-[#9CA3AF]">连接钱包后即可查看余额并{mode === "factory" ? "通过工厂发币" : "部署合约"}</p>
                <button
                  onClick={wallet.connectWallet}
                  disabled={wallet.loading}
                  className="kimi-btn-primary w-full"
                >
                  {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  连接钱包
                </button>
                {wallet.error && <TransactionError summary={wallet.error} />}
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
                    {walletNetworkLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-3">
                  <span className="text-xs text-[#9CA3AF]">余额</span>
                  <span className="text-sm font-medium text-white">{Number(wallet.balance).toFixed(4)} {nativeSymbol}</span>
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

          <div className="kimi-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#D0FF00]" />
                <h3 className="font-semibold text-white">{mode === "factory" ? "发币就绪检查" : "部署就绪检查"}</h3>
              </div>
              <span className={cn("text-xs font-semibold", deploymentReady ? "text-[#D0FF00]" : "text-[#FF6B6B]") }>
                {deploymentChecks.filter((item) => item.pass).length}/{deploymentChecks.length}
              </span>
            </div>
            <div className="space-y-2">
              {deploymentChecks.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-[#25282C] bg-[#0A0B0D] px-3 py-2 text-xs">
                  <span className="text-[#9CA3AF]">{item.label}</span>
                  <span className={cn("flex items-center gap-1 font-medium", item.pass ? "text-[#D0FF00]" : "text-[#FF6B6B]") }>
                    {item.pass ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {item.pass ? "通过" : "待完善"}
                  </span>
                </div>
              ))}
            </div>
            {deploymentInputError && <p className="mt-3 text-xs leading-relaxed text-[#FF8A8A]">{deploymentInputError}</p>}
          </div>

          {/* Burn fee card */}
          <div className="kimi-card">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B6B]/10">
                <Flame className="h-4 w-4 text-[#FF6B6B]" />
              </div>
              <h3 className="font-semibold text-white">{mode === "factory" ? "工厂发币并支付 KIMI" : "安全部署并支付 KIMI"}</h3>
            </div>

            <div className="mb-4 rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4 text-center">
              <p className="text-xs text-[#9CA3AF]">销毁数量</p>
              <p className="mt-1 text-3xl font-bold text-[#FF6B6B]">{BURN_AMOUNT} KIMI</p>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#D0FF00]/25 bg-[#D0FF00]/5 p-3 text-xs text-[#C7E879]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {mode === "factory"
                  ? `系统会先校验 KIMI 发币工厂、实时创建费、发币参数和 Gas，然后先销毁 ${BURN_AMOUNT} KIMI，再请求钱包确认发币。`
                  : `系统会先校验 Bytecode、ABI、构造参数和 Gas，然后先销毁 ${BURN_AMOUNT} KIMI，再请求钱包确认部署。`}
              </span>
            </div>
            {expectedChainId === 56 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 text-xs text-[#FCD34D]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>需要两次钱包确认。KIMI 销毁交易确认后不可撤销，请继续完成第二笔发币或部署交易。</span>
              </div>
            )}
            {expectedChainId !== 56 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-xs text-[#FF6B6B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>KIMI 销毁目前只支持 BNB Smart Chain；其他网络只能使用下方的跨链直接部署。</span>
              </div>
            )}

            <button
              onClick={handleBurnAndDeploy}
              disabled={status === "pending" || expectedChainId !== 56 || (wallet.isConnected && !isWrongNetwork && !deploymentReady)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-3 text-sm font-semibold text-[#FF6B6B] transition-all hover:bg-[#FF6B6B]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {!wallet.isConnected
                ? mode === "factory" ? "连接钱包并工厂发币" : "连接钱包并安全部署"
                : isWrongNetwork
                  ? mode === "factory" ? "切换到 BSC 并发币" : "切换网络并部署"
                  : status === "pending"
                    ? deployPhase === "preflight"
                      ? mode === "factory" ? "正在校验 Factory 与发币参数…" : "正在校验部署参数…"
                      : deployPhase === "fee"
                        ? "正在扣除 20,000 官方 KIMI…"
                        : mode === "factory" ? "正在通过 Factory 创建代币…" : "正在部署合约…"
                    : !deploymentReady
                      ? mode === "factory" ? "请先完善发币参数" : "请先完成部署参数"
                      : mode === "factory" ? "工厂发币并支付 KIMI" : "安全部署并支付 KIMI"}
            </button>
          </div>

          {/* Non-BSC fallback: KIMI only exists on BSC, so this option is never shown for BSC/factory deployment. */}
          {expectedChainId !== 56 && <div className="kimi-card">
            <div className="mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-[#2EDEDB]" />
              <h3 className="font-semibold text-white">跨链钱包直接部署</h3>
            </div>
            <p className="mb-4 text-xs text-[#9CA3AF]">
              KIMI 当前只部署在 BSC，Ethereum、Arbitrum 与 Base 暂时无法链上销毁 KIMI；仍会执行 Bytecode、ABI、构造参数和 Gas 预检。
            </p>
            <button
              onClick={handleDeploy}
              disabled={status === "pending" || (wallet.isConnected && !isWrongNetwork && !deploymentReady)}
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
                    : !deploymentReady
                      ? "请先完成部署参数"
                      : "跨链钱包直接部署"}
            </button>
          </div>}

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
                    {mode === "factory" ? "代币发射成功" : "部署成功"}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">{mode === "factory" ? "代币地址" : "合约地址"}</span>
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
            </div>
          )}

          {/* Info tip */}
          <div className="rounded-xl border border-[#25282C] bg-[#111215] p-4">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-[#2EDEDB]" />
              <span className="text-sm font-medium text-white">{mode === "factory" ? "KIMI 工厂发币流程" : "部署流程"}</span>
            </div>
            {mode === "factory" ? (
              <ol className="list-decimal space-y-1 pl-4 text-xs text-[#9CA3AF]">
                <li>填写名称、符号、整数总量及可选税率</li>
                <li>连接 BSC 钱包并读取 KIMI 发币工厂实时创建费</li>
                <li>校验运行时代码、参数、静态调用和 Gas</li>
                <li>先把 20,000 官方 KIMI 转入销毁地址，再确认 createToken 交易</li>
                <li>新代币会自动保存到「已发代币」</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1 pl-4 text-xs text-[#9CA3AF]">
                <li>导入编译 Artifact，或填写 creation Bytecode + ABI</li>
                <li>选择目标网络并连接钱包</li>
                <li>系统先预检参数与 Gas</li>
                <li>BSC 部署先把 20,000 官方 KIMI 转入销毁地址，再请求钱包部署</li>
                <li>成功后可在「已发代币」查看</li>
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
