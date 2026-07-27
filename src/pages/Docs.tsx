import { useState } from "react";
import {
  FileText,
  Shield,
  AlertCircle,
  CheckCircle2,
  Layers,
  Code2,
  Menu,
  Hash,
  BookOpen,
  ArrowRight,
} from "lucide-react";
const rules = [
  {
    id: "001",
    title: "Vault 基础继承",
    icon: Layers,
    content: "Vault 必须继承 VaultBaseV2；所有特权函数必须可由 Guardian 调用；Guardian 角色不可被撤销。",
  },
  {
    id: "002",
    title: "Factory 基础继承",
    icon: Code2,
    content: "Factory 必须继承 VaultFactoryBaseV2；newVault() 只能从 VaultPortal 调用；遵循推荐的手续费设置。",
  },
  {
    id: "003",
    title: "用户公平性",
    icon: Shield,
    content: "Vault 必须对用户公平；评估并降低三明治攻击、抢先交易等风险。",
  },
  {
    id: "004",
    title: "UI 友好与错误信息",
    icon: FileText,
    content: "错误信息必须使用字面量字符串；多语言错误需中英文内联；所有用户-facing 函数必须在 vaultUISchema().methods 中声明。",
  },
  {
    id: "005",
    title: "receive() 燃气限制",
    icon: AlertCircle,
    content: "receive() 必须 ≤ 1,000,000 gas；不得进行外部调用；保持简单，仅做累计或事件记录。",
  },
  {
    id: "006",
    title: "集成测试覆盖",
    icon: CheckCircle2,
    content: "每个 public 函数至少有一个测试；覆盖 receive() 燃气、关键流程、Guardian 访问、UI schema。",
  },
  {
    id: "007",
    title: "AI Oracle 集成",
    icon: Layers,
    content: "AI Oracle 回调必须 ≤ 2M gas；确保生命周期安全；防止重入与状态不一致。",
  },
  {
    id: "008",
    title: "Trigger Service 集成",
    icon: Code2,
    content: "Trigger Service 回调必须 ≤ 2M gas；具备重放保护；时间相关逻辑需健壮。",
  },
  {
    id: "009",
    title: "紧急风险控制",
    icon: Shield,
    content: "紧急控制必须仅 Guardian 可操作；默认处于非激活状态；提供清晰的启用/禁用机制。",
  },
];

const addresses = [
  { chain: "BNB Chain (56)", portal: "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0", vaultPortal: "0x90497450f2a706f1951b5bdda52B4E5d16f34C06", guardian: "0x9e27098dcD8844bcc6287a557E0b4D09C86B8a4b" },
  { chain: "BNB Testnet (97)", portal: "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9", vaultPortal: "0x027e3704fC5C16522e9393d04C60A3ac5c0d775f", guardian: "0x76Fa8C526f8Bc27ba6958B76DeEf92a0dbE46950" },
];

const quickParams = [
  { name: "RAISE_CAP", desc: "募集上限（测试 5 BNB / 主网 50 BNB）", example: "5 BNB" },
  { name: "CONTRIBUTION_CAP", desc: "单地址认购上限", example: "0.1 BNB" },
  { name: "MAX_PARTICIPANTS", desc: "最大参与地址数（测试 50 / 主网 500）", example: "50" },
  { name: "LP_BNB_AMOUNT", desc: "LP 用 BNB，为 RAISE_CAP 的 36%", example: "1.8 BNB" },
  { name: "Treasury", desc: "国库资金，为 RAISE_CAP 的 64%", example: "3.2 BNB" },
  { name: "Tax Rate", desc: "税率固定 5%，全部进入国库", example: "5%" },
];

const sections = [
  { id: "addresses", label: "核心地址" },
  { id: "required", label: "必须实现的方法" },
  { id: "rules", label: "九条审核规则" },
  { id: "params", label: "常用参数速查" },
  { id: "deploy", label: "部署流程" },
];

