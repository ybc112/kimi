const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { execFileSync } = require("node:child_process");
const { AbiCoder, Contract, JsonRpcProvider, getAddress, isAddress } = require("ethers");

const root = process.cwd();
const deployment = readJson("deployments/bsc-KimiNFTLaunchFactory.json");
const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY || "";
const apiUrl = process.env.ETHERSCAN_V2_API_URL || "https://api.etherscan.io/v2/api";
const target = getAddress(process.env.NFT_VERIFY_ADDRESS || deployment.factory);

async function main() {
  if (!apiKey) throw new Error("BSCSCAN_API_KEY or ETHERSCAN_API_KEY is required");
  if (target.toLowerCase() === deployment.factory.toLowerCase()) {
    await verify({ address: target, sourceName: "contracts/nft/KimiNFTLaunchFactory.sol", contractName: "KimiNFTLaunchFactory", args: [deployment.feeRecipient, Number.parseInt(deployment.requiredCollectionSuffix || "0", 16)] });
    return;
  }
  const rpc = process.env.KIMIMINT_RPC_URL || process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
  const artifact = readJson("artifacts/contracts/nft/KimiNFTCollection.sol/KimiNFTCollection.json");
  const collection = new Contract(target, artifact.abi, new JsonRpcProvider(rpc, 56));
  const [name, symbol, description, imageURI, baseURI, maxSupply, mintPrice, maxWallet, owner] = await Promise.all([
    collection.name(), collection.symbol(), collection.description(), collection.imageURI(), collection.baseTokenURI(),
    collection.maxSupply(), collection.mintPrice(), collection.maxMintPerWallet(), collection.owner(),
  ]);
  await verify({ address: target, sourceName: "contracts/nft/KimiNFTCollection.sol", contractName: "KimiNFTCollection", args: [name, symbol, description, imageURI, baseURI, maxSupply, mintPrice, maxWallet, owner] });
}

async function verify({ address, sourceName, contractName, args }) {
  const artifact = readJson(`artifacts/${sourceName}/${contractName}.json`);
  const dbg = readJson(`artifacts/${sourceName}/${contractName}.dbg.json`);
  const buildInfo = JSON.parse(fs.readFileSync(path.resolve(path.dirname(path.join(root, "artifacts", sourceName, `${contractName}.dbg.json`)), String(dbg.buildInfo).replace(/\\/g, "/")), "utf8"));
  const longVersion = String(buildInfo.solcLongVersion || "");
  const versionMatch = longVersion.match(/^(\d+\.\d+\.\d+\+commit\.[a-f0-9]+)/i);
  const compilerVersion = versionMatch ? `v${versionMatch[1]}` : `v${buildInfo.solcVersion || "0.8.36"}`;
  const fullInput = path.join(root, "work", "full-standard-json-input.json");
  const sourceCode = fs.existsSync(fullInput) ? fs.readFileSync(fullInput, "utf8") : JSON.stringify(buildInfo.input);
  const constructor = artifact.abi.find((item) => item.type === "constructor");
  const encoded = constructor?.inputs?.length ? AbiCoder.defaultAbiCoder().encode(constructor.inputs.map((item) => item.type), args).slice(2) : "";
  const contract = `${sourceName}:${contractName}`;
  const submit = await request("POST", { chainid: "56" }, { module: "contract", action: "verifysourcecode", apikey: apiKey, contractaddress: address, sourceCode, codeformat: "solidity-standard-json-input", contractname: contract, compilerversion: compilerVersion, optimizationUsed: "1", runs: "200", constructorArguements: encoded, licenseType: "3" });
  const submitResult = String(submit.result || "");
  if (submit.status !== "1") {
    if (/already verified/i.test(submitResult)) { console.log(`${address} already verified`); return; }
    throw new Error(`V2 submit failed: ${submit.message || ""} ${submitResult}`);
  }
  const guid = submitResult; console.log(`submitted ${guid}`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const status = await request("GET", { chainid: "56", module: "contract", action: "checkverifystatus", apikey: apiKey, guid });
    const result = String(status.result || "");
    if (status.status === "1" || /pass - verified|already verified/i.test(result)) { console.log(`${address} verified`); return; }
    if (/pending|in progress/i.test(result)) continue;
    throw new Error(`V2 verification failed: ${status.message || ""} ${result}`);
  }
  throw new Error(`V2 verification timed out for ${address}`);
}

function request(method, query, body) {
  if (process.env.ETHERSCAN_USE_CURL !== "false") {
    const url = new URL(apiUrl); Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const args = ["-sS", "--max-time", "120", "-X", method, url.toString()];
    let tempBody = "";
    if (body) {
      tempBody = path.join(root, "work", `etherscan-v2-${Date.now()}.txt`);
      fs.mkdirSync(path.dirname(tempBody), { recursive: true });
      fs.writeFileSync(tempBody, new URLSearchParams(body).toString());
      args.push("--data-binary", `@${tempBody}`);
    }
    try { return Promise.resolve(JSON.parse(execFileSync("curl.exe", args, { encoding: "utf8", timeout: 125000 }))); }
    catch (error) { return Promise.reject(new Error(`Etherscan V2 curl failed: ${error instanceof Error ? error.message : String(error)}`)); }
    finally { if (tempBody && fs.existsSync(tempBody)) fs.unlinkSync(tempBody); }
  }
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl); Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const payload = body ? new URLSearchParams(body).toString() : "";
    const req = https.request(url, { method, headers: payload ? { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(payload) } : {} }, (res) => { let raw = ""; res.on("data", (chunk) => raw += chunk); res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error(`Invalid V2 response: ${raw.slice(0, 200)}`)); } }); });
    req.on("error", reject); req.setTimeout(120000, () => req.destroy(new Error("Etherscan V2 timeout"))); if (payload) req.write(payload); req.end();
  });
}
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); }
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
