# Kimi Flap Vault

Kimi Flap Vault 是一个面向 BNB Smart Chain 的合约生成、Meme 发币、Snowball 发币与自定义合约部署前端。

## 安全修复

- 发币参数会在钱包交易前严格校验，空的隐藏费接收地址自动使用当前钱包。
- 发币会读取链上实时 `createFee`，并先执行 `staticCall` 与 Gas 预检。
- KIMI 平台费改为代币/合约创建成功后再销毁，避免“费用已扣但创建失败”。
- 旧版误配置的 `0x972D...` 是 Snowball 发币 Factory，并不支持 `deploy(bytes,bytes)`；通用工厂模式现默认禁用。
- 合约部署要求真实 creation Bytecode + ABI，可直接导入 Hardhat/Foundry Artifact JSON。
- 钱包支持 BSC、Ethereum、Arbitrum 与 Base 的正确网络切换。
- 底层 ethers 错误改为简短提示，完整技术详情折叠显示，避免移动端被超长交易数据撑开。

## 已配置的 BSC 合约

- Snowball Launchpad：`0x08b6e62c01dcE3eACFc558609427348689c7773E`
- KIMI：`0x7A4b49cCAaDF69C4FCfd2223F8E3e30dAAb9F123`
- 默认分红代币 USDT：`0x55d398326f99059fF775485246999027B3197955`

## 本地运行

```bash
npm ci
npm run dev
```

完整验证：

```bash
npm run verify
```

该命令会依次执行 TypeScript、ESLint、单元测试、KIMI Solidity 编译和生产构建。

## 合约部署

1. 使用 Hardhat、Foundry 或 Remix 编译 Solidity。
2. 在“合约部署”页面导入 Artifact JSON，或填写 creation Bytecode、ABI 与构造参数。
3. 选择目标网络并连接钱包。
4. 页面先执行参数和 Gas 预检，通过后才会请求钱包部署。

通用部署工厂默认关闭。如确有一个实现以下接口的合约，可在 Vercel 环境中配置：

```text
VITE_DEPLOY_FACTORY_ADDRESS=0x...
```

要求接口：

```solidity
function deploy(bytes bytecode, bytes args) external payable returns (address deployed);
function getDeployFee() external view returns (uint256);
```

不要把 Snowball `createToken` Factory 地址填入该变量。

## 费用说明

KIMI 销毁和外部 Factory 创建无法由纯前端合并成一笔原子交易。当前实现优先保护用户资金：先完成发币/部署，再请求销毁 KIMI。如果平台必须强制原子收费，需要升级链上 Factory，让收费逻辑直接包含在创建交易中。
