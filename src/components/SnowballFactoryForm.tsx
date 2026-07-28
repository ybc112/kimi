import { useMemo, useState } from "react";
import { CheckCircle, ChevronDown, ExternalLink, Factory, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SNOWBALL_LAUNCHPAD_ADDRESS,
  formatCreateFee,
  type CreateTokenFormValues,
  type SnowballLaunchpadStatus,
} from "@/lib/contracts/snowball";

type StringField = {
  [K in keyof CreateTokenFormValues]: CreateTokenFormValues[K] extends string ? K : never;
}[keyof CreateTokenFormValues];

interface SnowballFactoryFormProps {
  form: CreateTokenFormValues;
  onChange: <K extends keyof CreateTokenFormValues>(key: K, value: CreateTokenFormValues[K]) => void;
  launchpadStatus: SnowballLaunchpadStatus | null;
  currentFee: bigint | null;
  feeReadState: "loading" | "ready" | "error";
  feeReadError?: string;
}

const BUY_TAX_FIELDS: Array<{ key: StringField; label: string }> = [
  { key: "buyHiddenTaxBp", label: "隐藏费" },
  { key: "buyBurnBp", label: "销毁" },
  { key: "buyLiquidityBp", label: "流动性" },
  { key: "buyDividendBp", label: "分红" },
];

const SELL_TAX_FIELDS: Array<{ key: StringField; label: string }> = [
  { key: "sellHiddenTaxBp", label: "隐藏费" },
  { key: "sellBurnBp", label: "销毁" },
  { key: "sellLiquidityBp", label: "流动性" },
  { key: "sellDividendBp", label: "分红" },
];

function taxTotal(form: CreateTokenFormValues, fields: Array<{ key: StringField }>) {
  return fields.reduce((sum, field) => sum + (Number(form[field.key]) || 0), 0);
}

