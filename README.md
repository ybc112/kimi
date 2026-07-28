# Kimi Flap Vault

Kimi Flap Vault 是一个面向 BNB Smart Chain 的合约生成、KIMI 普通发币与自定义合约部署前端。

## 安全修复

- 发币参数会在钱包交易前严格校验，空的隐藏费接收地址自动使用当前钱包。
- 发币会读取链上实时 `createFee`，并先执行 `staticCall` 与 Gas 预检。
- 当前主网 Factory 的实时 `createFee()` 为 `0`；页面显示“当前免创建费（0 BNB）”，不会把读取失败伪装成 0.0000 或源码默认值。
- BSC 发币/部署会先完成静态调用与 Gas 预检，再销毁 20,000 KIMI，移除不扣 KIMI 的 BSC 直接部署入口。
- “工厂部署”使用 KIMI 品牌的普通发币流程，底层调用已核验的 `SnowballLaunchpad.createToken`，不再错误调用 `deploy(bytes,bytes)`。
- 页面会核对 Factory 主网运行时代码哈希；不匹配 `SnowballLaunchpad.sol` 时会阻止交易。
- DeepSeek 与生图接口要求钱包签名、至少持有 20,000 KIMI，并使用 10 分钟短会话；服务端按钱包和 IP 限流，同时锁定模型、请求长度与生图次数。
- 上游 API Key 仅从 Supabase Secrets 读取；`npm run verify` 会扫描当前代码，阻止常见 API Key、GitHub Token 和私钥再次提交。
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

该命令会依次执行密钥扫描、TypeScript、ESLint、单元测试、两个 Solidity 模板编译、模板一致性检查和生产构建。

## 合约部署

### 内置 ERC-20 模板

1. 打开“合约部署”，选择“固定总量 ERC-20”或“可增发 / 可销毁 ERC-20”。
2. 填写代币名称、符号和完整代币数量；页面会自动填充 creation Bytecode、ABI 与构造参数。
3. 等待“部署就绪检查”显示 `3/3`，选择网络并连接钱包。
4. BSC 部署会先完成 Gas 预检，再依次请求钱包确认销毁 20,000 KIMI 和部署交易。
5. Ethereum、Arbitrum 与 Base 因没有 KIMI 合约，暂时保留跨链钱包直接部署入口。

### 自定义合约 / Artifact

1. 使用 Hardhat、Foundry 或 Remix 编译 Solidity。
2. 在“合约部署”页面导入单个合约 Artifact JSON，或填写 creation Bytecode、ABI 与构造参数。
3. 页面支持 Hardhat、Foundry，以及只包含一个可部署合约的 solc 标准 JSON 输出；多合约输出请先导出目标合约 Artifact。
4. 选择目标网络并连接钱包；参数和 Gas 预检通过后才会请求钱包部署。

### KIMI 普通工厂发币

1. 打开“合约部署”，在“部署方式”中选择“工厂部署”。
2. 填写名称、符号和整数总量；高级参数可配置税率、分红代币、白名单和限额。
3. 页面固定使用已核验的 BSC 普通发币工厂，先执行运行时代码校验、`staticCall` 和 Gas 预检。
4. SnowballToken 的 `decimals()` 固定为 `0`，总供应量不要乘 `10^18`。
5. Factory 源码初始创建费为 `0.005 BNB`，但 owner 可链上修改；页面始终以交易前读取的实时 `createFee()` 为准。实时值为 0 时会显示“当前免创建费（0 BNB）”，网络 Gas 仍需用 BNB 支付。

## 费用说明

KIMI 销毁和外部 Factory 创建无法由纯前端合并成一笔原子交易。为了防止用户在创建成功后取消 KIMI 交易来绕过费用，当前实现会先完成全部预检，再销毁 KIMI，最后执行发币/部署。因此钱包需要确认两笔交易；KIMI 销毁确认后不可撤销。如果需要真正的原子收费与失败自动回滚，仍需部署新的链上包装 Factory。

## AI API 安全

- 浏览器中只有 Supabase publishable key；DeepSeek 和生图供应商 Key 不进入前端构建。
- AI 请求先由钱包签名换取 10 分钟短会话，服务端会读取 BSC 上的 KIMI 持仓，默认要求至少 20,000 KIMI。
- DeepSeek 默认每钱包每分钟最多 6 次；生图默认每钱包每 10 分钟最多 2 次，并额外执行 IP 限流。
- 可通过 Supabase Secret `BLOCKED_IPS` 立即封禁已确认的盗刷来源 IP；钱包签名和 KIMI 持仓校验仍会同时执行。
- 旧版供应商 Key 曾进入 Git 历史，必须在供应商后台作废并生成新 Key；删除代码不能让已经泄露的 Key 恢复安全。

## Snowball 合约核对提示

- `SnowballLaunchpad` 主网运行时代码与外部项目 artifact 的哈希已核对一致；前端交易前也会再次核对。
- `createFee`、`feeReceiver` 和默认分红币由 Factory owner 管理，费用可能随时变化；以交易前链上读取为准。
- `SnowballToken.decimals()` 固定为 `0`，且 owner 仍可在代币创建后调整税率、交易对和路由，这是合约本身的管理权限，不是前端可消除的风险。
