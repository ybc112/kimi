import { useState } from "react";
import { Image as ImageIcon, Loader2, Rocket, Upload } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { generateImage, sendChatMessage, DEFAULT_MODEL } from "@/lib/kimi";
import { createNFTLaunch, isNFTLaunchpadConfigured, NFT_CREATION_FEE, prepareNFTMetadata, queueNFTVerification, uploadNFTAsset } from "@/lib/nftLaunch/launchpad";
import { formatEther } from "ethers";

type FormState = { name: string; symbol: string; description: string; imageURI: string; baseURI: string; metadataURI: string; maxSupply: string; mintPrice: string; maxMintPerWallet: string; prompt: string };
const initialForm: FormState = { name: "", symbol: "", description: "", imageURI: "", baseURI: "", metadataURI: "", maxSupply: "1000", mintPrice: "0.01", maxMintPerWallet: "10", prompt: "" };

export default function NFTLaunch() {
  const wallet = useWallet(); const { showToast } = useAppStore();
  const [form, setForm] = useState<FormState>(initialForm); const [busy, setBusy] = useState(""); const [result, setResult] = useState("");
  const update = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const uploadLocalImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { showToast({ type: "error", message: "请选择图片文件" }); return; }
    if (file.size > 8 * 1024 * 1024) { showToast({ type: "error", message: "图片不能超过 8MB" }); return; }
    setBusy("upload");
    try {
      const dataUrl = await compressNFTImage(file);
      update("imageURI", await uploadNFTAsset(dataUrl)); showToast({ type: "success", message: "本地 NFT 图片上传成功" });
    } catch (e) { showToast({ type: "error", message: e instanceof Error ? e.message : "图片上传失败" }); } finally { setBusy(""); }
  };
  const generate = async () => { setBusy("image"); try { const source = await generateImage({ prompt: form.prompt || `NFT collection artwork for ${form.name || "Kimi"}, square, clean, premium` }); const blob = await (await fetch(source)).blob(); const dataUrl = await compressNFTImage(new File([blob], "ai-nft.png", { type: blob.type || "image/png" })); update("imageURI", await uploadNFTAsset(dataUrl)); showToast({ type: "success", message: "AI NFT 图片生成并上传成功" }); } catch (e) { showToast({ type: "error", message: e instanceof Error ? e.message : "生图失败" }); } finally { setBusy(""); } };
  const describe = async () => { setBusy("text"); try { const text = await sendChatMessage({ model: DEFAULT_MODEL, messages: [{ role: "user", content: `为 NFT 合集 ${form.name} 写一段 80 字以内中文介绍，主题：${form.prompt}` }], stream: false }); update("description", text.trim()); } catch (e) { showToast({ type: "error", message: e instanceof Error ? e.message : "文案生成失败" }); } finally { setBusy(""); } };
  const deploy = async () => { if (!wallet.isConnected || !wallet.signer) { await wallet.connectWallet(); return; } if (!wallet.isBSC) { await wallet.switchToBSC(); return; } setBusy("deploy"); try { const prepared = await prepareNFTMetadata(form); setForm((prev) => ({ ...prev, baseURI: prepared.baseURI, metadataURI: prepared.metadataURI })); const res = await createNFTLaunch(wallet.signer, prepared); setResult(res.collection); if (res.collection) void queueNFTVerification(res.collection); showToast({ type: "success", message: "NFT 合集创建成功，源码验证已提交" }); } catch (e) { showToast({ type: "error", message: e instanceof Error ? e.message : "创建失败" }); } finally { setBusy(""); } };
  const fields: Array<[keyof FormState, string]> = [["name", "合集名称"], ["symbol", "Symbol"], ["description", "合集描述"], ["prompt", "图片主题/提示词"], ["maxSupply", "总供应量"], ["mintPrice", "单枚铸造价 BNB"], ["maxMintPerWallet", "单钱包上限"]];
  return <div className="mx-auto max-w-5xl space-y-6"><div><p className="text-sm text-[#9CA3AF]">NFT Deployer + Factory</p><h1 className="text-3xl font-bold text-white">创建 NFT 合集</h1><p className="mt-2 text-sm text-[#9CA3AF]">工厂手续费 {formatEther(NFT_CREATION_FEE)} BNB + Gas。图片支持 AI 生图，也支持上传本地图片。</p></div><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-4 rounded-2xl border border-[#25282C] bg-[#111215] p-5">{fields.map(([key, label]) => <label key={key} className="block"><span className="mb-1 block text-xs text-[#9CA3AF]">{label}</span>{key === "description" || key === "prompt" ? <textarea value={form[key]} onChange={(e) => update(key, e.target.value)} rows={3} className="w-full rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3 text-sm text-white" /> : <input value={form[key]} onChange={(e) => update(key, e.target.value)} className="w-full rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3 text-sm text-white" />}</label>)}<div className="flex flex-wrap gap-3"><button onClick={generate} disabled={!!busy} className="rounded-xl border border-[#D0FF00]/40 px-4 py-2 text-sm text-[#D0FF00]">{busy === "image" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <ImageIcon className="inline h-4 w-4" />} AI 生图</button><label className="cursor-pointer rounded-xl border border-[#25282C] px-4 py-2 text-sm text-white"><Upload className="mr-1 inline h-4 w-4" />{busy === "upload" ? "上传中..." : "上传本地图片"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLocalImage(file); e.currentTarget.value = ""; }} /></label><button onClick={describe} disabled={!!busy} className="rounded-xl border border-[#25282C] px-4 py-2 text-sm text-white">生成描述</button><button onClick={deploy} disabled={!!busy || !isNFTLaunchpadConfigured} className="rounded-xl bg-[#D0FF00] px-5 py-2 text-sm font-semibold text-black"><Rocket className="mr-1 inline h-4 w-4" />一键创建</button></div>{!isNFTLaunchpadConfigured && <p className="text-xs text-amber-300">NFT Factory 尚未配置，请先完成 Factory 部署。</p>}{result && <p className="break-all rounded-xl bg-[#D0FF00]/10 p-3 text-sm text-[#D0FF00]">合集地址：{result}</p>}</div><div className="rounded-2xl border border-[#25282C] bg-[#111215] p-5">{form.imageURI ? <img src={form.imageURI} className="aspect-square w-full rounded-2xl object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#0A0B0D] text-sm text-[#6B7280]">NFT 图片预览</div>}<p className="mt-4 text-xs leading-5 text-[#6B7280]">AI 图片和本地图片都会先上传到公开资产服务，再写入 NFT 合集参数。</p></div></div></div>;
}

function compressNFTImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image(); const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(1024, Math.max(image.naturalWidth, image.naturalHeight));
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d"); if (!context) { reject(new Error("无法压缩图片")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58, 0.46]) { const output = canvas.toDataURL("image/webp", quality); if (output.length < 340000) { resolve(output); return; } }
      reject(new Error("图片压缩后仍然过大，请选择内容更简单的图片"));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("图片无法读取")); };
    image.src = objectUrl;
  });
}
