require('dotenv').config();
const fs = require('fs');
const { AbiCoder } = require('ethers');

const API_KEY = process.env.BSCSCAN_API_KEY;
const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  // Get internal txs for the token to find creation input
  const url = `https://api.etherscan.com/v2/api?chainid=56&module=account&action=txlistinternal&address=${TOKEN}&startblock=0&endblock=999999999&sort=asc&apikey=${API_KEY}`;
  const data = await fetchJson(url);
  console.log('txlistinternal status:', data.status, 'result type:', typeof data.result);
  if (typeof data.result === 'string') { console.log('result msg:', data.result); return; }
  const creates = (data.result || []).filter(tx => tx.contractAddress && tx.contractAddress.toLowerCase() === TOKEN.toLowerCase());
  console.log('creation internal txs:', creates.length);
  if (creates.length === 0) {
    console.log('no creation tx found');
    return;
  }
  const tx = creates[0];
  console.log('txHash:', tx.transactionHash);
  console.log('init input length:', (tx.input || '').length);
  console.log('init input first 200:', (tx.input || '').slice(0, 200));
  console.log('init input last 200:', (tx.input || '').slice(-200));

  // Compare with compiled creation bytecode + encoded args (from existing verify args file)
  const tokenAbi = JSON.parse(fs.readFileSync('artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json', 'utf8')).abi;
  const tokenArgs = require('../work/verify-args/0x0166eec08feb66fbad1b9df279a90d5c4cdc7777/token.cjs');
  const constructor = tokenAbi.find(item => item.type === 'constructor');
  const encoded = AbiCoder.defaultAbiCoder().encode(constructor.inputs, tokenArgs).slice(2);
  const compiled = JSON.parse(fs.readFileSync('artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json', 'utf8')).bytecode;
  const expected = compiled.replace(/^0x/, '') + encoded;
  console.log('expected init length:', expected.length);
  console.log('expected init first 200:', expected.slice(0, 200));
  console.log('expected init last 200:', expected.slice(-200));
  console.log('match:', tx.input && tx.input.toLowerCase() === expected.toLowerCase());
}

main().catch(e => { console.error(e); process.exit(1); });
