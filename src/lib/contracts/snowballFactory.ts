import { ethers } from "ethers";

export const SNOWBALL_FACTORY_ADDRESS = import.meta.env.VITE_SNOWBALL_FACTORY_ADDRESS || "";
export const SNOWBALL_PLATFORM_SHARE_BPS = 2000;
export const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

export interface SnowballFactoryFormValues {
  name: string;
  symbol: string;
  totalSupply: string;
  fundAddress: string;
  rewardToken: string;
  totalBuyTax: string;
  totalSellTax: string;
  rewardShare: string;
  liquidityShare: string;
  burnShare: string;
  fundShare: string;
  maxBuyAmount: string;
  maxSellAmount: string;
  maxWalletAmount: string;
  dividendThreshold: string;
  lpBurnFrequency: string;
  lpBurnPercent: string;
  enableOffTrade: boolean;
  secondTime: string;
  killBlocks: string;
}

export const DEFAULT_SNOWBALL_FACTORY_FORM: SnowballFactoryFormValues = {
  name: "", symbol: "", totalSupply: "100000000", fundAddress: "", rewardToken: BSC_USDT,
  totalBuyTax: "5", totalSellTax: "5", rewardShare: "50", liquidityShare: "20",
  burnShare: "30", fundShare: "0", maxBuyAmount: "0", maxSellAmount: "0",
  maxWalletAmount: "0", dividendThreshold: "200000", lpBurnFrequency: "3600",
  lpBurnPercent: "0.5", enableOffTrade: true, secondTime: "0", killBlocks: "0",
};

export const SNOWBALL_FACTORY_ABI = [
  "function creationFee() view returns (uint256)",
  "function tokenDeployer() view returns (address)",
  "function requiredTokenSuffix() view returns (uint16)",
  "function previewFees(uint256,uint256,uint256,uint256,uint256,uint256) view returns ((uint256 platformFee,uint256 rewardFee,uint256 liquidityFee,uint256 burnFee,uint256 fundFee),(uint256 platformFee,uint256 rewardFee,uint256 liquidityFee,uint256 burnFee,uint256 fundFee))",
  "function buildParams((string name,string symbol,uint256 totalSupply,address receiver,address fundAddress,address rewardToken,address currency,uint256 totalBuyTax,uint256 totalSellTax,uint256 rewardShare,uint256 liquidityShare,uint256 burnShare,uint256 fundShare,uint256 maxBuyAmount,uint256 maxSellAmount,uint256 maxWalletAmount,uint256 secondTime,uint256 killBlocks,uint256 airdropNumbs,uint256 transferFee,uint256 mushHoldNum,uint256 lpBurnFrequency,uint256 percentForLPBurn,bool enableOffTrade),bool) view returns (string[],address[],uint256[],bool[])",
  "function createToken((string name,string symbol,uint256 totalSupply,address receiver,address fundAddress,address rewardToken,address currency,uint256 totalBuyTax,uint256 totalSellTax,uint256 rewardShare,uint256 liquidityShare,uint256 burnShare,uint256 fundShare,uint256 maxBuyAmount,uint256 maxSellAmount,uint256 maxWalletAmount,uint256 secondTime,uint256 killBlocks,uint256 airdropNumbs,uint256 transferFee,uint256 mushHoldNum,uint256 lpBurnFrequency,uint256 percentForLPBurn,bool enableOffTrade),bytes32) payable returns (address)",
  "function createTokenAndAddLiquidity((string name,string symbol,uint256 totalSupply,address receiver,address fundAddress,address rewardToken,address currency,uint256 totalBuyTax,uint256 totalSellTax,uint256 rewardShare,uint256 liquidityShare,uint256 burnShare,uint256 fundShare,uint256 maxBuyAmount,uint256 maxSellAmount,uint256 maxWalletAmount,uint256 secondTime,uint256 killBlocks,uint256 airdropNumbs,uint256 transferFee,uint256 mushHoldNum,uint256 lpBurnFrequency,uint256 percentForLPBurn,bool enableOffTrade),bytes32,uint256,uint256) payable returns (address)",
  "event TokenCreated(address indexed creator,address indexed token,string name,string symbol,uint256 totalSupply,uint256 buyRewardFee,uint256 buyLiquidityFee,uint256 buyBurnFee,uint256 buyFundFee,uint256 sellRewardFee,uint256 sellLiquidityFee,uint256 sellBurnFee,uint256 sellFundFee,uint256 maxBuyAmount,uint256 maxSellAmount,uint256 maxWalletAmount,uint256 lpBurnFrequency,uint256 percentForLPBurn,bool addLiquidity)",
];

const toBps = (value: string) => BigInt(Math.round(Number(value || "0") * 100));
const toUnits = (value: string) => ethers.parseUnits(value || "0", 18);

