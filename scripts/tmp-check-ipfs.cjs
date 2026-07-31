const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { JsonRpcProvider } = require('ethers');
const { createHash } = require('crypto');

const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';

async function main() {
  const input = JSON.parse(fs.readFileSync(path.join('work', 'full-standard-json-input.json'), 'utf8'));
  input.settings.outputSelection['*']['*'].push('metadata');
  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import: (importPath) => {
      const candidates = [
        path.join(process.cwd(), importPath),
        path.join(process.cwd(), 'contracts', importPath),
        path.join(process.cwd(), 'node_modules', importPath),
      ];
      for (const c of candidates) if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
      return { error: 'Not found: ' + importPath };
    },
  }));
  const compiled = output.contracts['contracts/mint/KimiMintToken.sol'].KimiMintToken;
  const metaJson = compiled.metadata;
  console.log('compiled metadata sha256', '0x' + createHash('sha256').update(metaJson).digest('hex'));
  console.log('metadata outputSelection', JSON.stringify(JSON.parse(metaJson).settings.outputSelection, null, 2).slice(0, 500));

  const p = new JsonRpcProvider('https://rpc-bsc.48.club');
  const code = await p.getCode(TOKEN);
  const s = code.replace(/^0x/, '');
  const len = parseInt(s.slice(-4), 16);
  const ipfsBytes = s.slice(-4 - 2 * len, -4 + 68 - 2 * len); // actually ipfs multihash length 34 bytes = 68 hex after cbor start
  // Easier: decode cbor
  const cbor = require('cbor');
  const decoded = cbor.decodeAllSync(Buffer.from(s.slice(-4 - 2 * len, -4), 'hex'));
  const ipfsHash = '0x' + decoded[0].ipfs.toString('hex');
  console.log('onchain ipfs multihash', ipfsHash);
  console.log('onchain sha256 from ipfs', '0x' + ipfsHash.slice(6)); // 0x1220 + 32 bytes
}

main().catch(e => { console.error(e); process.exit(1); });
