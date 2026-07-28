import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, "src/lib/contracts/deployTemplates.generated.json");
const definitions = [
  {
    id: "fixed-supply",
    entry: "contracts/FixedSupplyToken.sol",
    contractName: "FixedSupplyToken",
    title: "固定总量 ERC-20",
    description: "部署时一次性铸造全部代币，之后不能增发；持币人可以销毁自己的代币。",
    supplyMode: "wholeTokens",
  },
  {
    id: "mintable-burnable",
    entry: "contracts/KIMI.sol",
    contractName: "KIMI",
    title: "可增发 / 可销毁 ERC-20",
    description: "Owner 可以增发，持币人可以销毁；适合需要后续流动性或激励发放的项目。",
    supplyMode: "baseUnits",
  },
];

function readSoliditySource(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
}

const sources = Object.fromEntries(
  definitions.map(({ entry }) => [entry, { content: readSoliditySource(path.join(projectRoot, entry)) }])
);
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object"] },
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

const templates = definitions.map((definition) => {
  const artifact = output.contracts?.[definition.entry]?.[definition.contractName];
  const object = artifact?.evm?.bytecode?.object;
  if (!artifact?.abi || !object) throw new Error(`${definition.contractName} template compilation failed`);
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    contractName: definition.contractName,
    supplyMode: definition.supplyMode,
    abi: artifact.abi,
    bytecode: `0x${object}`,
  };
});

const serialized = `${JSON.stringify(templates, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== serialized) {
    console.error("Deploy templates are stale. Run npm run templates:generate and commit the result.");
    process.exit(1);
  }
  console.log(`Deploy templates are up to date (${templates.length} templates).`);
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized);
  console.log(`Generated ${templates.length} deploy templates at ${path.relative(projectRoot, outputPath)}.`);
}
