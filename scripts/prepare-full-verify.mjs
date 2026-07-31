// Create full standard-json-input with all dependencies for verification
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const projectRoot = process.cwd();

// Read a Solidity file and all its imports recursively
function collectSources(entryFile) {
  const sources = {};
  const seen = new Set();

  function resolveImport(importPath, fromFileDir) {
    // 1. Relative imports (./xxx.sol or ../xxx.sol) — resolve relative to the importing file
    if (importPath.startsWith(".")) {
      const candidate = path.resolve(fromFileDir, importPath);
      if (fs.existsSync(candidate)) {
        // Convert filesystem path to Solidity import path
        // node_modules/@openzeppelin/contracts/... -> @openzeppelin/contracts/...
        // Contracts in contracts/ -> contracts/...
        let importKey = path.relative(projectRoot, candidate).replace(/\\/g, "/");
        // Remove node_modules/ prefix since Solidity imports use bare @scope paths
        importKey = importKey.replace(/^node_modules\//, "");
        return { filePath: candidate, importKey };
      }
      return null;
    }
    // 2. Absolute imports — try project-root-relative paths
    const candidates = [
      path.join(projectRoot, importPath),
      path.join(projectRoot, "contracts", importPath),
      path.join(projectRoot, "node_modules", importPath),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        let importKey = importPath;
        // Remove node_modules/ prefix if it was part of the candidate match
        return { filePath: c, importKey };
      }
    }
    // 3. Try resolving relative to current file dir
    const fromProject = path.join(fromFileDir, importPath);
    if (fs.existsSync(fromProject)) {
      let importKey = path.relative(projectRoot, fromProject).replace(/\\/g, "/");
      importKey = importKey.replace(/^node_modules\//, "");
      return { filePath: fromProject, importKey };
    }
    return null;
  }

  function processFile(filePath, importKey) {
    if (seen.has(filePath)) return;
    seen.add(filePath);
    const content = fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
    // Use the import key (as written in the import statement) instead of filesystem path
    const key = importKey || path.relative(projectRoot, filePath).replace(/\\/g, "/");
    sources[key] = { content };

    // Find all imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|[^;{]+)\s+from\s+)?[""]([^""]+)[""];/g;
    let match;
    const fromFileDir = path.dirname(filePath);
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolved = resolveImport(importPath, fromFileDir);
      if (resolved) processFile(resolved.filePath, resolved.importKey);
    }
  }

  processFile(path.resolve(projectRoot, entryFile));
  return sources;
}

function main() {
  const entryFiles = [
    "contracts/mint/KimiMintLaunchFactory.sol",
    "contracts/mint/KimiMintToken.sol",
    "contracts/mint/KimiMintVault.sol",
    "contracts/mint/KimiMintDeployers.sol",
    "contracts/mint/KimiMintAuditRegistry.sol",
    "contracts/nft/KimiNFTLaunchFactory.sol",
    "contracts/nft/KimiNFTCollection.sol",
  ];

  const fullSources = {};
  for (const entry of entryFiles) {
    Object.assign(fullSources, collectSources(entry));
  }

  const input = {
    language: "Solidity",
    sources: fullSources,
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
      metadata: { useLiteralContent: true },
    },
  };

  const inputJson = JSON.stringify(input);
  const outDir = path.join(projectRoot, "work");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "full-standard-json-input.json");
  fs.writeFileSync(outFile, inputJson);
  console.log(`Full standard-json-input written to ${outFile}`);
  console.log(`Size: ${Buffer.byteLength(inputJson)} bytes`);
  console.log(`Source count: ${Object.keys(fullSources).length}`);

  // Also save a hash for reference
  const hash = createHash("sha256").update(inputJson).digest("hex");
  console.log(`SHA256: ${hash}`);
}

main();
