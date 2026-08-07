// Quick submit with custom source file
const https = require("https");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");

const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || "http://127.0.0.1:7898");
const addr = process.argv[2];
const contract = process.argv[3];
const argsFile = process.argv[4];
const sourceFile = process.argv[5] || "work/token-only-input.json";

const sourceCode = fs.readFileSync(sourceFile, "utf8");
const encodedArgs = argsFile ? fs.readFileSync(argsFile, "utf8").trim() : "";

const body = new URLSearchParams({
  module: "contract", action: "verifysourcecode",
  apikey: "Y9SWA2SK9A2MUEBHGVR5Q4TSHQ3U4R5YES",
  contractaddress: addr,
  sourceCode,
  codeformat: "solidity-standard-json-input",
  contractname: contract,
  compilerversion: "v0.8.36+commit.8a079791",
  optimizationUsed: "1", runs: "200",
  constructorArguements: encodedArgs,
  licenseType: "3",
}).toString();

const req = https.request("https://api.etherscan.com/v2/api?chainid=56", {
  method: "POST", agent,
  headers: { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(body) },
}, (res) => {
  let d = ""; res.on("data", (c) => d += c);
  res.on("end", () => {
    const r = JSON.parse(d);
    console.log(r.status, r.message, r.result);
  });
});
req.on("error", (e) => console.error(e.message));
req.write(body);
req.end();
