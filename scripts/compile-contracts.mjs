import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();
const entry = "contracts/KIMI.sol";
const input = {
  language: "Solidity",
  sources: {
    [entry]: { content: fs.readFileSync(path.join(projectRoot, entry), "utf8") },
  },
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
    ? { contents: fs.readFileSync(resolved, "utf8") }
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

const kimi = output.contracts?.[entry]?.KIMI;
if (!kimi?.evm?.bytecode?.object) throw new Error("KIMI compilation produced no creation bytecode");
console.log(`KIMI contract compiled successfully (${kimi.evm.bytecode.object.length / 2} creation bytes).`);
