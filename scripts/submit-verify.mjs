#!/usr/bin/env node
// Submit a single contract to BscScan v2 API for verification (supports proxy via HTTPS_PROXY)
// Usage: node scripts/submit-verify.mjs <address> <contractName> [constructorArgs]
import "dotenv/config";
import fs from "fs";
import https from "https";
import path from "path";
import { HttpsProxyAgent } from "https-proxy-agent";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const [,, address, contractName, encodedArgs] = process.argv;
const API_KEY = process.env.BSCSCAN_API_KEY || "";
const SOURCE_FILE = path.join(projectRoot, "work", "full-standard-json-input.json");

if (!address || !contractName) {
  console.error("Usage: node scripts/submit-verify.mjs <address> <contractName> [constructorArgs]");
  process.exit(1);
}

const sourceCode = fs.readFileSync(SOURCE_FILE, "utf8");
console.log(`Source: ${Object.keys(JSON.parse(sourceCode).sources).length} files, ${Buffer.byteLength(sourceCode)} bytes`);

// Build form body
const body = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  apikey: API_KEY,
  contractaddress: address,
  sourceCode,
  codeformat: "solidity-standard-json-input",
  contractname: contractName,
  compilerversion: "v0.8.36+commit.8a079791",
  optimizationUsed: "1",
  runs: "1",
  licenseType: "3",
});
if (encodedArgs) {
  body.set("constructorArguements", encodedArgs);
}
const payload = body.toString();
console.log(`Payload: ${Buffer.byteLength(payload)} bytes`);

// Proxy agent
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
if (agent) console.log(`Using proxy: ${proxyUrl}`);

// Request
const req = https.request(
  "https://api.etherscan.com/v2/api?chainid=56",
  {
    method: "POST",
    agent,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      try {
        const result = JSON.parse(data);
        console.log(JSON.stringify(result, null, 2));
        if (result.status === "1") {
          console.log(`\n✅ GUID: ${result.result}`);
          console.log("Check status:");
          console.log(`  curl -s --proxy http://127.0.0.1:7898 "https://api.etherscan.com/v2/api?chainid=56&module=contract&action=checkverifystatus&apikey=${API_KEY}&guid=${result.result}"`);
        }
      } catch {
        console.log("Response:", data.slice(0, 500));
      }
    });
  },
);
req.on("error", (e) => console.error("Request error:", e.message));
req.write(payload);
req.end();
