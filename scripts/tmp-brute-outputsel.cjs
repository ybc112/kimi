const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { JsonRpcProvider } = require('ethers');
const { createHash } = require('crypto');

const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';
const projectRoot = process.cwd();

function collectSources(entryFile, normalize) {
  const sources = {};
  const seen = new Set();
  function resolveImport(importPath, fromFileDir) {
    if (importPath.startsWith('.')) {
      const candidate = path.resolve(fromFileDir, importPath);
      if (fs.existsSync(candidate)) {
        let importKey = path.relative(projectRoot, candidate).replace(/\\/g, '/');
        importKey = importKey.replace(/^node_modules\//, '');
        return { filePath: candidate, importKey };
      }
      return null;
    }
    const candidates = [path.join(projectRoot, importPath), path.join(projectRoot, 'contracts', importPath), path.join(projectRoot, 'node_modules', importPath)];
    for (const c of candidates) if (fs.existsSync(c)) return { filePath: c, importKey: importPath };
    return null;
  }
  function processFile(filePath, importKey) {
    if (seen.has(filePath)) return;
    seen.add(filePath);
    let content = fs.readFileSync(filePath, 'utf8');
    if (normalize) content = content.replace(/\r\n?/g, '\n');
    const key = importKey || path.relative(projectRoot, filePath).replace(/\\/g, '/');
    sources[key] = { content };
    const importRegex = /import\s+(?:(?:\{[^}]*\}|[^;{]+)\s+from\s+)?[""]([^""]+)[""];/g;
    let match;
    const fromFileDir = path.dirname(filePath);
    while ((match = importRegex.exec(content)) !== null) {
      const resolved = resolveImport(match[1], fromFileDir);
      if (resolved) processFile(resolved.filePath, resolved.importKey);
    }
  }
  processFile(path.resolve(projectRoot, entryFile));
  return sources;
}

async function main() {
  const p = new JsonRpcProvider('https://rpc-bsc.48.club');
  const code = await p.getCode(TOKEN);
  const s = code.replace(/^0x/, '');
  const len = parseInt(s.slice(-4), 16);
  const cbor = require('cbor');
  const decoded = cbor.decodeAllSync(Buffer.from(s.slice(-4 - 2 * len, -4), 'hex'));
  const target = '0x' + decoded[0].ipfs.toString('hex').slice(4);
  console.log('target sha256', target);

  const selections = [
    ['metadata'],
    ['abi', 'metadata'],
    ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'],
    ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.methodIdentifiers', 'metadata'],
  ];
  for (const sel of selections) {
    for (const normalize of [false, true]) {
      for (const useLit of [false, true]) {
        const fullSources = collectSources('contracts/mint/KimiMintToken.sol', normalize);
        const input = {
          language: 'Solidity',
          sources: fullSources,
          settings: {
            viaIR: true,
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { '*': { '*': sel } },
            metadata: useLit ? { useLiteralContent: true } : {},
          },
        };
        const output = JSON.parse(solc.compile(JSON.stringify(input), {
          import: (importPath) => {
            const candidates = [path.join(projectRoot, importPath), path.join(projectRoot, 'contracts', importPath), path.join(projectRoot, 'node_modules', importPath)];
            for (const c of candidates) if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
            return { error: 'Not found: ' + importPath };
          },
        }));
        const compiled = output.contracts['contracts/mint/KimiMintToken.sol'].KimiMintToken;
        const metaJson = compiled.metadata;
        const hash = '0x' + createHash('sha256').update(metaJson).digest('hex');
        const match = hash.toLowerCase() === target.toLowerCase();
        console.log('sel', sel.length, 'norm', normalize, 'useLit', useLit, 'hash', hash, 'match', match);
        if (match) {
          console.log('FOUND!');
          fs.writeFileSync('work/full-standard-json-input-matched.json', JSON.stringify(input));
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
