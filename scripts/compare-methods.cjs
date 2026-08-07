// Compare: compile with callback vs all-in-sources
const { compile } = require("solc");
const { JsonRpcProvider } = require("ethers");
const fs = require("fs");

async function main() {
  const provider = new JsonRpcProvider("https://bsc.publicnode.com", 56);
  const addr = "0x518afd31a57ffb9b06691d55288395105c3c7777";
  const chainCode = (await provider.getCode(addr)).slice(2);

  const biDir = "artifacts/build-info";
  const bi = JSON.parse(fs.readFileSync(biDir + "/" + fs.readdirSync(biDir).filter(f => f.endsWith(".json"))[0], "utf8"));

  // Method 1: callback (exact replica of original)
  const out1 = JSON.parse(compile(JSON.stringify(bi.input), {
    import: (p) => {
      for (const c of [p, "contracts/" + p, "node_modules/" + p]) {
        try { return { contents: fs.readFileSync(c, "utf8").replace(/\r\n?/g, "\n") }; } catch {}
      }
      return { error: "Not found" };
    }
  }));
  const c1 = out1.contracts["contracts/mint/KimiMintToken.sol"]["KimiMintToken"].evm.deployedBytecode.object;
  console.log("Method 1 (callback):", c1.length/2, "bytes  Match chain:", c1 === chainCode);

  // Method 2: All files in sources, no callback
  const allSources = {};
  // Copy entry files from bi.input.sources
  for (const [k, v] of Object.entries(bi.input.sources)) {
    allSources[k] = v;
  }
  // Collect all imports recursively
  function collectImports(content, baseDir) {
    const re = /import\s+(?:(?:\{[^}]*\}|[^;{]+)\s+from\s+)?["']([^"']+)["'];/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const imp = m[1];
      if (imp in allSources) continue;
      for (const cand of [imp, "contracts/" + imp, "node_modules/" + imp, baseDir + "/" + imp]) {
        try {
          const c = fs.readFileSync(cand, "utf8").replace(/\r\n?/g, "\n");
          // Key as import path (remove node_modules/ prefix if any)
          let key = imp.startsWith(".") ? imp : imp;
          allSources[key] = { content: c };
          collectImports(c, require("path").dirname(cand));
          break;
        } catch {}
      }
    }
  }
  for (const [k, v] of Object.entries(allSources)) {
    if (v.content) {
      const dir = k.includes("/") ? require("path").dirname(k) : ".";
      collectImports(v.content, dir);
    }
  }

  const input2 = { language: "Solidity", sources: allSources, settings: bi.input.settings };
  console.log("Method 2 sources:", Object.keys(allSources).length);

  const out2 = JSON.parse(compile(JSON.stringify(input2)));
  if (out2.errors && out2.errors.some(e => e.severity === "error")) {
    console.log("Method 2 errors:", out2.errors.filter(e => e.severity === "error").map(e => e.formattedMessage).join("\n").slice(0, 500));
  } else {
    const c2 = out2.contracts["contracts/mint/KimiMintToken.sol"]["KimiMintToken"].evm.deployedBytecode.object;
    console.log("Method 2 (all-in):", c2.length/2, "bytes  Match chain:", c2 === chainCode);

    if (c2 !== chainCode) {
      // Strip CBOR metadata and compare core
      const strip = (s) => {
        const n = parseInt(s.slice(-4), 16);
        return s.slice(0, -4 - n * 2);
      };
      console.log("Core match:", strip(c2) === strip(chainCode));
      console.log("Metadata length:", parseInt(chainCode.slice(-4), 16));
    }
  }
}
main().catch(e => console.error(e.message || e));
