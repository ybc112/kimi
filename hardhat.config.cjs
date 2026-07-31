require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
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
