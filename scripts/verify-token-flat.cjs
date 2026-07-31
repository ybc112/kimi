// Verify Token contract using flattened source
const https = require("https");
const fs = require("fs");
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");

const proxyUrl = process.env.HTTPS_PROXY || "http://127.0.0.1:7898";
const agent = new HttpsProxyAgent(proxyUrl);

const flatSrc = fs.readFileSync(path.join(process.cwd(), "work", "flattened.sol"), "utf8");
const tokenArgs = fs.readFileSync("/tmp/token_args_v2.txt", "utf8").trim();

const body = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  apikey: "Y9SWA2SK9A2MUEBHGVR5Q4TSHQ3U4R5YES",
  contractaddress: "0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777",
  sourceCode: flatSrc,
  codeformat: "solidity-single-file",
  contractname: "KimiMintToken",
  compilerversion: "v0.8.36+commit.8a079791",
  optimizationUsed: "1",
  runs: "200",
  constructorArguements: tokenArgs,
  licenseType: "3",
  evmversion: "london",
}).toString();

console.log("Payload size:", Buffer.byteLength(body), "bytes");

const req = https.request(
  "https://api.etherscan.com/v2/api?chainid=56",
  {
    method: "POST",
    agent,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => {
      const r = JSON.parse(d);
      console.log("Status:", r.status, r.message);
      console.log("Result:", r.result);
    });
  },
);
req.on("error", (e) => console.error("Error:", e.message));
req.write(body);
req.end();
