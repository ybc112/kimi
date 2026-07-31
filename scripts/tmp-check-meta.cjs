const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { JsonRpcProvider, keccak256 } = require('ethers');

const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';

function extractMetaHash(hex) {
  const s = hex.replace(/^0x/, '');
  const len = parseInt(s.slice(-4), 16);
  const cborHex = s.slice(-4 - 2 * len);
  return keccak256('0x' + cborHex);
}

async function main() {
  const input = JSON.parse(fs.readFileSync(path.join('work', 'full-standard-json-input.json'), 'utf8'));
  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import: (importPath) => {
      // All imports should already be in sources; if not, try file system
      const candidates = [
        path.join(process.cwd(), importPath),
        path.join(process.cwd(), 'contracts', importPath),
        path.join(process.cwd(), 'node_modules', importPath),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
      }
      return { error: 'Not found: ' + importPath };
    },
  }));
  const errors = output.errors || [];
  for (const e of errors) if (e.severity === 'error') { console.error(e); process.exit(1); }
  const compiled = output.contracts['contracts/mint/KimiMintToken.sol'].KimiMintToken;
  const runtime = compiled.evm.deployedBytecode.object;
  const creation = compiled.evm.bytecode.object;
  console.log('compiled runtime meta hash', extractMetaHash(runtime));
  console.log('compiled creation meta hash', extractMetaHash(creation));

  const p = new JsonRpcProvider('https://rpc-bsc.48.club');
  const onchain = await p.getCode(TOKEN);
  console.log('onchain runtime meta hash', extractMetaHash(onchain));
}

main().catch(e => { console.error(e); process.exit(1); });
