const { AbiCoder, keccak256, getBytes, concat, zeroPadValue } = require('ethers');
const fs = require('fs');
const path = require('path');

const TOKEN = '0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777';
const DEPLOYER = '0x8fE94c357E192B36e5F614543b5eE9f5804E709a';
const FACTORY = '0x084c85f7Cf1d9cf3d638EF75b1561E464884dfbC';
const CREATOR = '0xe2EF96681a3186bcb3696D38AB75d692902958cf';
const SALT = '0x2324c905484d74c8807448c40ea1516b916d71cf7980a7f6c6842a79bc878ef2';
const NAME = '测试';
const SYMBOL = 'S测试F';
const CHAINID = 56;

function typeStr(i) {
  if (i.type.startsWith('tuple')) {
    return `(${i.components.map(typeStr).join(',')})${i.type.slice('tuple'.length)}`;
  }
  return i.type;
}

async function main() {
  const rootDir = process.cwd();
  const tokenAbi = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'contracts', 'mint', 'KimiMintToken.sol', 'KimiMintToken.json'), 'utf8')).abi;
  const tokenArgs = require(path.join(rootDir, 'work', 'verify-args', TOKEN.toLowerCase(), 'token.cjs'));
  const ctor = tokenAbi.find(i => i.type === 'constructor');
  const encoded = AbiCoder.defaultAbiCoder().encode(ctor.inputs.map(typeStr), tokenArgs);
  const bytecode = JSON.parse(fs.readFileSync(path.join(rootDir, 'artifacts', 'contracts', 'mint', 'KimiMintToken.sol', 'KimiMintToken.json'), 'utf8')).bytecode;
  const initCode = bytecode + encoded.slice(2);
  const initHash = keccak256(initCode);
  const tokenSalt = keccak256(AbiCoder.defaultAbiCoder().encode(['address','bytes32','string','string','uint256'], [CREATOR, SALT, NAME, SYMBOL, CHAINID]));
  console.log('initCode length', initCode.length);
  console.log('initHash', initHash);
  console.log('tokenSalt', tokenSalt);
  const payload = concat(['0xff', DEPLOYER, tokenSalt, initHash]);
  const addr = '0x' + keccak256(payload).slice(-40);
  console.log('computed', addr);
  console.log('actual  ', TOKEN);
  console.log('match', addr.toLowerCase() === TOKEN.toLowerCase());
}

main().catch(e => { console.error(e); process.exit(1); });
