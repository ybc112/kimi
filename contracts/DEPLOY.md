# KIMI 代币部署说明

## 合约

- [KIMI.sol](./KIMI.sol) — ERC20 代币，带 `burn` 和 `mint` 功能
- 精度：18
- 初始供应量：默认 1,000,000,000 KIMI
- 销毁：调用 `burn(uint256)` 或 `transfer` 到销毁地址

## 推荐部署方式（Foundry）

当前仓库没有配置 Foundry，但 `phoenix-dynamic-buyback` 项目已配置好 Foundry + OpenZeppelin，建议从那里部署。

```powershell
cd "E:\dapp\发射台2\phoenix-dynamic-buyback"

# 测试网部署
$env:KIMI_NAME="KIMI"
$env:KIMI_SYMBOL="KIMI"
$env:KIMI_INITIAL_SUPPLY="1000000000"
$env:KIMI_OWNER="0x你的地址"
forge script script/testnet/bnb/DeployKIMI.s.sol --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545 --broadcast --verify -vvvv

# 主网部署
forge script script/mainnet/bnb/DeployKIMI.s.sol --rpc-url https://bsc-dataseed.binance.org/ --broadcast --verify -vvvv
```

## 部署后配置

部署完成后，把合约地址填到前端：

```typescript
// src/lib/contracts/deployer.ts
export const KIMI_TOKEN_ADDRESS: string = "0x你的KIMI合约地址";
```

填好后重新推送，`Deploy` 页面的「销毁并部署」就会真实扣除 20,000 KIMI。

## 注意事项

- 部署需要 BNB 作为 gas
- 部署前建议先领 BSC 测试币在测试网验证一遍
- 不要把私钥写到代码里，使用环境变量或 Foundry 的 `--interactive` / `--private-key` 参数
