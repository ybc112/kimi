#!/usr/bin/env node
// Submit a snowball contract to BscScan v2 API for verification (standard-json-input, via HTTPS_PROXY)
// Usage: node scripts/submit-snowball-verify.mjs <contractKey> <address> [contractName]
//   contractKey: TokenFactory | BananaTokenDeployer | BananaToken
//   不传 constructorArguements（Factory 有构造参数也不传，见 kimimint-redeploy-plan 经验）
import "dotenv/config";
import fs from "fs";
import https from "https";
import path from "path";
import proxyPkg from "https-proxy-agent";
const { HttpsProxyAgent } = proxyPkg;
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const API_KEY = process.env.BSCSCAN_API_KEY || "";
const SOLC_VERSION = "v0.8.24+commit.e11b9ed9";

const CONTRACTS = {
  TokenFactory: {
    input: "work/snowball-verify/TokenFactory-input.json",
    contractName: "contracts/tokenfactory/TokenFactory.sol:TokenFactory",
    runs: 200,
  },
  BananaTokenDeployer: {
    input: "work/snowball-verify/BananaTokenDeployer-input.json",
    contractName: "contracts/tokenfactory/BananaTokenDeployer.sol:BananaTokenDeployer",
    runs: 1,
  },
  BananaToken: {
    input: "work/snowball-verify/BananaToken-input.json",
    contractName: "contracts/tokenfactory/BananaToken.sol:BananaToken",
    runs: 1,
  },
};

const [, , contractKey, address, explicitName] = process.argv;
const cfg = CONTRACTS[contractKey];
if (!cfg || !address) {
  console.error("Usage: node scripts/submit-snowball-verify.mjs <TokenFactory|BananaTokenDeployer|BananaToken> <address> [contractName]");
  process.exit(1);
}
const contractName = explicitName || cfg.contractName;

const sourceCode = fs.readFileSync(path.join(projectRoot, cfg.input), "utf8");
console.log(`Submitting ${contractName} @ ${address}`);
console.log(`Source: ${Object.keys(JSON.parse(sourceCode).sources).length} files, ${Buffer.byteLength(sourceCode)} bytes, runs ${cfg.runs}`);

const body = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  apikey: API_KEY,
  contractaddress: address,
  sourceCode,
  codeformat: "solidity-standard-json-input",
  contractname: contractName,
  compilerversion: SOLC_VERSION,
  optimizationUsed: "1",
  runs: String(cfg.runs),
  licenseType: "3",
});

const apiHost = "api.etherscan.io";
const apiPath = "/v2/api?chainid=56";
const agent = process.env.HTTPS_PROXY || process.env.https_proxy ? new HttpsProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy) : undefined;

const req = https.request(
  {
    host: apiHost,
    path: apiPath,
    method: "POST",
    agent,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body.toString()),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      console.log("HTTP", res.statusCode);
      console.log(data.slice(0, 500));
    });
  }
);
req.on("error", (e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
req.write(body.toString());
req.end();
