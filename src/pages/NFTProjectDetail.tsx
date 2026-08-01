import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useParams } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { getNFTVerificationStatus, loadNFTProject, mintNFT, queueNFTVerification } from "@/lib/nftLaunch/launchpad";
import type { NFTProject } from "@/lib/nftLaunch/types";

export default function NFTProjectDetail() {
  const { collection = "" } = useParams();
  const wallet = useWallet();
  const { showToast } = useAppStore();
  const [project, setProject] = useState<NFTProject | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [verification, setVerification] = useState("未提交");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => project ? Number(project.mintPrice) * Number(quantity || 0) : 0, [project, quantity]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadNFTProject(collection);
      setProject(next);
      const job = await getNFTVerificationStatus(collection);
      setVerification(job?.status || "未提交");
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "NFT 合集读取失败" });
    } finally { setLoading(false); }
  }, [collection, showToast]);
  useEffect(() => { void refresh(); }, [refresh]);

  const mint = async () => {
    if (!project) return;
    if (!wallet.isConnected || !wallet.signer) { await wallet.connectWallet(); return; }
    if (!wallet.isBSC) { await wallet.switchToBSC(); return; }
    setBusy(true);
    try {
      const hash = await mintNFT(wallet.signer, project.collection, quantity, project.mintPrice);
      showToast({ type: "success", message: `NFT 铸造成功：${hash.slice(0, 12)}...` });
      await refresh();
    } catch (error) { showToast({ type: "error", message: error instanceof Error ? error.message : "NFT 铸造失败" }); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!project) return;
    const result = await queueNFTVerification(project.collection);
    setVerification(result.ok ? "queued" : verification);
    showToast({ type: result.ok ? "success" : "error", message: result.ok ? "源码验证已加入队列" : "源码验证提交失败" });
  };

  if (loading && !project) return <div className="flex min-h-[50vh] items-center justify-center text-[#9CA3AF]"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>正在读取 NFT 合集…</div>;
  if (!project) return <div className="mx-auto max-w-3xl rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-red-200">无法读取该 NFT 合集。</div>;

  return <div className="mx-auto max-w-6xl space-y-6"><div className="grid gap-6 lg:grid-cols-[420px_1fr]"><div className="overflow-hidden rounded-3xl border border-[#25282C] bg-[#111215]"><img src={project.imageURI} alt={project.name} className="aspect-square w-full object-cover"/></div><section className="space-y-5 rounded-3xl border border-[#25282C] bg-[#111215] p-6"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold text-white">{project.name}</h1><span className="rounded-full bg-[#D0FF00]/10 px-3 py-1 text-xs text-[#D0FF00]">{project.symbol}</span></div><p className="mt-3 text-sm leading-6 text-[#9CA3AF]">{project.description || "暂无合集描述"}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["铸造价格", `${project.mintPrice} BNB`],["已铸造", `${project.totalMinted}/${project.maxSupply}`],["钱包上限", project.maxMintPerWallet],["开源状态", verification]].map(([label,value])=><div key={label} className="rounded-xl bg-[#0A0B0D] p-3"><p className="text-xs text-[#6B7280]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-white">{value}</p></div>)}</div><div className="rounded-2xl border border-[#25282C] bg-[#0A0B0D] p-4"><label className="text-xs text-[#9CA3AF]">铸造数量</label><input type="number" min="1" max={project.maxMintPerWallet} value={quantity} onChange={(e)=>setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-[#25282C] bg-[#111215] p-3 text-white"/><div className="mt-3 flex items-center justify-between text-sm"><span className="text-[#6B7280]">预计支付</span><span className="font-semibold text-[#D0FF00]">{Number.isFinite(total) ? total.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : "0"} BNB</span></div><button onClick={mint} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D0FF00] py-3 font-semibold text-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wallet className="h-4 w-4"/>}{wallet.isConnected ? "立即铸造" : "连接钱包并铸造"}</button></div><div className="flex flex-wrap gap-3"><button onClick={()=>void refresh()} className="flex items-center gap-2 rounded-xl border border-[#25282C] px-4 py-2 text-sm text-white"><RefreshCw className="h-4 w-4"/>刷新数据</button><button onClick={verify} className="rounded-xl border border-[#25282C] px-4 py-2 text-sm text-white">重新提交开源</button><a href={`https://bscscan.com/address/${project.collection}#code`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#25282C] px-4 py-2 text-sm text-white"><ExternalLink className="h-4 w-4"/>BscScan</a></div><p className="break-all text-xs text-[#6B7280]">合集地址：{project.collection}</p></section></div></div>;
}
