import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { ExternalLink, Loader2, Rocket, ShieldCheck, Snowflake } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import {
  DEFAULT_SNOWBALL_FACTORY_FORM,
  SNOWBALL_FACTORY_ABI,
  SNOWBALL_FACTORY_ADDRESS,
  buildSnowballLaunchParams,
  mineSnowballSalt,
  previewSnowballFees,
  validateLiquidityInputs,
  type SnowballFactoryFormValues,
} from "@/lib/contracts/snowballFactory";

type Mode = "deploy" | "liquidity";

export default function SnowballLaunch() {
  const wallet = useWallet();
  const [form, setForm] = useState(DEFAULT_SNOWBALL_FACTORY_FORM);
  const [mode, setMode] = useState<Mode>("deploy");
  const [lpTokens, setLpTokens] = useState("50000000");
  const [lpBnb, setLpBnb] = useState("1");
  const [busy, setBusy] = useState(false);
  const [miningAttempts, setMiningAttempts] = useState(0);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const preview = useMemo(() => previewSnowballFees(form), [form]);
  const update = (key: keyof SnowballFactoryFormValues, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function launch() {
    setError(""); setResult("");
    if (!SNOWBALL_FACTORY_ADDRESS || !ethers.isAddress(SNOWBALL_FACTORY_ADDRESS)) {
      setError("雪球 Factory 尚未部署或未配置 VITE_SNOWBALL_FACTORY_ADDRESS"); return;
    }
    if (!wallet.signer || !wallet.account) { await wallet.connectWallet(); return; }
    if (!wallet.isBSC) { await wallet.switchToBSC(); return; }
    setBusy(true);
    try {
      const params = buildSnowballLaunchParams(form, wallet.account);
      const factory = new ethers.Contract(SNOWBALL_FACTORY_ADDRESS, SNOWBALL_FACTORY_ABI, wallet.signer);
      const fee = await factory.creationFee() as bigint;
      const liquidity = mode === "liquidity" ? validateLiquidityInputs(form.totalSupply, lpTokens, lpBnb) : null;
      const salt = await mineSnowballSalt(factory, params, mode === "liquidity", setMiningAttempts);
      const tx = mode === "liquidity"
        ? await factory.createTokenAndAddLiquidity(params, salt, liquidity!.tokens, liquidity!.bnb, { value: fee + liquidity!.bnb })
        : await factory.createToken(params, salt, { value: fee });
      const receipt = await tx.wait();
      const event = receipt.logs.map((log: ethers.Log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
        .find((item: ethers.LogDescription | null) => item?.name === "TokenCreated");
      setResult(event?.args?.token || tx.hash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); setMiningAttempts(0); }
  }

  const fields: Array<[keyof SnowballFactoryFormValues, string]> = [
    ["name", "名称"], ["symbol", "符号"], ["totalSupply", "总量"], ["fundAddress", "项目方 Fund 地址"],
    ["rewardToken", "分红币地址"], ["totalBuyTax", "总买税 (%)"], ["totalSellTax", "总卖税 (%)"],
    ["rewardShare", "分红占剩余税 (%)"], ["liquidityShare", "回流占剩余税 (%)"], ["burnShare", "燃烧占剩余税 (%)"],
    ["fundShare", "Fund 占剩余税 (%)"], ["dividendThreshold", "持币分红门槛"], ["maxBuyAmount", "限买（0=不限）"],
    ["maxSellAmount", "限卖（0=不限）"], ["maxWalletAmount", "限钱包（0=不限）"], ["lpBurnPercent", "LP 单次燃烧 (%)"],
    ["lpBurnFrequency", "LP 燃烧间隔（秒）"], ["secondTime", "二级白名单保护（秒）"], ["killBlocks", "开盘杀块参数"],
  ];

  return <div className="mx-auto max-w-7xl space-y-6">
    <div><p className="flex items-center gap-2 text-sm text-[#D0FF00]"><Snowflake className="h-4 w-4"/> Snowball Factory</p>
      <h1 className="mt-2 text-3xl font-black text-white">雪球发射台</h1>
      <p className="mt-2 text-sm text-[#9CA3AF]">固定从已收交易税中提取 20% 作为平台份额；这不是额外再收 20% 成交税。</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5 rounded-2xl border border-[#25282C] bg-[#111215] p-5">
        <div className="grid grid-cols-2 gap-3">{(["deploy", "liquidity"] as Mode[]).map((value) =>
          <button key={value} onClick={() => setMode(value)} className={`rounded-xl border p-3 text-sm ${mode === value ? "border-[#D0FF00]/60 bg-[#D0FF00]/10 text-[#D0FF00]" : "border-[#303236] text-[#9CA3AF]"}`}>
            {value === "deploy" ? "只部署代币" : "部署 + 加池 + 开盘"}
          </button>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="block">
          <span className="mb-1.5 block text-xs text-[#9CA3AF]">{label}</span>
          <input value={String(form[key])} onChange={(e) => update(key, e.target.value)} className="kimi-input" />
        </label>)}</div>
        <label className="flex items-center gap-2 text-sm text-[#D1D5DB]"><input type="checkbox" checked={form.enableOffTrade} onChange={(e) => update("enableOffTrade", e.target.checked)} className="accent-[#D0FF00]"/>启用开盘前禁止交易</label>
        {mode === "liquidity" && <div className="grid gap-4 rounded-xl border border-[#D0FF00]/20 bg-[#D0FF00]/5 p-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-xs text-[#9CA3AF]">加入池子的代币数量</span><input value={lpTokens} onChange={(e)=>setLpTokens(e.target.value)} className="kimi-input"/></label>
          <label><span className="mb-1.5 block text-xs text-[#9CA3AF]">加入池子的 BNB</span><input value={lpBnb} onChange={(e)=>setLpBnb(e.target.value)} className="kimi-input"/></label>
          <p className="sm:col-span-2 text-xs text-[#F5C86B]">此模式会把 LP 永久转入黑洞、自动开盘，并把剩余代币和 Owner 权限交给项目方。</p>
        </div>}
      </section>
      <aside className="space-y-4">
        {(["buy", "sell"] as const).map((side) => { const item = preview[side]; return <div key={side} className="rounded-2xl border border-[#25282C] bg-[#111215] p-5">
          <h3 className="font-semibold text-white">{side === "buy" ? "买入" : "卖出"}税费预览 · {item.total.toFixed(2)}%</h3>
          <div className="mt-4 space-y-2 text-sm text-[#9CA3AF]">{[["平台",item.platform],["分红",item.reward],["回流",item.liquidity],["燃烧",item.burn],["Fund",item.fund]].map(([label,value])=><div key={String(label)} className="flex justify-between"><span>{label}</span><span className="text-white">{Number(value).toFixed(2)}%</span></div>)}</div>
        </div>; })}
        <div className="rounded-2xl border border-[#25282C] bg-[#111215] p-5 text-xs leading-6 text-[#9CA3AF]"><ShieldCheck className="mb-2 h-5 w-5 text-[#D0FF00]"/>
          LP 单边燃烧由卖出交易触发；超过间隔后下一笔卖出只燃烧一次，不累计补烧。推荐 0.5% / 3600 秒，合约限制单次不超过 1%。
        </div>
        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {result && <a href={`https://bscscan.com/address/${result}`} target="_blank" rel="noreferrer" className="block break-all rounded-xl border border-[#D0FF00]/20 bg-[#D0FF00]/10 p-3 text-sm text-[#D0FF00]">{result} <ExternalLink className="inline h-3.5 w-3.5"/></a>}
        <button onClick={launch} disabled={busy} className="kimi-btn-primary w-full justify-center py-3">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Rocket className="h-4 w-4"/>}{miningAttempts ? `正在计算靓号… ${miningAttempts.toLocaleString()}` : busy ? "正在创建…" : mode === "deploy" ? "创建雪球代币" : "一键加池并开盘"}</button>
      </aside>
    </div>
  </div>;
}
