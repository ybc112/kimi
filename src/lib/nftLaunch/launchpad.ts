import { Contract, Interface, JsonRpcProvider, formatEther, getAddress, isAddress, parseEther, type Signer } from "ethers";
import type { NFTLaunchDraft, NFTProject } from "./types";

export const DEFAULT_NFT_FACTORY_ADDRESS = "0xd9c7E7Da8F6151FA111d25F33db32BF5c1e5D891";
export const NFT_FACTORY_ADDRESS = String(import.meta.env.VITE_NFT_FACTORY_ADDRESS || DEFAULT_NFT_FACTORY_ADDRESS).trim();
export const NFT_CREATION_FEE = parseEther(String(import.meta.env.VITE_NFT_CREATION_FEE_BNB || "0.01"));
export const nftFactoryAbi = [
  "function createNFTLaunch(string name,string symbol,string description,string imageURI,string baseURI,string metadataURI,uint256 maxSupply,uint256 mintPrice,uint256 maxMintPerWallet,bytes32 salt) payable returns (address collection)",
  "function allCollectionsLength() view returns (uint256)", "function allCollections(uint256) view returns (address)",
  "function projects(address) view returns (address creator,address collection,string description,string imageURI,string metadataURI,uint64 createdAt)",
  "event NFTLaunchCreated(address indexed creator,address indexed collection,string name,string symbol,uint256 maxSupply,uint256 mintPrice,string metadataURI)",
] as const;
export const nftCollectionAbi = ["function mint(uint256 quantity) payable", "function name() view returns (string)", "function symbol() view returns (string)", "function description() view returns (string)", "function imageURI() view returns (string)", "function baseTokenURI() view returns (string)", "function totalMinted() view returns (uint256)", "function maxSupply() view returns (uint256)", "function mintPrice() view returns (uint256)", "function maxMintPerWallet() view returns (uint256)", "function owner() view returns (address)"] as const;
export const isNFTLaunchpadConfigured = isAddress(NFT_FACTORY_ADDRESS);
const backendUrl = String(import.meta.env.VITE_NFT_BACKEND_URL || import.meta.env.VITE_MINT_BACKEND_URL || "https://api.kimi-vault.com").trim().replace(/\/+$/, "");
const nftVanitySuffix = String(import.meta.env.VITE_NFT_VANITY_SUFFIX || "7777").replace(/^0x/i, "").toLowerCase();
export const nftProvider = new JsonRpcProvider(String(import.meta.env.VITE_NFT_RPC_URL || "https://bsc.publicnode.com"), 56);

