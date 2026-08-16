// Prepare snowball TokenFactory suite standard-json-input files from hardhat build-info
// (settings/sources exactly match the artifacts used for deployment — CRLF preserved)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const buildInfoDir = path.join(projectRoot, "artifacts", "build-info");

const targets = [
  {
    name: "TokenFactory",
    buildInfoPrefix: "5247adf238d1661d543aa09aba207dc0",
    contractName: "contracts/tokenfactory/TokenFactory.sol:TokenFactory",
    address: "0xDa80B6d6A495e5AA4870391D36E7F9628Be7f79A",
  },
  {
    name: "BananaTokenDeployer",
    buildInfoPrefix: "a347edcd3385f154f422af821c7df406",
    contractName: "contracts/tokenfactory/BananaTokenDeployer.sol:BananaTokenDeployer",
    address: "0x97Ec910A810699c3A0b3d974f6Eb121998cF99A7",
  },
  {
    name: "BananaToken",
    buildInfoPrefix: "e6e61cacaa0c5a71aac9fdca8f357a1e",
    contractName: "contracts/tokenfactory/BananaToken.sol:BananaToken",
    address: "", // per-token, filled at verify time
  },
];

const outDir = path.join(projectRoot, "work", "snowball-verify");
fs.mkdirSync(outDir, { recursive: true });

let buildInfoFound = {};
for (const f of fs.readdirSync(buildInfoDir)) {
  const bi = JSON.parse(fs.readFileSync(path.join(buildInfoDir, f), "utf8"));
  const keys = Object.keys(bi.input.sources || {});
  const tf = keys.some((k) => k.includes("TokenFactory.sol"));
  const dep = keys.some((k) => k.includes("BananaTokenDeployer.sol"));
  const token = keys.some((k) => k.includes("BananaToken.sol"));
  if (tf) buildInfoFound.TokenFactory = bi;
  if (dep) buildInfoFound.BananaTokenDeployer = bi;
  if (token && !tf && !dep) buildInfoFound.BananaToken = bi;
}

for (const t of targets) {
  const bi = buildInfoFound[t.name];
  if (!bi) {
    console.error(`build-info for ${t.name} not found`);
    process.exit(1);
  }
  const input = {
    language: "Solidity",
    sources: bi.input.sources,
    settings: {
      viaIR: bi.input.settings.viaIR,
      evmVersion: bi.input.settings.evmVersion,
      optimizer: bi.input.settings.optimizer,
      ...(bi.input.settings.debug ? { debug: bi.input.settings.debug } : {}),
    },
  };
  const outFile = path.join(outDir, `${t.name}-input.json`);
  fs.writeFileSync(outFile, JSON.stringify(input));
  console.log(
    `Wrote ${outFile}  (${Object.keys(input.sources).length} sources, solc ${bi.solcLongVersion}, runs ${input.settings.optimizer.runs}${input.settings.debug ? " strip" : ""})`
  );
}
console.log("\nDone. Submit with contractName e.g.:");
for (const t of targets) console.log(`  ${t.contractName}  ${t.address || "<token addr>"}`);