export function SnowballFactoryForm({
  form,
  onChange,
  launchpadStatus,
  currentFee,
  feeReadState,
  feeReadError,
}: SnowballFactoryFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const feeDisplay = useMemo(
    () => (currentFee === null ? null : formatCreateFee(currentFee)),
    [currentFee]
  );
  const runtimeVerified = Boolean(launchpadStatus?.runtimeVerified || (feeReadState === "ready" && currentFee !== null));
  const buyTax = taxTotal(form, BUY_TAX_FIELDS);
  const sellTax = taxTotal(form, SELL_TAX_FIELDS);

  const taxSection = (title: string, fields: typeof BUY_TAX_FIELDS, total: number) => (
    <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">{title}</span>
        <span className={cn("text-xs font-medium", total <= 25 ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
          合计 {total.toFixed(2)}% / 25%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1.5 block text-xs text-[#9CA3AF]">{label} (%)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form[key]}
              onChange={(event) =>
                onChange(
                  key,
                  event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
                )
              }
              className="kimi-input"
              placeholder="0"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#D0FF00]/25 bg-gradient-to-br from-[#15180C] via-[#111215] to-[#0E1012] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D0FF00]/10">
                <Factory className="h-4 w-4 text-[#D0FF00]" />
              </span>
              <div>
                <h3 className="font-semibold text-white">Snowball 普通发射工厂</h3>
                <p className="text-xs text-[#9CA3AF]">调用 SnowballLaunchpad.createToken，不再使用通用 deploy(bytes,bytes)</p>
              </div>
            </div>
            <code className="mt-3 block break-all text-xs text-[#B8BDC5]">{SNOWBALL_LAUNCHPAD_ADDRESS}</code>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <a
              href={`https://bscscan.com/address/${SNOWBALL_LAUNCHPAD_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#D0FF00] hover:underline"
            >
              BscScan <ExternalLink className="h-3 w-3" />
            </a>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                runtimeVerified
                  ? "border-[#D0FF00]/25 bg-[#D0FF00]/10 text-[#D0FF00]"
                  : feeReadState === "error"
                    ? "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]"
                    : "border-[#303236] bg-[#0A0B0D] text-[#9CA3AF]"
              )}
            >
              {runtimeVerified ? <CheckCircle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {runtimeVerified
                ? "源码与主网字节码一致"
                : feeReadState === "error"
                  ? "交易前重新校验"
                  : "正在校验 Factory"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#303236] bg-[#0A0B0D]/80 p-3">
            <p className="text-[11px] text-[#6B7280]">当前链上创建费</p>
            <p className={cn("mt-1 text-sm font-semibold", feeReadState === "error" ? "text-[#F59E0B]" : "text-[#D0FF00]")}>
              {feeReadState === "loading" ? "正在读取…" : feeDisplay?.fullLabel || "交易前实时读取"}
            </p>
          </div>
          <div className="rounded-xl border border-[#303236] bg-[#0A0B0D]/80 p-3">
            <p className="text-[11px] text-[#6B7280]">目标网络</p>
            <p className="mt-1 text-sm font-semibold text-white">BNB Smart Chain</p>
          </div>
          <div className="rounded-xl border border-[#303236] bg-[#0A0B0D]/80 p-3">
            <p className="text-[11px] text-[#6B7280]">代币精度</p>
            <p className="mt-1 text-sm font-semibold text-white">0 decimals · 整数总量</p>
          </div>
        </div>

        {feeDisplay?.isFree && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#2EDEDB]/20 bg-[#2EDEDB]/5 p-3 text-xs leading-relaxed text-[#7DE9E7]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            外部项目源码的初始默认创建费是 0.005 BNB；当前 owner 把链上值设为 0，这表示免收创建费，不代表交易免 Gas。
          </div>
        )}
        {feeReadState === "error" && (
          <div className="mt-3 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-3 text-xs leading-relaxed text-[#F5C86B]" title={feeReadError}>
            公共 RPC 暂时不可用。提交前仍会使用钱包 Provider 校验 Factory 字节码、实时费用和 Gas。
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#25282C] bg-[#111215] p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-white">代币基础参数</h3>
          <p className="mt-1 text-xs text-[#9CA3AF]">SnowballToken 的 decimals 固定为 0，总量请直接填写整数。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              className="kimi-input"
              placeholder="Snowball Token"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币符号</label>
            <input
              type="text"
              value={form.symbol}
              onChange={(event) => onChange("symbol", event.target.value.toUpperCase())}
              className="kimi-input"
              placeholder="SNOW"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#9CA3AF]">总供应量</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.totalSupply}
              onChange={(event) => onChange("totalSupply", event.target.value.replace(/\D/g, ""))}
              className="kimi-input font-mono"
              placeholder="1000000000"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-[#303236] bg-[#0A0B0D] px-4 py-3 text-left transition-colors hover:border-[#D0FF00]/30"
        >
          <span>
            <span className="block text-sm font-medium text-white">高级发币参数</span>
            <span className="block text-[11px] text-[#6B7280]">收款地址、分红币、买卖税、白名单与限额</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-[#D0FF00]">
            买 {buyTax.toFixed(2)}% · 卖 {sellTax.toFixed(2)}%
            <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
          </span>
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">隐藏费接收地址</label>
                <input
                  type="text"
                  value={form.hiddenFeeReceiver}
                  onChange={(event) => onChange("hiddenFeeReceiver", event.target.value)}
                  className="kimi-input font-mono text-xs"
                  placeholder="留空则使用当前钱包"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">分红代币地址</label>
                <input
                  type="text"
                  value={form.rewardToken}
                  onChange={(event) => onChange("rewardToken", event.target.value)}
                  className="kimi-input font-mono text-xs"
                />
              </div>
            </div>

            {taxSection("买入税率", BUY_TAX_FIELDS, buyTax)}
            {taxSection("卖出税率", SELL_TAX_FIELDS, sellTax)}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">普通白名单地址</label>
                <textarea
                  value={form.ordinaryWhitelist}
                  onChange={(event) => onChange("ordinaryWhitelist", event.target.value)}
                  className="kimi-input min-h-[84px] resize-none font-mono text-xs"
                  placeholder="每行或逗号分隔一个地址"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">限制账户地址</label>
                <textarea
                  value={form.limitAccounts}
                  onChange={(event) => onChange("limitAccounts", event.target.value)}
                  className="kimi-input min-h-[84px] resize-none font-mono text-xs"
                  placeholder="每行或逗号分隔一个地址"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#9CA3AF]">限制额度（与限制账户一一对应）</label>
              <textarea
                value={form.limitQuotas}
                onChange={(event) => onChange("limitQuotas", event.target.value)}
                className="kimi-input min-h-[64px] resize-none font-mono text-xs"
                placeholder="每行或逗号分隔一个整数额度"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.limitModeEnabled}
                  onChange={(event) => onChange("limitModeEnabled", event.target.checked)}
                  className="h-4 w-4 accent-[#D0FF00]"
                />
                启用限额模式
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.requestAutoVerify}
                  onChange={(event) => onChange("requestAutoVerify", event.target.checked)}
                  className="h-4 w-4 accent-[#D0FF00]"
                />
                请求自动开源验证
              </label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
