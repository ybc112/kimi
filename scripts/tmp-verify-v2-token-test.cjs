require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { AbiCoder } = require('ethers');

const API_KEY = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';
const rootDir = process.cwd();

function requestJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method,
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) },
      timeout: 120000,
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error(raw.slice(0, 300))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

function encodeArgs(abi, args) {
  const ctor = abi.find(i => i.type === 'constructor');
  if (!ctor || ctor.inputs.length === 0) return '';
  const typeStr = i => i.type.startsWith('tuple') ? `(${i.components.map(typeStr).join(',')})${i.type.slice('tuple'.length)}` : i.type;
  return AbiCoder.defaultAbiCoder().encode(ctor.inputs.map(typeStr), args).slice(2);
}

async function submit(contractName) {
  const sourceCode = fs.readFileSync(path.join(rootDir, 'work', 'full-standard-json-input.json'), 'utf8');
  const tokenAbi = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'contracts', 'mint', 'KimiMintToken.sol', 'KimiMintToken.json'), 'utf8')).abi;
  const tokenArgs = require(path.join(rootDir, 'work', 'verify-args', TOKEN.toLowerCase(), 'token.cjs'));
  const encodedArgs = encodeArgs(tokenAbi, tokenArgs);
  const buildInfo = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'build-info', 'b3bfe6f56dc8da7f.json'), 'utf8'));
  const compilerVersion = 'v' + buildInfo.solcVersion + '+commit.' + buildInfo.solcLongVersion.split('+commit.')[1].split('.')[0];
  const body = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    apikey: API_KEY,
    contractaddress: TOKEN,
    sourceCode,
    codeformat: 'solidity-standard-json-input',
    contractname: contractName,
    compilerversion: compilerVersion,
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: encodedArgs,
    licenseType: '3',
  }).toString();
  console.log('Trying contractname:', contractName);
  const submit = await requestJson('POST', 'https://api.etherscan.com/v2/api?chainid=56', body);
  console.log('submit:', JSON.stringify(submit));
}

async function main() {
  await submit('contracts/mint/KimiMintToken.sol:KimiMintToken');
  await submit('KimiMintToken');
  await submit('mint/KimiMintToken.sol:KimiMintToken');
}

main().catch(e => { console.error(e); process.exit(1); });
