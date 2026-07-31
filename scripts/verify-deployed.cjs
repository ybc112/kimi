// Verify deployed KimiMint contracts on BscScan
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("node:https");

const projectRoot = path.resolve(__dirname, "..");

const FACTORY_ADDR = "0xFa2419F2A1BBe90Eb08E7D19cd3171CEF3ab75EB";
const TOKEN_DEPLOYER_ADDR = "0x4c549bB4EB1d4BE475d00654999c86210E642Ca1";
const VAULT_DEPLOYER_ADDR = "0x2B8181B02D5bec9449440Eef88265C15bC4392e7";

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const CHAIN_ID = "56";

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
    const req = https.request(
      target,
      {
        method,
        headers: payload
          ? {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": Buffer.byteLength(payload),
            }
          : {},
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { raw += chunk; });
        response.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error(`Invalid response: ${raw.slice(0, 240)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("Timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

async function verifyWithEtherscanV2({ address, sourceName, contractName, constructorArgs }) {
  const artifactPath = path.join(projectRoot, "artifacts", sourceName, `${contractName}.json`);
  const dbgPath = path.join(projectRoot, "artifacts", sourceName, `${contractName}.dbg.json`);
  const artifact = readJson(path.relative(projectRoot, artifactPath));
  const dbg = readJson(path.relative(projectRoot, dbgPath));
  const buildInfoRef = String(dbg.buildInfo || "").replace(/\\/g, "/");
  const buildInfoPath = path.resolve(path.dirname(dbgPath), buildInfoRef);
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  const compilerVersion = String(buildInfo.solcLongVersion || "").startsWith("v")
    ? buildInfo.solcLongVersion
    : `v${buildInfo.solcLongVersion}`;

  const { ethers } = require("ethers");
  let encodedArgs = "";
  if (constructorArgs && constructorArgs.length > 0) {
    const abi = artifact.abi;
    const constructor = abi.find((item) => item.type === "constructor");
    const inputs = constructor?.inputs || [];
    if (inputs.length > 0) {
      encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        inputs.map((i) => i.type),
        constructorArgs
      ).replace(/^0x/, "");
    }
  }

  console.log(`Verifying ${contractName} at ${address}...`);
  console.log(`  Compiler: ${compilerVersion}`);

  const submit = await requestJson({
    method: "POST",
    url: "https://api.etherscan.io/v2/api",
    query: { chainid: CHAIN_ID },
    body: {
      module: "contract",
      action: "verifysourcecode",
      apikey: BSCSCAN_API_KEY,
      contractaddress: address,
      sourceCode: JSON.stringify(buildInfo.input),
      codeformat: "solidity-standard-json-input",
      contractname: `${sourceName}:${contractName}`,
      compilerversion: compilerVersion,
      optimizationUsed: "1",
      runs: "200",
      constructorArguements: encodedArgs,
      licenseType: "3",
    },
  });

  if (submit.status !== "1") {
    const result = String(submit.result || "");
    if (/already verified/i.test(result)) {
      console.log(`  ${contractName} already verified.`);
      return;
    }
    throw new Error(`Submit failed: ${submit.message || ""} ${result}`);
  }

  const guid = String(submit.result || "");
  console.log(`  Submitted, GUID: ${guid}`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    await new Promise((r) => setTimeout(r, 6000));
    const status = await requestJson({
      method: "GET",
      url: "https://api.etherscan.io/v2/api",
      query: {
        chainid: CHAIN_ID,
        module: "contract",
        action: "checkverifystatus",
        apikey: BSCSCAN_API_KEY,
        guid,
      },
    });
    const result = String(status.result || "");
    if (status.status === "1" || /pass - verified|already verified/i.test(result)) {
      console.log(`  ${contractName} VERIFIED!`);
      return;
    }
    if (/pending|in progress/i.test(result)) {
      console.log(`  Attempt ${attempt}: pending...`);
      continue;
    }
    console.warn(`  Status: ${result}`);
  }
  console.warn(`  ${contractName} verification timed out.`);
}

async function main() {
  console.log("Verifying KimiMint contracts on BscScan...\n");

  // 1. TokenDeployer - no constructor args
  await verifyWithEtherscanV2({
    address: TOKEN_DEPLOYER_ADDR,
    sourceName: "contracts/mint/KimiMintDeployers.sol",
    contractName: "KimiMintTokenDeployer",
    constructorArgs: [],
  });

  // 2. VaultDeployer - no constructor args
  await verifyWithEtherscanV2({
    address: VAULT_DEPLOYER_ADDR,
    sourceName: "contracts/mint/KimiMintDeployers.sol",
    contractName: "KimiMintVaultDeployer",
    constructorArgs: [],
  });

  // 3. Factory - with constructor args
  await verifyWithEtherscanV2({
    address: FACTORY_ADDR,
    sourceName: "contracts/mint/KimiMintLaunchFactory.sol",
    contractName: "KimiMintLaunchFactory",
    constructorArgs: [
      "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9", // feeRecipient_
      0,                                                 // creationFee_
      "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777",     // creationFeeToken_
      "10000000000000000000000",                         // creationFeeAmount_
      "0x10ED43C718714eb63d5aA57B78B54704E256024E",    // liquidityRouter_
      TOKEN_DEPLOYER_ADDR,                               // tokenDeployer_
      VAULT_DEPLOYER_ADDR,                               // vaultDeployer_
      0,                                                 // requiredTokenSuffix_
    ],
  });

  console.log("\nAll verifications complete!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exitCode = 1;
});
