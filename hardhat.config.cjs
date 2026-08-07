require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");

function privateKeyAccounts() {
  const privateKey = process.env.PRIVATE_KEY || "";
  if (!privateKey) return [];
  return [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`];
}

module.exports = {
  solidity: {
    compilers: [
      {
        // 默认编译器。游戏合约 CapyGameVault 已用 0.8.28 部署并在 BscScan 开源，
        // 不要动这个版本，否则以后重新验证会对不上。
        version: "0.8.28",
        preferWasm: false,
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        // mint 系列必须用 0.8.36 —— 链上部署的就是这个版本（metadata 里 000824）
        version: "0.8.36",
        preferWasm: true,
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      // 注意：runs 与 details 必须和 BananaTokenDeployer 的 job 完全一致——
      // 部署器内嵌的 BananaToken 代码按 runs=1 编译，挖盐的 initCodeHash
      // 用同一设置生成的 artifacts 才能匹配。
      "contracts/tokenfactory/BananaToken.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", debug: { revertStrings: "strip" }, optimizer: { enabled: true, runs: 1, details: { yul: true } } },
      },
      // runs=1 压缩，使内嵌 BananaToken creation code 后总字节 < 24576
      "contracts/tokenfactory/BananaTokenDeployer.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", debug: { revertStrings: "strip" }, optimizer: { enabled: true, runs: 1, details: { yul: true } } },
      },
      // evmVersion=cancun 后 viaIR 无 YulException（paris 才有栈深 bug）
      "contracts/tokenfactory/TokenFactory.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/FixedSupplyToken.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200, details: { yul: true } } },
      },
      "contracts/KIMI.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200, details: { yul: true } } },
      },
      "contracts/mocks/MockUniswap.sol": {
        version: "0.8.24",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200, details: { yul: true } } },
      },
      // ⚠️⚠️ 下面这 5 个 mint 合约必须是 0.8.36 + viaIR + runs 200，
      //       不要加 evmVersion，不要加 optimizer.details ——
      //       链上 factory 0xE1CD783b… 就是用这套设置部署的。
      //       改动任何一项都会让「靓号 CREATE2 预测地址」算错，
      //       导致所有创建交易 revert InvalidTokenSuffix。
      //       另外：hardhat 重新编译也复现不出链上那份 init code（metadata 哈希不同），
      //       服务器上算靓号用的是 /root/kimimint/pristine/KimiMintToken.chain-exact.json，
      //       千万不要用本地 artifacts 去覆盖服务器的那一份。
      //       校验命令：node scripts/check-kimimint-initcode.cjs
      //       注：hardhat 编译 mint 系列时必须带 evmVersion cancun，否则 0.8.36 会报 YulException；
      //       但这也意味着 hardhat 产出的 mint artifacts 只能作参考，不等于链上那份。
      "contracts/mint/KimiMintToken.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/mint/KimiMintLaunchFactory.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/mint/KimiMintVault.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/mint/KimiMintDeployers.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/mint/KimiMintAuditRegistry.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/nft/KimiNFTCollection.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      "contracts/nft/KimiNFTLaunchFactory.sol": {
        version: "0.8.36",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
      // 游戏合约钉死在部署时用的版本
      "contracts/game/CapyGameVault.sol": {
        version: "0.8.28",
        settings: { viaIR: true, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhat: {},
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com",
      chainId: 56,
      accounts: privateKeyAccounts(),
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
      chainId: 97,
      accounts: privateKeyAccounts(),
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || "",
    customChains: [],
  },
  sourcify: {
    enabled: false,
  },
};
