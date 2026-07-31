// Verify all KimiMint contracts using proxy
require("dotenv").config();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const PROXY_URL = "http://127.0.0.1:7898";

const CONTRACTS = [
  {
    name: "KimiMintTokenDeployer",
    address: "0x4c549bB4EB1d4BE475d00654999c86210E642Ca1",
    sourceName: "contracts/mint/KimiMintDeployers.sol",
    contractName: "KimiMintTokenDeployer",
    encodedArgs: "",
  },
  {
    name: "KimiMintVaultDeployer",
    address: "0x2B8181B02D5bec9449440Eef88265C15bC4392e7",
    sourceName: "contracts/mint/KimiMintDeployers.sol",
    contractName: "KimiMintVaultDeployer",
    encodedArgs: "",
  },
  {
    name: "KimiMintLaunchFactory",
    address: "0xFa2419F2A1BBe90Eb08E7D19cd3171CEF3ab75EB",
    sourceName: "contracts/mint/KimiMintLaunchFactory.sol",
    contractName: "KimiMintLaunchFactory",
    encodedArgs: (() => {
      const { ethers } = require("ethers");
      return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "address", "uint256", "address", "address", "address", "uint16"],
        [
          "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9", // feeRecipient_
          0,                                                 // creationFee_
          "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777",    // creationFeeToken_
          "10000000000000000000000",                        // creationFeeAmount_
          "0x10ED43C718714eb63d5aA57B78B54704E256024E",    // liquidityRouter_
          "0x4c549bB4EB1d4BE475d00654999c86210E642Ca1",    // tokenDeployer_
          "0x2B8181B02D5bec9449440Eef88265C15bC4392e7",    // vaultDeployer_
          0,                                                 // requiredTokenSuffix_
        ]
      ).replace(/^0x/, "");
    })(),
  },
];

function getBuildInfo(sourceName) {
  const dbgPath = path.join(projectRoot, "artifacts", sourceName, CONTRACTS[0].contractName + ".dbg.json");
  // Use any contract - they all share the same build info
  for (const contract of CONTRACTS) {
    const dbgPath = path.join(projectRoot, "artifacts", contract.sourceName, contract.contractName + ".dbg.json");
    if (fs.existsSync(dbgPath)) {
      const dbg = JSON.parse(fs.readFileSync(dbgPath, "utf8"));
      const buildInfoRef = String(dbg.buildInfo || "").replace(/\\/g, "/");
      const buildInfoPath = path.resolve(path.dirname(dbgPath), buildInfoRef);
      const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
      const compilerVersion = String(buildInfo.solcLongVersion || "").startsWith("v")
        ? buildInfo.solcLongVersion : "v" + buildInfo.solcLongVersion;
      return {
        sourceCode: JSON.stringify(buildInfo.input),
        compilerVersion,
        contractNameForBuildInfo: contract.contractName,
        dbgPath,
        buildInfoPath,
      };
    }
  }
  throw new Error("No build info found");
}

async function submitVerification(contract) {
  const buildInfo = getBuildInfo(contract.sourceName);

  return new Promise((resolve, reject) => {
    const env = { ...process.env, HTTPS_PROXY: PROXY_URL, HTTP_PROXY: PROXY_URL };
    const body = new URLSearchParams({
      module: "contract",
      action: "verifysourcecode",
      apikey: process.env.BSCSCAN_API_KEY || "",
      contractaddress: contract.address,
      sourceCode: buildInfo.sourceCode,
      codeformat: "solidity-standard-json-input",
      contractname: contract.sourceName + ":" + contract.contractName,
      compilerversion: buildInfo.compilerVersion,
      optimizationUsed: "1",
      runs: "200",
      constructorArguements: contract.encodedArgs || "",
      licenseType: "3",
    }).toString();

    const curl = spawn("curl", [
      "-s",
      "--proxy", PROXY_URL,
      "-X", "POST",
      "https://api.etherscan.io/v2/api?chainid=56",
      "-H", "Content-Type: application/x-www-form-urlencoded",
      "-d", body,
    ], { env, stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    curl.stdout.on("data", (d) => stdout += d);
    curl.stderr.on("data", (d) => stderr += d);
    curl.on("close", (code) => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`curl failed: ${stderr || stdout}`));
      }
    });
    curl.on("error", reject);
  });
}

async function checkStatus(guid) {
  return new Promise((resolve, reject) => {
    const curl = spawn("curl", [
      "-s",
      "--proxy", PROXY_URL,
      `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=checkverifystatus&apikey=${process.env.BSCSCAN_API_KEY}&guid=${guid}`,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    curl.stdout.on("data", (d) => stdout += d);
    curl.on("close", () => {
      try { resolve(JSON.parse(stdout)); } catch { resolve({}); }
    });
    curl.on("error", reject);
  });
}

async function main() {
  console.log("Verifying KimiMint contracts via proxy...\n");

  for (const contract of CONTRACTS) {
    console.log(`${contract.name} at ${contract.address}`);
    try {
      const submit = await submitVerification(contract);
      if (submit.status !== "1") {
        const result = String(submit.result || "");
        if (/already verified/i.test(result)) {
          console.log("  Already verified!\n");
          continue;
        }
        console.log(`  Submit error: ${submit.message} ${result}\n`);
        continue;
      }

      const guid = String(submit.result || "");
      console.log(`  GUID: ${guid} - polling...`);

      for (let i = 1; i <= 20; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const status = await checkStatus(guid);
        const result = String(status.result || "");
        if (status.status === "1" || /pass - verified|already verified/i.test(result)) {
          console.log(`  VERIFIED!\n`);
          break;
        }
        if (i === 20) {
          console.log(`  Timed out (GUID: ${guid})\n`);
        }
      }
    } catch (err) {
      console.log(`  Error: ${err.message}\n`);
    }
  }

  console.log("Done!");
}

main().catch((e) => { console.error(e); process.exit(1); });