export async function uploadNFTAsset(dataUrl: string): Promise<string> {
  if (!/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(dataUrl)) throw new Error("NFT 图片格式无效");
  if (!backendUrl) throw new Error("NFT 资产服务未配置，请设置 VITE_NFT_BACKEND_URL");
  const response = await fetch(`${backendUrl}/api/assets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl }) });
  if (!response.ok) throw new Error("NFT 图片上传失败，请稍后重试");
  const result = await response.json() as { url?: string };
  if (!result.url) throw new Error("NFT 图片服务返回地址为空");
  return result.url;
}

export async function queueNFTVerification(collection: string) {
  if (!backendUrl || !isAddress(collection)) return { ok: false, skipped: true };
  const response = await fetch(`${backendUrl}/api/nft/verify-project`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collection }) });
  if (!response.ok) return { ok: false, skipped: true };
  return response.json() as Promise<{ ok: boolean; collection?: string }>;
}

export async function getNFTVerificationStatus(collection: string) {
  if (!isAddress(collection)) return null;
  const response = await fetch(`${backendUrl}/api/nft/verify-status?collection=${encodeURIComponent(collection)}`);
  if (!response.ok) return null;
  const result = await response.json() as { job?: { status?: string; attempts?: number; logs?: string[] } | null };
  return result.job || null;
}

export async function loadNFTProject(collection: string): Promise<NFTProject> {
  if (!isAddress(collection)) throw new Error("NFT 合集地址无效");
  const address = getAddress(collection);
  const factory = new Contract(NFT_FACTORY_ADDRESS, nftFactoryAbi, nftProvider);
  const nft = new Contract(address, nftCollectionAbi, nftProvider);
  const [project, name, symbol, description, imageURI, baseURI, maxSupply, mintPrice, maxMintPerWallet, totalMinted, creator] = await Promise.all([
    factory.projects(address), nft.name(), nft.symbol(), nft.description(), nft.imageURI(), nft.baseTokenURI(),
    nft.maxSupply(), nft.mintPrice(), nft.maxMintPerWallet(), nft.totalMinted(), nft.owner(),
  ]);
  if (String(project.collection || project[1]).toLowerCase() !== address.toLowerCase()) throw new Error("该合集不属于当前 NFT Factory");
  return {
    collection: address, creator: getAddress(String(creator)), name: String(name), symbol: String(symbol),
    description: String(description), imageURI: String(imageURI), baseURI: String(baseURI), metadataURI: String(project.metadataURI || project[4]),
    maxSupply: String(maxSupply), mintPrice: formatEther(mintPrice), maxMintPerWallet: String(maxMintPerWallet),
    totalMinted: String(totalMinted), createdAt: Number(project.createdAt || project[5]),
  };
}

export async function prepareNFTMetadata(draft: NFTLaunchDraft) {
  if (!draft.imageURI.trim()) throw new Error("请先生成或上传 NFT 图片");
  const response = await fetch(`${backendUrl}/api/nft/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: draft.name.trim(), description: draft.description.trim(), image: draft.imageURI.trim() }),
  });
  if (!response.ok) throw new Error("NFT 元数据生成失败，请稍后重试");
  const result = await response.json() as { baseURI?: string; metadataURI?: string };
  if (!result.baseURI || !result.metadataURI) throw new Error("NFT 元数据服务返回不完整");
  return { ...draft, baseURI: result.baseURI, metadataURI: result.metadataURI };
}
export async function createNFTLaunch(signer: Signer, draft: NFTLaunchDraft) {
  if (!isNFTLaunchpadConfigured) throw new Error("NFT Factory 尚未配置，请部署 Factory 后设置 VITE_NFT_FACTORY_ADDRESS");
  if (!draft.name.trim() || !draft.symbol.trim() || !draft.baseURI.trim()) throw new Error("请填写名称、Symbol，并生成 NFT 元数据");
  const maxSupply = BigInt(draft.maxSupply); const maxWallet = BigInt(draft.maxMintPerWallet);
  if (maxSupply <= 0n || maxSupply > 1000000n || maxWallet <= 0n || maxWallet > maxSupply) throw new Error("供应量或钱包上限无效");
  const factory = new Contract(NFT_FACTORY_ADDRESS, nftFactoryAbi, signer);
  const salt = await resolveNFTVanitySalt(draft, await signer.getAddress());
  const tx = await factory.createNFTLaunch(draft.name.trim(), draft.symbol.trim().toUpperCase(), draft.description.trim(), draft.imageURI.trim(), draft.baseURI.trim(), draft.metadataURI.trim(), maxSupply, parseEther(draft.mintPrice || "0"), maxWallet, salt, { value: NFT_CREATION_FEE });
  const receipt = await tx.wait();
  const parsed = new Interface(nftFactoryAbi);
  let collection = "";
  for (const log of receipt?.logs || []) {
    try {
      const event = parsed.parseLog(log);
      if (event?.name === "NFTLaunchCreated") collection = getAddress(String(event.args.collection));
    } catch {
      // A receipt can contain ERC-721 and native transfer logs that do not belong to the Factory ABI.
    }
  }
  return { hash: tx.hash, collection };
}

async function resolveNFTVanitySalt(draft: NFTLaunchDraft, creator: string) {
  if (!nftVanitySuffix) return randomSalt();
  const response = await fetch(`${backendUrl}/api/nft/vanity-salt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creator, suffix: nftVanitySuffix, params: draft }) });
  if (!response.ok) throw new Error("NFT 靓号地址生成失败，请重试");
  const result = await response.json() as { ok?: boolean; salt?: string; collectionAddress?: string };
  if (!result.ok || !result.salt || !result.collectionAddress?.toLowerCase().endsWith(nftVanitySuffix)) throw new Error("NFT 靓号地址生成失败，请重试");
  return result.salt;
}

function randomSalt() { return "0x" + crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), ""); }
export async function mintNFT(signer: Signer, collection: string, quantity: string, mintPrice: string) {
  if (!isAddress(collection)) throw new Error("NFT 合集地址无效");
  const amount = BigInt(quantity); if (amount <= 0n) throw new Error("铸造数量无效");
  const tx = await new Contract(collection, nftCollectionAbi, signer).mint(amount, { value: parseEther(mintPrice || "0") * amount });
  await tx.wait(); return tx.hash as string;
}
