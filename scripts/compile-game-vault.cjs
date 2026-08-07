const fs = require("fs"), path = require("path"), solc = require("solc");
const ROOT = process.cwd(), NM = path.join(ROOT, "node_modules");
const ENTRY = "contracts/game/CapyGameVault.sol";
const sources = {}, seen = new Set();
(function add(name) {
  if (seen.has(name)) return; seen.add(name);
  const p = name.startsWith("@") ? path.join(NM, name) : path.join(ROOT, name);
  const content = fs.readFileSync(p, "utf8");
  sources[name] = { content };
  const re = /import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g; let m;
  while ((m = re.exec(content))) {
    let d = m[1];
    if (d.startsWith(".")) d = path.posix.normalize(path.posix.join(path.posix.dirname(name), d));
    add(d);
  }
})(ENTRY);
const input = {
  language: "Solidity",
  sources,
  settings: {
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
console.log("solc", solc.version(), "| 源文件", Object.keys(sources).length);
console.time("编译");
const out = JSON.parse(solc.compile(JSON.stringify(input)));
console.timeEnd("编译");
const errs = (out.errors || []).filter(e => e.severity === "error");
const warns = (out.errors || []).filter(e => e.severity !== "error");
for (const w of warns) console.log("⚠️ ", (w.formattedMessage || w.message).split("\n").slice(0, 3).join("\n"));
if (errs.length) {
  console.log("\n❌ 编译错误", errs.length, "个:");
  for (const e of errs) console.log((e.formattedMessage || e.message).split("\n").slice(0, 6).join("\n"), "\n");
  process.exit(1);
}
const c = out.contracts[ENTRY].CapyGameVault;
const dep = c.evm.deployedBytecode.object;
console.log("\n✅ 编译通过");
console.log("   runtime 大小:", dep.length / 2, "字节（上限 24576）");
console.log("   init 大小   :", c.evm.bytecode.object.length / 2, "字节");
fs.mkdirSync("artifacts/contracts/game/CapyGameVault.sol", { recursive: true });
fs.writeFileSync("artifacts/contracts/game/CapyGameVault.sol/CapyGameVault.json", JSON.stringify({
  _format: "hh-sol-artifact-1", contractName: "CapyGameVault", sourceName: ENTRY, abi: c.abi,
  bytecode: "0x" + c.evm.bytecode.object, deployedBytecode: "0x" + dep,
  linkReferences: {}, deployedLinkReferences: {},
}, null, 2));
fs.writeFileSync("artifacts/contracts/game/CapyGameVault.sol/verify-input.json", JSON.stringify(input));
console.log("   artifact 已写入 artifacts/contracts/game/CapyGameVault.sol/");
const fns = c.abi.filter(x => x.type === "function").map(x => x.name);
console.log("   外部函数:", fns.join(", "));