export default function Docs() {
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileTocOpen(false);
    }
  };

  const Toc = () => (
    <nav className="space-y-1">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => scrollTo(s.id)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#9CA3AF] transition-colors hover:bg-[#1A1D21] hover:text-white"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {s.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Mobile TOC toggle */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileTocOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-[#303236] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:text-white"
        >
          <Menu className="h-4 w-4" />
          目录
        </button>
        {mobileTocOpen && (
          <div className="mt-2 rounded-xl border border-[#23262A] bg-[#15171A] p-3">
            <Toc />
          </div>
        )}
      </div>

      {/* Sidebar TOC */}
      <aside className="hidden lg:block lg:w-56 lg:shrink-0">
        <div className="sticky top-24 rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Hash className="h-4 w-4 text-[#D0FF00]" />
            目录
          </h3>
          <Toc />
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white">规范文档</h2>
          <p className="mt-1 text-sm text-[#84888C]">Flap Tax Vault V2 合约标准与审核规则</p>
        </div>

        <section id="addresses" className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
          <h3 className="mb-4 text-base font-semibold text-white">核心地址</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#23262A] text-left text-[#84888C]">
                  <th className="pb-3 pr-4 font-medium">网络</th>
                  <th className="pb-3 pr-4 font-medium">Portal</th>
                  <th className="pb-3 pr-4 font-medium">VaultPortal</th>
                  <th className="pb-3 font-medium">Guardian</th>
                </tr>
              </thead>
              <tbody className="text-[#9CA3AF]">
                {addresses.map((row) => (
                  <tr key={row.chain} className="border-b border-[#23262A] last:border-0">
                    <td className="py-3 pr-4 font-medium text-white">{row.chain}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{row.portal}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{row.vaultPortal}</td>
                    <td className="py-3 font-mono text-xs">{row.guardian}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="required" className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
          <h3 className="mb-4 text-base font-semibold text-white">必须实现的方法</h3>
          <div className="space-y-3 text-sm text-[#9CA3AF]">
            <div className="flex items-center gap-3 rounded-lg bg-[#0B0D0E] p-3">
              <code className="text-[#D0FF00]">description()</code>
              <span>返回描述 Vault 当前状态的动态字符串</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#0B0D0E] p-3">
              <code className="text-[#D0FF00]">vaultUISchema()</code>
              <span>返回 VaultUISchema，声明所有用户可调用的方法</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#0B0D0E] p-3">
              <code className="text-[#D0FF00]">receive()</code>
              <span>接收 Portal 转发的 BNB 税收，必须 ≤ 1M gas</span>
            </div>
          </div>
        </section>

        <section id="rules">
          <h3 className="mb-4 text-base font-semibold text-white">九条审核规则</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {rules.map((rule) => {
              const Icon = rule.icon;
              return (
                <div
                  key={rule.id}
                  className="rounded-xl border border-[#23262A] bg-[#15171A] p-5 transition-all hover:border-[#D0FF00]/30"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D0FF00]/10">
                      <Icon className="h-4 w-4 text-[#D0FF00]" />
                    </div>
                    <div>
                      <span className="text-xs text-[#5F656D]">Rule {rule.id}</span>
                      <h4 className="font-medium text-white">{rule.title}</h4>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-[#9CA3AF]">{rule.content}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="params" className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
          <h3 className="mb-4 text-base font-semibold text-white">常用参数速查</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickParams.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-[#23262A] bg-[#0B0D0E] p-4 transition-colors hover:border-[#D0FF00]/20"
              >
                <div className="mb-1 flex items-center gap-2">
                  <code className="text-xs text-[#D0FF00]">{p.name}</code>
                  <span className="rounded bg-[#D0FF00]/10 px-1.5 py-0.5 text-[10px] text-[#D0FF00]">
                    {p.example}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#9CA3AF]">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="deploy" className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
          <h3 className="mb-3 text-base font-semibold text-white">部署流程</h3>
          <ol className="space-y-2 text-sm text-[#9CA3AF]">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">1</span>
              <span>按照 V2 规范实现 Vault 与 Factory（如果适用）</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">2</span>
              <span>部署到 BNB Chain 或 BNB Testnet</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">3</span>
              <span>前往 flap.sh 使用 Factory 地址启动代币，无需注册</span>
            </li>
          </ol>
          <a
            href="https://docs.flap.sh"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-[#D0FF00] hover:underline"
          >
            查看完整文档 <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </section>
      </div>
    </div>
  );
}
