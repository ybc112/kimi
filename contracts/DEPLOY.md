# KIMI 代币部署说明

## 合约

- [KIMI.sol](./KIMI.sol) — ERC20 代币，带 `burn` 和 `mint` 功能
- 精度：18
- 初始供应量：默认 1,000,000,000 KIMI
- 销毁：当前官方 KIMI 不提供 `burn(uint256)`，必须调用 `transfer` 转到销毁地址

本次要部署的代币：
- 名称：`kimi666`
- 符号：`KIMI`
- 初始供应量：`1000000000`（10 亿）

---

## 前置准备

1. 确保已安装 Node.js 和 Hardhat 依赖。
2. 确保 `e:\dapp\发射台2\.env` 中 `PRIVATE_KEY` 已填写（带 `0x` 前缀的 64 位十六进制私钥）。
3. 确保该地址有少量 BNB 作为 gas。

---

## 方式一：Hardhat（推荐，已配好环境）

进入 `phoenix-dynamic-buyback` 目录：

```powershell
cd "E:\dapp\发射台2\phoenix-dynamic-buyback"
```

### 测试网部署（先跑一遍验证）

```powershell
$env:KIMI_NAME="kimi666"
$env:KIMI_SYMBOL="KIMI"
$env:KIMI_INITIAL_SUPPLY="1000000000"
$env:TESTNET_RPC_URL="https://bsc-testnet.publicnode.com"
npx hardhat run scripts/deploy-kimi.js --network bsctest
```

### 主网部署

```powershell
$env:KIMI_NAME="kimi666"
$env:KIMI_SYMBOL="KIMI"
$env:KIMI_INITIAL_SUPPLY="1000000000"
$env:RPC_URL="https://bsc-dataseed.binance.org/"
npx hardhat run scripts/deploy-kimi.js --network bsc
```

如果默认 RPC 超时或失败，换以下任一：

```powershell
$env:RPC_URL="https://bsc.publicnode.com/"
# 或
$env:RPC_URL="https://bsc.drpc.org"
```

---

## 方式二：Foundry

如本机已安装 Foundry，可直接用：

```powershell
cd "E:\dapp\发射台2\phoenix-dynamic-buyback"

# 主网
$env:KIMI_NAME="kimi666"
$env:KIMI_SYMBOL="KIMI"
$env:KIMI_INITIAL_SUPPLY="1000000000"
forge script script/mainnet/bnb/DeployKIMI.s.sol --rpc-url https://bsc-dataseed.binance.org/ --broadcast --verify -vvvv

# 测试网
forge script script/testnet/bnb/DeployKIMI.s.sol --rpc-url https://bsc-testnet.publicnode.com --broadcast --verify -vvvv
```

---

## 部署后配置

部署完成后，控制台会输出合约地址，例如：

```
KIMI deployed to: 0x1234...
```

把该地址填到前端：

```typescript
// flap-vault-ai-coder/src/lib/contracts/deployer.ts
export const KIMI_TOKEN_ADDRESS: string = "0x你的KIMI合约地址";
```

填好后重新推送，`Deploy` 页面的「销毁并部署」就会真实扣除 20,000 KIMI。

---

## 注意事项

- 部署需要 BNB 作为 gas。
- 强烈建议先在 BSC 测试网部署验证一遍，再上主网。
- 不要把私钥写到代码里，使用环境变量。
- 若 Hardhat 报 `invalid address` 或超时，通常是 RPC 节点问题，尝试更换 `RPC_URL`。
