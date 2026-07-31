const { JsonRpcProvider } = require('ethers');
const cbor = require('cbor');

const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';

async function main() {
  const p = new JsonRpcProvider('https://rpc-bsc.48.club');
  const code = await p.getCode(TOKEN);
  const s = code.replace(/^0x/, '');
  const len = parseInt(s.slice(-4), 16);
  const cborHex = s.slice(-4 - 2 * len, -4);
  console.log('cbor length bytes', len);
  console.log('cbor hex first 200:', cborHex.slice(0, 200));
  const decoded = cbor.decodeAllSync(Buffer.from(cborHex, 'hex'));
  console.log(JSON.stringify(decoded, (k, v) => {
    if (Buffer.isBuffer(v)) return '0x' + v.toString('hex');
    if (v instanceof Uint8Array) return '0x' + Buffer.from(v).toString('hex');
    return v;
  }, 2).slice(0, 4000));
}

main().catch(e => { console.error(e); process.exit(1); });
