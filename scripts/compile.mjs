import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
const source = fs.readFileSync('contracts/Mainstreet.sol', 'utf8');
const input = { language: 'Solidity', sources: { 'Mainstreet.sol': { content: source } }, settings: {
  optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', viaIR: true,
  outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences'] } }
}};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: name => {
  const file = path.resolve('node_modules', name);
  return fs.existsSync(file) ? { contents: fs.readFileSync(file, 'utf8') } : { error: `Missing ${name}` };
}}));
for (const error of output.errors || []) console[error.severity === 'error' ? 'error' : 'warn'](error.formattedMessage);
if (output.errors?.some(e => e.severity === 'error')) process.exit(1);
const artifacts = {};
for (const [name, c] of Object.entries(output.contracts['Mainstreet.sol'])) {
  const bytecode = '0x' + c.evm.bytecode.object;
  artifacts[name] = { abi: c.abi, bytecode, deployedBytecode: '0x' + c.evm.deployedBytecode.object, immutableReferences: c.evm.deployedBytecode.immutableReferences };
  console.log(`${name}: deployment ${bytecode.length / 2 - 1} bytes; runtime ${c.evm.deployedBytecode.object.length / 2} bytes`);
}
fs.mkdirSync('dist/contracts', { recursive: true });
fs.writeFileSync('dist/contracts/artifacts.json', JSON.stringify(artifacts));
fs.writeFileSync('dist/contracts/Mainstreet.sol', source);
