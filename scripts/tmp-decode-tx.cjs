require('dotenv').config();
const { JsonRpcProvider, Contract, Interface,AbiCoder } = require('ethers');

const TX = '0x2c677c68a788724a98721bffe34f4c2d47e905a8d9fb84834c805c42b5eb0630';
const RPC = 'https://rpc-bsc.48.club';

async function main() {
  const p = new JsonRpcProvider(RPC);
  const tx = await p.getTransaction(TX);
  console.log('to', tx.to);
  console.log('input length', tx.data.length);
  const abi = require('../artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json').abi;
  const iface = new Interface(abi);
  const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
  console.log('function', decoded.name);
  console.log('salt', decoded.args.salt);
  const params = decoded.args.params;
  const fields = ['name','symbol','metadataUri','templateId','paymentToken','rewardToken','rewardThreshold','totalSupply','mintCount','whitelistMintCount','publicMintCount','mintPrice','maxMintPerWallet','whitelistEnabled','buyTaxBps','sellTaxBps','transferTaxBps','addLiquidityTaxBps','removeLiquidityTaxBps','launchProtectionTaxBps','launchProtectionBlocks','claimWait','fundFeeBps','lpFeeBps','dividendFeeBps','burnFeeBps','receiver'];
  const out = {};
  for (const f of fields) out[f] = params[f];
  console.log(JSON.stringify(out, (k,v)=>typeof v==='bigint'?v.toString():v, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
