// 校验「靓号 CREATE2 用的 init code」有没有被改坏
//
// 背景：kimi 发射台的靓号地址是后端拿 KimiMintToken 的 init code 做 CREATE2 预测的。
// 这份 init code 必须和链上 TokenDeployer 里内嵌的那份逐字节一致，
// 否则预测地址就错，合约会 revert InvalidTokenSuffix，所有创建交易失败。
//
// 重要：hardhat 重新编译 **复现不出** 链上那份（metadata 哈希会差 63 个字节），
// 所以线上真正用的是保存下来的那一份。这个脚本就是用来确认它没被覆盖。
//
// 用法：node scripts/check-kimimint-initcode.cjs [artifact 路径]

const fs = require("fs");
const path = require("path");
const { keccak256 } = require("ethers");

// 链上真值（2026-08-05 从 factory 0xE1CD783b… 的 TokenDeployer 抽取并验证）
const EXPECTED = {
  initCodeHash: "0xd72f81cb244b798699f39286bf6f3ab2df458b78e9bd6d24ae169beb4f29ec6a",
  initCodeBytes: 22873,
  runtimeBytes: 14210,
  solc: "0.8.36",
  factory: "0xE1CD783bcE52E8945B0FB539AA106aa35b08879e",
  tokenDeployer: "0xD04e2657846404E530fCb8cB3A5ECa451557464b",
};

const candidates = process.argv[2]
  ? [process.argv[2]]
  : [
      "/root/kimimint/pristine/KimiMintToken.chain-exact.json",
      "/root/kimimint/artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json",
      path.join(__dirname, "..", "artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json"),
    ];

const solcOf = (hex) => {
  const m = hex.match(/64736f6c6343([0-9a-f]{6})/);
  if (!m) return "?";
  return `0.${parseInt(m[1].slice(0, 2), 16)}.${parseInt(m[1].slice(4, 6), 16)}`;
};

let anyOk = false;
console.log("期望值（链上真值）:");
console.log("  initCodeHash", EXPECTED.initCodeHash);
console.log("  init", EXPECTED.initCodeBytes, "字节 | runtime", EXPECTED.runtimeBytes, "字节 | solc", EXPECTED.solc);
console.log("");

for (const p of candidates) {
  if (!fs.existsSync(p)) {
    console.log(`— ${p}\n    文件不存在，跳过`);
    continue;
  }
  let art;
  try {
    art = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (error) {
    console.log(`— ${p}\n    ❌ 读取失败: ${error.message}`);
    continue;
  }
  const init = String(art.bytecode || "");
  const runtime = String(art.deployedBytecode || "").slice(2);
  const hash = init ? keccak256(init) : "";
  const ok = hash === EXPECTED.initCodeHash;
  if (ok) anyOk = true;
  console.log(`— ${p}`);
  console.log(`    initCodeHash ${hash}`);
  console.log(
    `    init ${(init.length - 2) / 2} 字节 | runtime ${runtime.length / 2} 字节 | solc ${solcOf(runtime)}`,
  );
  console.log(`    ${ok ? "✅ 与链上一致，靓号能算对" : "❌ 与链上不一致，用这份算靓号会 revert InvalidTokenSuffix"}`);
}

console.log("");
if (anyOk) {
  console.log("✅ 至少有一份是链上精确版本。确认后端读的是这一份即可。");
} else {
  console.log("❌ 没有任何一份和链上一致！");
  console.log("   恢复办法：从 /root/kimimint-backups/*/mint-artifacts/KimiMintToken.sol/KimiMintToken.json");
  console.log("   或 /root/kimimint/pristine/KimiMintToken.chain-exact.json 拷回去。");
  process.exitCode = 1;
}
