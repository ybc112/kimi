import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();
const contracts = [
  { entry: "contracts/KIMI.sol", contractName: "KIMI" },
  { entry: "contracts/FixedSupplyToken.sol", contractName: "FixedSupplyToken" },
  { entry: "contracts/mint/KimiMintLaunchFactory.sol", contractName: "KimiMintLaunchFactory" },
  { entry: "contracts/mint/KimiMintToken.sol", contractName: "KimiMintToken" },
  { entry: "contracts/mint/KimiMintVault.sol", contractName: "KimiMintVault" },
  { entry: "contracts/mint/KimiMintDeployers.sol", contractName: "KimiMintTokenDeployer" },
  { entry: "contracts/mint/KimiMintDeployers.sol", contractName: "KimiMintVaultDeployer" },
  { entry: "contracts/mint/KimiMintAuditRegistry.sol", contractName: "KimiMintAuditRegistry" },
  { entry: "contracts/nft/KimiNFTCollection.sol", contractName: "KimiNFTCollection" },
  { entry: "contracts/nft/KimiNFTLaunchFactory.sol", contractName: "KimiNFTLaunchFactory" },
];

function readSoliditySource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    contracts.map(({ entry }) => [entry, { content: readSoliditySource(path.join(projectRoot, entry)) }]),
  ),
  settings: {
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
    metadata: { useLiteralContent: true },
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

const artifactsDir = path.join(projectRoot, "artifacts");
const buildInfoDir = path.join(artifactsDir, "build-info");
fs.mkdirSync(buildInfoDir, { recursive: true });

const solcVersion = solc.version();
const inputJson = JSON.stringify(input);
const buildInfoId = createHash("sha256").update(inputJson).digest("hex").slice(0, 16);
const buildInfoFileName = `${buildInfoId}.json`;
const buildInfoPath = path.join(buildInfoDir, buildInfoFileName);
const buildInfo = {
  id: buildInfoId,
  _format: "hh-sol-build-info-1",
  solcVersion: solcVersion.split("+")[0],
  solcLongVersion: solcVersion,
  input,
  output,
};
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

for (const { entry, contractName } of contracts) {
  const compiled = output.contracts?.[entry]?.[contractName];
  if (!compiled?.evm?.bytecode?.object) {
    throw new Error(`${contractName} compilation produced no creation bytecode`);
  }

  const artifactDir = path.join(artifactsDir, entry);
  fs.mkdirSync(artifactDir, { recursive: true });

  const bytecode = ensure0x(compiled.evm.bytecode.object);
  const deployedBytecode = ensure0x(compiled.evm.deployedBytecode.object);
  const artifact = {
    contractName,
    abi: compiled.abi,
    bytecode,
    deployedBytecode,
    linkReferences: {},
    deployedLinkReferences: {},
  };

  const artifactPath = path.join(artifactDir, `${contractName}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  const dbgPath = path.join(artifactDir, `${contractName}.dbg.json`);
  const relativeBuildInfo = path.relative(artifactDir, buildInfoPath).replace(/\\/g, "/");
  fs.writeFileSync(dbgPath, JSON.stringify({ buildInfo: relativeBuildInfo }, null, 2));

  console.log(`${contractName} compiled successfully (${bytecode.length / 2 - 1} creation bytes).`);
}

function ensure0x(value) {
  const text = String(value || "");
  return text.startsWith("0x") ? text : `0x${text}`;
}
