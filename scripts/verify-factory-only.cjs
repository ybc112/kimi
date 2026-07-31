// Verify KimiMintLaunchFactory on BscScan
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("node:https");

const projectRoot = process.cwd();
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const CHAIN_ID = "56";
const FACTORY_ADDR = "0xFa2419F2A1BBe90Eb08E7D19cd3171CEF3ab75EB";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function requestJson({ method, url, query = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        target.searchParams.set(key, String(value));
      }
    }
    const payload = body ? new URLSearchParams(body).toString() : "";
    const req = https.request(target, {
      method,
      headers: payload ? { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(payload) } : {},
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid response: " + raw.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("Timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

async function verify(address, sourceName, contractName, constructorArgsEncoded) {
  const artifact = readJson("artifacts/" + sourceName + "/" + contractName + ".json");
  const dbg = readJson("artifacts/" + sourceName + "/" + contractName + ".dbg.json");
  const buildInfoRef = String(dbg.buildInfo || "").replace(/\\/g, "/");
  const buildInfoPath = path.resolve(path.dirname(path.join(projectRoot, "artifacts", sourceName)), buildInfoRef);
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  const compilerVersion = String(buildInfo.solcLongVersion || "").startsWith("v")
    ? buildInfo.solcLongVersion : "v" + buildInfo.solcLongVersion;

  console.log("Verifying " + contractName + " at " + address + "...");
  console.log("  Compiler: " + compilerVersion);

  const submit = await requestJson({
    method: "POST",
    url: "https://api.etherscan.io/v2/api",
    query: { chainid: CHAIN_ID },
    body: {
      module: "contract", action: "verifysourcecode", apikey: BSCSCAN_API_KEY,
      contractaddress: address,
      sourceCode: JSON.stringify(buildInfo.input),
      codeformat: "solidity-standard-json-input",
      contractname: sourceName + ":" + contractName,
      compilerversion: compilerVersion,
      optimizationUsed: "1", runs: "200",
      constructorArguements: constructorArgsEncoded || "",
      licenseType: "3",
    },
  });

  if (submit.status !== "1") {
    const result = String(submit.result || "");
    if (/already verified/i.test(result)) { console.log("  Already verified!"); return; }
    console.error("  Submit failed:", submit.message, result);
    return;
  }

  const guid = String(submit.result || "");
  console.log("  Submitted, GUID: " + guid);
  for (let i = 1; i <= 30; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const status = await requestJson({
      method: "GET", url: "https://api.etherscan.io/v2/api",
      query: { chainid: CHAIN_ID, module: "contract", action: "checkverifystatus", apikey: BSCSCAN_API_KEY, guid },
    });
    const result = String(status.result || "");
    if (status.status === "1" || /pass - verified|already verified/i.test(result)) {
      console.log("  VERIFIED!"); return;
    }
    if (/pending|in progress/i.test(result)) { console.log("  Attempt " + i + ": pending..."); continue; }
    console.log("  Status: " + result);
  }
  console.log("  Timed out.");
}

async function main() {
  // Factory constructor args:
  // address feeRecipient_, uint256 creationFee_, address creationFeeToken_, uint256 creationFeeAmount_,
  // address liquidityRouter_, address tokenDeployer_, address vaultDeployer_, uint16 requiredTokenSuffix_
  const { ethers } = require("ethers");
  const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "address", "uint256", "address", "address", "address", "uint16"],
    [
      "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9",
      0,
      "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777",
      "10000000000000000000000",
      "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      "0x4c549bB4EB1d4BE475d00654999c86210E642Ca1",
      "0x2B8181B02D5bec9449440Eef88265C15bC4392e7",
      0,
    ]
  ).replace(/^0x/, "");

  await verify(
    FACTORY_ADDR,
    "contracts/mint/KimiMintLaunchFactory.sol",
    "KimiMintLaunchFactory",
    encodedArgs
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
