require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("node:https");
const { ethers } = require("ethers");

const { HttpsProxyAgent } = (() => {
  try {
    return require("https-proxy-agent");
  } catch {
    return { HttpsProxyAgent: null };
  }
})();

const root = path.resolve(__dirname, "..");
const deployment = JSON.parse(fs.readFileSync(path.join(root, "deployments", "bsc-kapi-mint.json"), "utf8"));
const apiKey = process.env.BSCSCAN_API_KEY || "";

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function request(method, query, body) {
  return new Promise((resolve, reject) => {
    const url = new URL("https://api.etherscan.io/v2/api");
    Object.entries({ chainid: "56", ...query }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const payload = body ? new URLSearchParams(body).toString() : "";
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
    const agent = proxyUrl && HttpsProxyAgent ? new HttpsProxyAgent(proxyUrl) : undefined;
    const req = https.request(url, {
      method,
      agent,
      headers: payload ? { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(payload) } : {},
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(raw.slice(0, 300))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("verification request timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

async function verify(address, sourceName, contractName, constructorArgs = []) {
  const base = `artifacts/${sourceName}/${contractName}`;
  const artifact = readJson(`${base}.json`);
  const dbgPath = path.join(root, `${base}.dbg.json`);
  const dbg = JSON.parse(fs.readFileSync(dbgPath, "utf8"));
  const buildInfo = JSON.parse(fs.readFileSync(path.resolve(path.dirname(dbgPath), String(dbg.buildInfo).replace(/\\/g, "/")), "utf8"));
  const constructor = artifact.abi.find((item) => item.type === "constructor");
  const encoded = constructorArgs.length
    ? ethers.AbiCoder.defaultAbiCoder().encode(constructor.inputs.map((item) => item.type), constructorArgs).slice(2)
    : "";
  const submit = await request("POST", {}, {
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: address,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: "solidity-standard-json-input",
    contractname: `${sourceName}:${contractName}`,
    compilerversion: String(buildInfo.solcLongVersion).startsWith("v") ? buildInfo.solcLongVersion : `v${buildInfo.solcLongVersion}`,
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: encoded,
    licenseType: "3",
  });
  if (submit.status !== "1") {
    if (/already verified/i.test(String(submit.result))) return console.log(contractName, "already verified");
    throw new Error(`${contractName}: ${submit.message || ""} ${submit.result || ""}`);
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const status = await request("GET", { module: "contract", action: "checkverifystatus", apikey: apiKey, guid: submit.result });
    if (status.status === "1" || /pass - verified|already verified/i.test(String(status.result))) {
      console.log(contractName, "verified");
      return;
    }
    if (!/pending|in progress/i.test(String(status.result))) throw new Error(`${contractName}: ${status.result}`);
  }
  throw new Error(`${contractName}: verification timed out`);
}

async function main() {
  if (!apiKey) throw new Error("BSCSCAN_API_KEY is not configured");
  await verify(deployment.tokenDeployer, "contracts/mint/KimiMintDeployers.sol", "KimiMintTokenDeployer");
  await verify(deployment.vaultDeployer, "contracts/mint/KimiMintDeployers.sol", "KimiMintVaultDeployer");
  await verify(deployment.factory, "contracts/mint/KimiMintLaunchFactory.sol", "KimiMintLaunchFactory", [
    deployment.platformFeeReceiver,
    0,
    deployment.creationFeeToken,
    deployment.creationFeeAmount,
    deployment.liquidityRouter,
    deployment.tokenDeployer,
    deployment.vaultDeployer,
    deployment.requiredTokenSuffix,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
