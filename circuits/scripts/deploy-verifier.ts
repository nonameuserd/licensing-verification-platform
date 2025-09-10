import { readFileSync } from 'fs';
import path from 'path';
import { JsonRpcProvider, ContractFactory } from 'ethers';
import { circuitLogger as logger } from '../src/lib/logger.js';

async function main() {
  const rpc = process.env['RPC_URL'] || 'http://127.0.0.1:8545';
  const provider = new JsonRpcProvider(rpc);
  const signer = await provider.getSigner(0);

  const solPath = path.join(
    __dirname,
    '..',
    'contracts',
    'ExamProofVerifier.sol'
  );
  const solSource = readFileSync(solPath, 'utf8');

  // Simple compile via solc (assumes solc installed as node dep)
  const solc = require('solc');
  const input = {
    language: 'Solidity',
    sources: {
      'ExamProofVerifier.sol': { content: solSource },
    },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contractName = Object.keys(
    output.contracts['ExamProofVerifier.sol']
  )[0];
  const abi = output.contracts['ExamProofVerifier.sol'][contractName].abi;
  const bytecode =
    '0x' +
    output.contracts['ExamProofVerifier.sol'][contractName].evm.bytecode.object;

  logger.info('Deploying ExamProofVerifier...');
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  // ethers v6: waitForDeployment and getAddress
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  logger.info('Deployed at:', address);
  // Write address to file for downstream steps
  const outPath = path.join(process.cwd(), 'artifacts', 'verifier-address.txt');
  require('fs').writeFileSync(outPath, address);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
