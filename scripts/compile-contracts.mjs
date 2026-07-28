import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();
const contracts = [
  { entry: "contracts/KIMI.sol", contractName: "KIMI" },
  { entry: "contracts/FixedSupplyToken.sol", contractName: "FixedSupplyToken" },
];

function readSoliditySource(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
}

const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    contracts.map(({ entry }) => [entry, { content: readSoliditySource(path.join(projectRoot, entry)) }])
  ),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

function findImports(importPath) {
  const candidates = [
    path.join(projectRoot, importPath),
    path.join(projectRoot, "contracts", importPath),
    path.join(projectRoot, "node_modules", importPath),
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  return resolved
    ? { contents: readSoliditySource(resolved) }
    : { error: `Import not found: ${importPath}` };
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = output.errors || [];
for (const issue of errors) {
  const message = issue.formattedMessage || issue.message;
  if (issue.severity === "error") console.error(message);
  else console.warn(message);
}
if (errors.some((issue) => issue.severity === "error")) process.exit(1);

for (const { entry, contractName } of contracts) {
  const artifact = output.contracts?.[entry]?.[contractName];
  if (!artifact?.evm?.bytecode?.object) throw new Error(`${contractName} compilation produced no creation bytecode`);
  console.log(`${contractName} compiled successfully (${artifact.evm.bytecode.object.length / 2} creation bytes).`);
}