export function buildSnowballLaunchParams(form: SnowballFactoryFormValues, receiver: string) {
  if (!ethers.isAddress(receiver)) throw new Error("请先连接有效钱包");
  if (!form.name.trim() || !form.symbol.trim()) throw new Error("请填写代币名称和符号");
  const shares = [form.rewardShare, form.liquidityShare, form.burnShare, form.fundShare].map(toBps);
  if (shares.reduce((a, b) => a + b, 0n) !== 10000n) throw new Error("剩余税费分配比例必须合计 100%");
  const totalBuyTax = toBps(form.totalBuyTax);
  const totalSellTax = toBps(form.totalSellTax);
  if (totalBuyTax <= 0n || totalBuyTax > 2500n || totalSellTax <= 0n || totalSellTax > 2500n) throw new Error("买卖总税必须在 0% 到 25% 之间");
  const burnPercent = toBps(form.lpBurnPercent);
  if (burnPercent <= 0n || burnPercent > 100n) throw new Error("单次 LP 燃烧必须大于 0 且不超过 1%");
  if (BigInt(form.lpBurnFrequency || "0") < 3600n) throw new Error("LP 燃烧间隔不能少于 3600 秒");
  const fundAddress = form.fundAddress.trim() ? ethers.getAddress(form.fundAddress) : ethers.getAddress(receiver);
  const rewardToken = ethers.getAddress(form.rewardToken || BSC_USDT);
  return {
    name: form.name.trim(), symbol: form.symbol.trim().toUpperCase(), totalSupply: toUnits(form.totalSupply),
    receiver: ethers.getAddress(receiver), fundAddress, rewardToken, currency: ethers.ZeroAddress,
    totalBuyTax, totalSellTax, rewardShare: shares[0], liquidityShare: shares[1], burnShare: shares[2], fundShare: shares[3],
    maxBuyAmount: toUnits(form.maxBuyAmount), maxSellAmount: toUnits(form.maxSellAmount), maxWalletAmount: toUnits(form.maxWalletAmount),
    secondTime: BigInt(form.secondTime || "0"), killBlocks: BigInt(form.killBlocks || "0"), airdropNumbs: 0n, transferFee: 0n,
    mushHoldNum: toUnits(form.dividendThreshold), lpBurnFrequency: BigInt(form.lpBurnFrequency), percentForLPBurn: burnPercent,
    enableOffTrade: form.enableOffTrade,
  };
}

export function validateLiquidityInputs(totalSupply: string, lpTokens: string, lpBnb: string) {
  const supply = toUnits(totalSupply);
  const tokens = toUnits(lpTokens);
  const bnb = ethers.parseEther(lpBnb || "0");
  if (tokens <= 0n || tokens > supply) throw new Error("加池代币必须大于 0 且不能超过总供应量");
  if (bnb <= 0n) throw new Error("加池 BNB 必须大于 0");
  return { tokens, bnb };
}

export async function mineSnowballSalt(
  factory: ethers.Contract,
  params: ReturnType<typeof buildSnowballLaunchParams>,
  withLiquidity: boolean,
  onProgress?: (attempts: number) => void,
) {
  const suffix = Number(await factory.requiredTokenSuffix());
  const [stringParams, addressParams, numberParams, boolParams] = await factory.buildParams(params, withLiquidity);
  const deployerAddress = await factory.tokenDeployer();
  const artifactResponse = await fetch("/artifacts/BananaToken.json");
  if (!artifactResponse.ok) throw new Error("未找到 BananaToken 部署产物，无法计算靓号 salt");
  const artifact = await artifactResponse.json() as { bytecode: string };
  const args = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string[]", "address[]", "uint256[]", "bool[]", "uint256[]"],
    [stringParams, addressParams, numberParams, boolParams, []]
  );
  const initCodeHash = ethers.keccak256(ethers.concat([artifact.bytecode, args]));
  if (suffix === 0) return ethers.hexlify(ethers.randomBytes(32));
  for (let attempt = 1; attempt <= 2_000_000; attempt += 1) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(attempt), 32);
    const predicted = ethers.getCreate2Address(deployerAddress, salt, initCodeHash);
    if ((Number(BigInt(predicted) & 0xffffn)) === suffix) return salt;
    if (attempt % 5000 === 0) onProgress?.(attempt);
  }
  throw new Error("暂未找到符合靓号后缀的 salt，请重试");
}

export function previewSnowballFees(form: SnowballFactoryFormValues) {
  const split = (tax: string) => {
    const total = Number(tax || 0);
    const platform = total * 0.2;
    const left = total - platform;
    return {
      total, platform,
      reward: left * Number(form.rewardShare || 0) / 100,
      liquidity: left * Number(form.liquidityShare || 0) / 100,
      burn: left * Number(form.burnShare || 0) / 100,
      fund: left * Number(form.fundShare || 0) / 100,
    };
  };
  return { buy: split(form.totalBuyTax), sell: split(form.totalSellTax) };
}
