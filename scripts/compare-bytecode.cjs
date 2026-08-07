// Compare on-chain bytecode with local recompilation
const { JsonRpcProvider } = require("ethers");
const { compile } = require("solc");
const fs = require("fs");

async function main() {
  // Get on-chain bytecode
  const p = new JsonRpcProvider("https://bsc.publicnode.com", 56);
  const addr = process.argv[2] || "0x518afd31a57ffb9b06691d55288395105c3c7777";
  const chainCode = (await p.getCode(addr)).slice(2);
  console.log("Chain deployed bytes:", chainCode.length / 2);

  // Read build-info and recompile
  const biDir = "artifacts/build-info";
  const biFiles = fs.readdirSync(biDir).filter(f => f.endsWith(".json"));
  const bi = JSON.parse(fs.readFileSync(biDir + "/" + biFiles[0], "utf8"));

  // Recompile with same input + findImports
  const input = JSON.stringify(bi.input);
  const output = JSON.parse(compile(input, {
    import: (importPath) => {
      const candidates = [
        importPath,
        "contracts/" + importPath,
        "node_modules/" + importPath,
      ];
      for (const c of candidates) {
        try { return { contents: fs.readFileSync(c, "utf8").replace(/\r\n?/g, "\n") }; }
        catch {}
      }
      return { error: "Not found: " + importPath };
    }
  }));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors.map(e => e.formattedMessage).join("\n"));
      return;
    }
  }

  const compiled = output.contracts["contracts/mint/KimiMintToken.sol"]["KimiMintToken"];
  const deployedBytecode = compiled.evm.deployedBytecode.object;

  console.log("Compiled deployed bytes:", deployedBytecode.length / 2);
  console.log("Match:", chainCode === deployedBytecode);

  if (chainCode !== deployedBytecode) {
    // Find first difference
    for (let i = 0; i < Math.min(chainCode.length, deployedBytecode.length); i++) {
      if (chainCode[i] !== deployedBytecode[i]) {
        console.log("First diff at byte:", Math.floor(i / 2));
        console.log("Chain:", chainCode.slice(i, i + 20));
        console.log("Local:", deployedBytecode.slice(i, i + 20));
        break;
      }
    }
    // Compare metadata tails
    const metadataLen = parseInt(chainCode.slice(-4), 16);
    console.log("\nMetadata length:", metadataLen * 2 + 4, "hex chars");
    console.log("Chain metadata tail:", chainCode.slice(-(metadataLen * 2 + 4)));
    console.log("Local metadata tail:", deployedBytecode.slice(-(metadataLen * 2 + 4)));
  }

  // Also check: generated standard-json from artifacts/contracts/...json
  const artifact = JSON.parse(fs.readFileSync("artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json", "utf8"));
  const artDeployed = artifact.deployedBytecode.replace(/^0x/, "");
  console.log("\nArtifact deployed bytes:", artDeployed.length / 2);
  console.log("Artifact == Chain:", artDeployed === chainCode);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
