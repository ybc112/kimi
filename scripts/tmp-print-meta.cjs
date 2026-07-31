const fs = require('fs');
const path = require('path');
const solc = require('solc');

const projectRoot = process.cwd();

function collectSources(entryFile) {
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
    const content = fs.readFileSync(filePath, 'utf8');
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

const input = {
  language: 'Solidity',
  sources: collectSources('contracts/mint/KimiMintToken.sol'),
  settings: {
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['metadata'] } },
    metadata: { useLiteralContent: true },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), {
  import: (importPath) => {
    const candidates = [path.join(projectRoot, importPath), path.join(projectRoot, 'contracts', importPath), path.join(projectRoot, 'node_modules', importPath)];
    for (const c of candidates) if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
    return { error: 'Not found: ' + importPath };
  },
}));
const meta = JSON.parse(output.contracts['contracts/mint/KimiMintToken.sol'].KimiMintToken.metadata);
console.log(JSON.stringify({ output: meta.output ? Object.keys(meta.output) : null, compiler: meta.compiler, language: meta.language, settings: meta.settings, compilationTarget: meta.compilationTarget, version: meta.version }, null, 2));
