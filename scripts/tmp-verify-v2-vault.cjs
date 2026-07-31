require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { AbiCoder } = require('ethers');

const API_KEY = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';
const VAULT = '0x986F3cA53c8097315F1595c877E16Ed6FA77a033';
const CONTRACT = 'contracts/mint/KimiMintVault.sol:KimiMintVault';
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

async function main() {
  const sourceCode = fs.readFileSync(path.join(rootDir, 'work', 'full-standard-json-input.json'), 'utf8');
  const abi = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'contracts', 'mint', 'KimiMintVault.sol', 'KimiMintVault.json'), 'utf8')).abi;
  const args = require(path.join(rootDir, 'work', 'verify-args', TOKEN.toLowerCase(), 'vault.cjs'));
  const encodedArgs = encodeArgs(abi, args);
  const buildInfo = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'build-info', 'b3bfe6f56dc8da7f.json'), 'utf8'));
  const compilerVersion = 'v' + buildInfo.solcVersion + '+commit.' + buildInfo.solcLongVersion.split('+commit.')[1].split('.')[0];

  const body = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    apikey: API_KEY,
    contractaddress: VAULT,
    sourceCode,
    codeformat: 'solidity-standard-json-input',
    contractname: CONTRACT,
    compilerversion: compilerVersion,
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: encodedArgs,
    licenseType: '3',
  }).toString();

  console.log('Submitting Vault to Etherscan V2...');
  const submit = await requestJson('POST', 'https://api.etherscan.com/v2/api?chainid=56', body);
  console.log('submit:', JSON.stringify(submit));
  if (submit.status !== '1') {
    console.error('submit failed:', submit.message, submit.result);
    process.exit(1);
  }
  const guid = String(submit.result);
  for (let i = 1; i <= 30; i++) {
    await new Promise(r => setTimeout(r, 6000));
    const pollBody = new URLSearchParams({ chainid: '56', module: 'contract', action: 'checkverifystatus', apikey: API_KEY, guid }).toString();
    const status = await requestJson('POST', 'https://api.etherscan.com/v2/api', pollBody);
    console.log(`poll ${i}:`, JSON.stringify(status));
    const result = String(status.result || '');
    if (/pass - verified|already verified/i.test(result)) { console.log('Vault verified!'); return; }
    if (/pending|in progress/i.test(result)) continue;
    console.error('verification failed:', status.message, result);
    process.exit(1);
  }
  console.error('timeout'); process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
