// 部署 CapyGameVault（卡皮巴拉闯关金库）
//
// 用法：
//   npx hardhat run scripts/deploy-capy-game-vault.cjs --network bsc
//
// 环境变量（都有默认值，但 signer 强烈建议单独生成一个专用钱包）：
//   GAME_TOKEN_ADDRESS        游戏代币，默认卡皮巴拉 0x8395…7777
//   GAME_VAULT_OWNER          owner，默认部署者
//   GAME_SIGNER_ADDRESS       后端签名钱包地址（★ 不要用 owner / 部署钱包）
//   GAME_TICKET               门票，默认 20000
//   GAME_REVIVE_COST          复活费，默认 20000（不得低于门票一半）
//   GAME_ITEM_COST            道具费，默认 5000（全部销毁）
//   GAME_BASE_REWARD_BPS      基础奖励倍率，默认 18000 = 1.8 倍门票 = 36000
//   GAME_TIER_BONUS_BPS       每档加成，默认 1000 = 门票的 10% = +2000
//   GAME_TIER_BONUS_CAP_BPS   加成封顶，默认 2000 = +20%（最高 40000）
//   GAME_MAX_REWARD_DAY_USER  单人每日领奖上限，默认 200000
//   GAME_MAX_REWARD_DAY_ALL   全局每日领奖上限，默认 5000000
//   GAME_SIG_VALIDITY         签名有效期秒数，默认 600
require("dotenv").config();
const hre = require("hardhat");

const D = {
  token: "0x839578f40b9a79a3fe891dd96079f3083e6e7777", // 卡皮巴拉
  ticket: "20000",
  reviveCost: "20000",
  itemCost: "5000",
  baseRewardBps: 18_000,
  tierBonusBps: 1_000,
  tierBonusCapBps: 2_000,
  maxRewardDayUser: "200000",
  maxRewardDayAll: "5000000",
  sigValidity: 600,
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const P = (v) => hre.ethers.parseUnits(String(v), 18);
  const fmt = (v) => hre.ethers.formatUnits(v, 18);

  const token = process.env.GAME_TOKEN_ADDRESS || D.token;
  const owner = process.env.GAME_VAULT_OWNER || deployer.address;
  const signer = process.env.GAME_SIGNER_ADDRESS || deployer.address;

  const econ = {
    ticket: P(process.env.GAME_TICKET || D.ticket),
    reviveCost: P(process.env.GAME_REVIVE_COST || D.reviveCost),
    itemCost: P(process.env.GAME_ITEM_COST || D.itemCost),
    baseRewardBps: Number(process.env.GAME_BASE_REWARD_BPS || D.baseRewardBps),
    tierBonusBps: Number(process.env.GAME_TIER_BONUS_BPS || D.tierBonusBps),
    tierBonusCapBps: Number(process.env.GAME_TIER_BONUS_CAP_BPS || D.tierBonusCapBps),
  };
  const perUserDay = P(process.env.GAME_MAX_REWARD_DAY_USER || D.maxRewardDayUser);
  const globalDay = P(process.env.GAME_MAX_REWARD_DAY_ALL || D.maxRewardDayAll);
  const sigValidity = Number(process.env.GAME_SIG_VALIDITY || D.sigValidity);

  if (signer.toLowerCase() === owner.toLowerCase()) {
    console.warn("⚠️  signer 和 owner 是同一个地址。签名私钥要放在公网服务器上，");
    console.warn("    强烈建议单独生成一个只用于签名的钱包，避免 owner 权限一起泄露。\n");
  }

  console.log("部署 CapyGameVault");
  console.log("  部署者      ", deployer.address);
  console.log("  游戏代币    ", token);
  console.log("  owner       ", owner);
  console.log("  signer      ", signer);
  console.log("  门票        ", fmt(econ.ticket));
  console.log("  复活费      ", fmt(econ.reviveCost));
  console.log("  道具费(销毁)", fmt(econ.itemCost));
  console.log(
    `  奖励        tier0=${fmt((econ.ticket * BigInt(econ.baseRewardBps)) / 10000n)}` +
      `  每档+${fmt((econ.ticket * BigInt(econ.tierBonusBps)) / 10000n)}` +
      `  封顶=${fmt((econ.ticket * BigInt(econ.baseRewardBps + econ.tierBonusCapBps)) / 10000n)}`,
  );
  console.log("  日限额      单人", fmt(perUserDay), "/ 全局", fmt(globalDay));
  console.log("  签名有效期  ", sigValidity, "秒\n");

  const Vault = await hre.ethers.getContractFactory("CapyGameVault");
  const vault = await Vault.deploy(token, owner, signer, econ, perUserDay, globalDay, sigValidity);
  await vault.waitForDeployment();
  const address = await vault.getAddress();

  console.log("✅ CapyGameVault 部署到:", address);
  console.log("   tier0 奖励", fmt(await vault.rewardOf(0)));
  console.log("   tier1 奖励", fmt(await vault.rewardOf(1)));
  console.log("   tier2 奖励", fmt(await vault.rewardOf(2)), "（之后封顶）");

  console.log("\n后端 .env 加上：");
  console.log(`GAME_VAULT_ADDRESS=${address}`);
  console.log(`GAME_TOKEN_ADDRESS=${token}`);
  console.log(`GAME_SIGNER_ADDRESS=${signer}`);
  console.log(`GAME_SIGNER_PRIVATE_KEY=<签名钱包私钥，只放服务器，不要提交>`);
  console.log("\n前端 .env 加上：");
  console.log(`VITE_GAME_VAULT_ADDRESS=${address}`);
  console.log(`VITE_GAME_TOKEN_ADDRESS=${token}`);
  console.log("\n下一步：给奖池充币");
  console.log(`  1) 先 approve: token.approve("${address}", 数量)`);
  console.log(`  2) 再充值:     vault.fundPool(数量)`);
  console.log("  建议初始奖池 ≥ 400 万（够兜 100 次通关），见 scripts/capy-game-economy.cjs");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
