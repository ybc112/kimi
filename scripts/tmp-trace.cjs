const { JsonRpcProvider } = require('ethers');

const TX = '0x2c677c68a788724a98721bffe34f4c2d47e905a8d9fb84834c805c42b5eb0630';
const RPC = 'https://rpc-bsc.48.club';

async function main() {
  const p = new JsonRpcProvider(RPC);
  const res = await p.send('trace_transaction', [TX]);
  console.log(JSON.stringify(res, null, 2).slice(0, 4000));
}

main().catch(e => { console.error(e); process.exit(1); });
