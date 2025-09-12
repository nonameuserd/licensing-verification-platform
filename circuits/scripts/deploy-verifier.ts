import fs, { readFileSync } from 'fs';
import path from 'path';
import { JsonRpcProvider, ContractFactory } from 'ethers';
import { CircuitLogger } from '../src/lib/logger';

const logger = new CircuitLogger('deploy-verifier');

async function main() {
  const rpc = process.env['RPC_URL'] || 'http://127.0.0.1:8545';
  const provider = new JsonRpcProvider(rpc);
  const signer = await provider.getSigner(0);

  // Use path relative to project root to avoid hardcoded paths
  const solPath = path.join(
    process.cwd(),
    'contracts',
    'ExamProofVerifier.sol'
  );
  const solSource = readFileSync(solPath, 'utf8');

  // Simple compile via solc (assumes solc installed as node dep)
  // Use dynamic import to be compatible with ESM runtime
  const solcModule = await import('solc');
  const solc =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solcModule && (solcModule as any).default
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (solcModule as any).default
      : solcModule;
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
  logger.info('Deployed at', { address });
  // Ensure artifacts directory exists before writing address
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir))
    fs.mkdirSync(artifactsDir, { recursive: true });
  // Validate that the deployed address has code (defensive check)
  const deployedCode = await provider.getCode(address);
  if (!deployedCode || deployedCode === '0x') {
    throw new Error(
      `Deployed contract at ${address} has no code; deployment likely failed. Provider RPC: ${rpc}`
    );
  }
  // Write address to file for downstream steps. Include chainId + rpc for sanity checks.
  const network = await provider.getNetwork();
  const chainId = network.chainId;
  const outPath = path.join(
    process.cwd(),
    'artifacts',
    `verifier-address.${String(chainId)}.json`
  );
  // stringify chainId to avoid BigInt serialization issues
  const payload = { address, chainId: String(chainId), rpc };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  // Deploy the wrapper contract (compile and deploy VerifierWrapper.sol)
  const wrapperPath = path.join(
    process.cwd(),
    'contracts',
    'VerifierWrapper.sol'
  );
  if (fs.existsSync(wrapperPath)) {
    try {
      const wrapperSource = fs.readFileSync(wrapperPath, 'utf8');
      const input2 = {
        language: 'Solidity',
        sources: { 'VerifierWrapper.sol': { content: wrapperSource } },
        settings: {
          outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
        },
      };
      const output2 = JSON.parse(solc.compile(JSON.stringify(input2)));
      if (
        !output2 ||
        !output2.contracts ||
        !output2.contracts['VerifierWrapper.sol']
      ) {
        logger.warn(
          'solc did not return compiled wrapper contract; skipping wrapper deployment'
        );
      } else {
        const wrapperKeys = Object.keys(
          output2.contracts['VerifierWrapper.sol']
        );
        // Prefer the concrete VerifierWrapper contract if present (skip interfaces)
        const wrapperName = wrapperKeys.includes('VerifierWrapper')
          ? 'VerifierWrapper'
          : wrapperKeys[0];
        const wrapperAbi =
          output2.contracts['VerifierWrapper.sol'][wrapperName].abi;
        const wrapperBytecode =
          '0x' +
          output2.contracts['VerifierWrapper.sol'][wrapperName].evm.bytecode
            .object;

        logger.info('Deploying VerifierWrapper...');
        const wrapperFactory = new ContractFactory(
          wrapperAbi,
          wrapperBytecode,
          signer
        );
        const wrapper = await wrapperFactory.deploy(address);
        await wrapper.waitForDeployment();
        const wrapperAddress = await wrapper.getAddress();
        logger.info('Wrapper deployed at', { wrapperAddress });
        // Validate wrapper code present
        const wrapperCode = await provider.getCode(wrapperAddress);
        if (!wrapperCode || wrapperCode === '0x') {
          logger.warn(
            'Wrapper deployed but node reports no code at that address',
            {
              wrapperAddress,
              rpc,
            }
          );
        }
        const wrapperOut = path.join(
          process.cwd(),
          'artifacts',
          `wrapper-address.${String(chainId)}.json`
        );
        fs.writeFileSync(
          wrapperOut,
          JSON.stringify(
            { address: wrapperAddress, chainId: String(chainId), rpc },
            null,
            2
          )
        );
      }
    } catch (compileErr) {
      logger.error(
        'Failed to compile or deploy VerifierWrapper.sol; skipping wrapper',
        compileErr as Error
      );
    }
  } else {
    logger.warn('VerifierWrapper.sol not found; skipping wrapper deployment');
  }
}

main().catch((e) => {
  logger.error('Main function failed', e as Error);
  process.exit(1);
});
