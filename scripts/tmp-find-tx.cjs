require('dotenv').config();
const { JsonRpcProvider, Contract, id, zeroPadValue } = require('ethers');

async function main() {
  const p = new JsonRpcProvider('https://rpc-bsc.48.club');
  const token = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';
  const factory = '0x084c85f7Cf1d9cf3d638EF75b1561E464884dfbC';
  const iface = ["event LaunchCreated(address indexed creator,address indexed token,address indexed vault,bytes32 templateId,string name,string symbol,uint256 totalSupply,uint256 mintCount,uint256 mintPrice,address paymentToken,bool whitelistEnabled,string metadataUri)"];
  const c = new Contract(factory, iface, p);
  const topic0 = id("LaunchCreated(address,address,address,bytes32,string,string,uint256,uint256,uint256,address,bool,string)");
  const topic2 = zeroPadValue(token, 32);
  console.log('topic0', topic0);
  console.log('topic2', topic2);
  const from = 113138000;
  const to = 113138500;
  const logs = await p.getLogs({ address: factory, topics: [topic0, null, topic2], fromBlock: from, toBlock: to });
  console.log('logs', logs.length);
  for (const log of logs) {
    console.log('txHash', log.transactionHash, 'block', log.blockNumber);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
