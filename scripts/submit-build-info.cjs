// Submit verification using raw build-info input (exact compilation input)
const https = require("https");
const fs = require("fs");
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");

const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || "http://127.0.0.1:7898");
const addr = process.argv[2];
const contract = process.argv[3];
const argsFile = process.argv[4];

// Read the build-info (first one found)
const buildInfoDir = path.join(process.cwd(), "artifacts", "build-info");
const files = fs.readdirSync(buildInfoDir).filter(f => f.endsWith(".json"));
const bi = JSON.parse(fs.readFileSync(path.join(buildInfoDir, files[0]), "utf8"));
const sourceCode = JSON.stringify(bi.input);
// Strip .Emscripten.clang suffix if present
const rawVersion = bi.solcLongVersion || "";
const version = rawVersion.startsWith("v")
  ? rawVersion.replace(/\.Emscripten\.clang$/, "")
  : "v" + rawVersion.replace(/\.Emscripten\.clang$/, "");
const encodedArgs = argsFile ? fs.readFileSync(argsFile, "utf8").trim() : "";

console.log("Sources:", Object.keys(bi.input.sources).length);
console.log("Compiler:", version);
console.log("Payload:", Buffer.byteLength(sourceCode), "bytes");

const body = new URLSearchParams({
  module: "contract", action: "verifysourcecode",
  apikey: "Y9SWA2SK9A2MUEBHGVR5Q4TSHQ3U4R5YES",
  contractaddress: addr, sourceCode,
  codeformat: "solidity-standard-json-input",
  contractname: contract, compilerversion: version,
  optimizationUsed: "1", runs: "200",
  constructorArguements: encodedArgs, licenseType: "3",
}).toString();

const req = https.request("https://api.etherscan.com/v2/api?chainid=56", {
  method: "POST", agent,
  headers: { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(body) },
}, (res) => {
  let d = ""; res.on("data", c => d += c);
  res.on("end", () => { const r = JSON.parse(d); console.log(r.status, r.message, r.result); });
});
req.on("error", e => console.error(e.message));
req.write(body); req.end();
