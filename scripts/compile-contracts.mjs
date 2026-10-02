import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();

// V1 使用 runs=200（已部署合约的产物保持不变）
const V1_CONTRACTS = [
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

// V2 使用 runs=1：TokenDeployerV2 内嵌 TokenV2 的 init code，
// 必须把运行时代码压到 EIP-170 的 24576 字节以内。
const V2_CONTRACTS = [
  { entry: "contracts/mintV2/KimiMintLaunchFactoryV2.sol", contractName: "KimiMintLaunchFactoryV2" },
  { entry: "contracts/mintV2/KimiMintTokenV2.sol", contractName: "KimiMintTokenV2" },
  { entry: "contracts/mintV2/KimiMintVaultV2.sol", contractName: "KimiMintVaultV2" },
  { entry: "contracts/mintV2/KimiMintDeployersV2.sol", contractName: "KimiMintTokenDeployerV2" },
  { entry: "contracts/mintV2/KimiMintDeployersV2.sol", contractName: "KimiMintVaultDeployerV2" },
];

const groups = [
  {
    name: "default",
    contracts: V1_CONTRACTS,
    settings: { viaIR: true, optimizer: { enabled: true, runs: 200 } },
  },
  {
    name: "mintV2",
    contracts: V2_CONTRACTS,
    settings: { viaIR: true, optimizer: { enabled: true, runs: 1 } },
  },
];

function readSoliditySource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

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

function ensure0x(value) {
  const text = String(value || "");
  return text.startsWith("0x") ? text : `0x${text}`;
}

function compileGroup(group) {
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      group.contracts.map(({ entry }) => [
        entry,
        { content: readSoliditySource(path.join(projectRoot, entry)) },
      ]),
    ),
    settings: {
      ...group.settings,
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
      metadata: { useLiteralContent: true },
    },
  };

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

  const inputJson = JSON.stringify(input);
  const buildInfoId = createHash("sha256").update(inputJson).digest("hex").slice(0, 16);
  const buildInfoPath = path.join(buildInfoDir, `${buildInfoId}.json`);
  fs.writeFileSync(
    buildInfoPath,
    JSON.stringify(
      {
        id: buildInfoId,
        _format: "hh-sol-build-info-1",
        solcVersion: solc.version().split("+")[0],
        solcLongVersion: solc.version(),
        input,
        output,
      },
      null,
      2,
    ),
  );

  for (const { entry, contractName } of group.contracts) {
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

    fs.writeFileSync(path.join(artifactDir, `${contractName}.json`), JSON.stringify(artifact, null, 2));
    const relativeBuildInfo = path.relative(artifactDir, buildInfoPath).replace(/\\/g, "/");
    fs.writeFileSync(
      path.join(artifactDir, `${contractName}.dbg.json`),
      JSON.stringify({ buildInfo: relativeBuildInfo }, null, 2),
    );

    const runtimeBytes = deployedBytecode.length / 2 - 1;
    const overLimit = runtimeBytes > 24576 ? "  <-- OVER EIP-170" : "";
    console.log(
      `${contractName} compiled successfully (${bytecode.length / 2 - 1} creation bytes, ${runtimeBytes} runtime bytes).${overLimit}`,
    );
  }
}

for (const group of groups) {
  console.log(`--- group: ${group.name} (optimizer runs ${group.settings.optimizer.runs}) ---`);
  compileGroup(group);
}
