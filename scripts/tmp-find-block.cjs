const { JsonRpcProvider } = require('ethers');

const TARGET = 1785472252;
const RPC = 'https://rpc-bsc.48.club';

async function main() {
  const p = new JsonRpcProvider(RPC);
  let lo = 113000000;
  let hi = await p.getBlockNumber();
  console.log('latest', hi);
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await p.getBlock(mid);
    if (!b) { console.log('missing block', mid); break; }
    console.log('mid', mid, 'ts', b.timestamp, 'diff', TARGET - b.timestamp);
    if (b.timestamp < TARGET) lo = mid + 1;
    else hi = mid - 1;
  }
  const block = await p.getBlock(hi);
  console.log('closest block', hi, 'timestamp', block.timestamp, 'target', TARGET);
}

main().catch(e => { console.error(e); process.exit(1); });
