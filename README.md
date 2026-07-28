# Kimi Flap Vault

Kimi Flap Vault 是一个面向 BNB Smart Chain 的合约生成、Meme 发币、Snowball 发币与自定义合约部署前端。

## 安全修复

- 发币参数会在钱包交易前严格校验，空的隐藏费接收地址自动使用当前钱包。
- 发币会读取链上实时 `createFee`，并先执行 `staticCall` 与 Gas 预检。
- 当前主网 Factory 的实时 `createFee()` 为 `0`；页面显示“当前免创建费（0 BNB）”，不会把读取失败伪装成 0.0000 或源码默认值。
- KIMI 平台费改为代币/合约创建成功后再销毁，避免“费用已扣但创建失败”。
- “工厂部署”已改为专用 Snowball 发币流程，直接调用 `SnowballLaunchpad.createToken`，不再错误调用 `deploy(bytes,bytes)`。
- 页面会核对 Factory 主网运行时代码哈希；不匹配 `SnowballLaunchpad.sol` 时会阻止交易。
- 发币成功后的本地记录使用有上限的安全缓存；AI 图片会压缩为缩略图，浏览器存储满额时也不会把链上成功误报为失败。
- Render 静态部署会为所有 React 路由生成真实入口文件，直接刷新 `/meme-launch`、`/deploy` 等页面不再返回 404。
- 品牌 Logo 已替换为透明 SVG，移动端不再出现 JPG 白色边框。
- 合约部署要求真实 creation Bytecode + ABI，可直接导入 Hardhat/Foundry Artifact JSON。
- 合约部署内置“固定总量”和“可增发 / 可销毁”两个已编译 ERC-20 模板，并实时显示 3 项部署就绪检查。
- 钱包支持 BSC、Ethereum、Arbitrum 与 Base 的正确网络切换。
- 底层 ethers 错误改为简短提示，完整技术详情折叠显示，避免移动端被超长交易数据撑开。

## 已配置的 BSC 合约

- Snowball Launchpad：`0x08b6e62c01dcE3eACFc558609427348689c7773E`
- KIMI：`0x7A4b49cCAaDF69C4FCfd2223F8E3e30dAAb9F123`
- 默认分红代币 USDT：`0x55d398326f99059fF775485246999027B3197955`
- Snowball Launchpad 运行时代码哈希：`0x9adb672620bf25cc185a47d22a400f8298ef9a350923eff628e7fda5820b4fcc`

## 本地运行

```bash
npm ci
npm run dev
```

完整验证：

```bash
npm run verify
```

该命令会依次执行 TypeScript、ESLint、单元测试、两个 Solidity 模板编译、模板一致性检查和生产构建。

## 合约部署

### 内置 ERC-20 模板

1. 打开“合约部署”，选择“固定总量 ERC-20”或“可增发 / 可销毁 ERC-20”。
2. 填写代币名称、符号和完整代币数量；页面会自动填充 creation Bytecode、ABI 与构造参数。
3. 等待“部署就绪检查”显示 `3/3`，选择网络并连接钱包。
4. 点击“钱包直接部署”。钱包发送交易前还会执行一次链上 Gas 预检。

### 自定义合约 / Artifact

1. 使用 Hardhat、Foundry 或 Remix 编译 Solidity。
2. 在“合约部署”页面导入单个合约 Artifact JSON，或填写 creation Bytecode、ABI 与构造参数。
3. 页面支持 Hardhat、Foundry，以及只包含一个可部署合约的 solc 标准 JSON 输出；多合约输出请先导出目标合约 Artifact。
4. 选择目标网络并连接钱包；参数和 Gas 预检通过后才会请求钱包部署。

### Snowball 工厂发币

1. 打开“合约部署”，在“部署方式”中选择“工厂部署”。
2. 填写名称、符号和整数总量；高级参数可配置税率、分红代币、白名单和限额。
3. 页面固定使用已核验的 BSC `SnowballLaunchpad`，先执行运行时代码校验、`staticCall` 和 Gas 预检。
4. SnowballToken 的 `decimals()` 固定为 `0`，总供应量不要乘 `10^18`。
5. Factory 源码初始创建费为 `0.005 BNB`，但 owner 可链上修改；页面始终以交易前读取的实时 `createFee()` 为准。实时值为 0 时会显示“当前免创建费（0 BNB）”，网络 Gas 仍需用 BNB 支付。

## 费用说明

KIMI 销毁和外部 Factory 创建无法由纯前端合并成一笔原子交易。当前实现优先保护用户资金：先完成发币/部署，再请求销毁 KIMI。如果平台必须强制原子收费，需要升级链上 Factory，让收费逻辑直接包含在创建交易中。

## Snowball 合约核对提示

- `SnowballLaunchpad` 主网运行时代码与外部项目 artifact 的哈希已核对一致；前端交易前也会再次核对。
- `createFee`、`feeReceiver` 和默认分红币由 Factory owner 管理，费用可能随时变化；以交易前链上读取为准。
- `SnowballToken.decimals()` 固定为 `0`，且 owner 仍可在代币创建后调整税率、交易对和路由，这是合约本身的管理权限，不是前端可消除的风险。
