'use strict';
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  (function () {
    let ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          const ar = [];
          for (const k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      const result = {};
      if (mod != null)
        for (let k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = __importStar(require('fs'));
const path_1 = __importDefault(require('path'));
const ethers_1 = require('ethers');
const logger_1 = require('../src/lib/logger');
const logger = new logger_1.CircuitLogger('deploy-verifier');
async function main() {
  const rpc = process.env['RPC_URL'] || 'http://127.0.0.1:8545';
  const provider = new ethers_1.JsonRpcProvider(rpc);
  const signer = await provider.getSigner(0);
  // Use path relative to project root to avoid hardcoded paths
  const solPath = path_1.default.join(
    process.cwd(),
    'contracts',
    'ExamProofVerifier.sol'
  );
  const solSource = (0, fs_1.readFileSync)(solPath, 'utf8');
  // Simple compile via solc (assumes solc installed as node dep)
  // Use dynamic import to be compatible with ESM runtime
  const solcModule = await Promise.resolve().then(() =>
    __importStar(require('solc'))
  );
  const solc =
    solcModule && solcModule.default ? solcModule.default : solcModule;
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
  const factory = new ethers_1.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  // ethers v6: waitForDeployment and getAddress
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  logger.info('Deployed at', { address });
  // Ensure artifacts directory exists before writing address
  const artifactsDir = path_1.default.join(process.cwd(), 'artifacts');
  if (!fs_1.default.existsSync(artifactsDir))
    fs_1.default.mkdirSync(artifactsDir, { recursive: true });
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
  const outPath = path_1.default.join(
    process.cwd(),
    'artifacts',
    `verifier-address.${String(chainId)}.json`
  );
  // stringify chainId to avoid BigInt serialization issues
  const payload = { address, chainId: String(chainId), rpc };
  fs_1.default.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  // Deploy the wrapper contract (compile and deploy VerifierWrapper.sol)
  const wrapperPath = path_1.default.join(
    process.cwd(),
    'contracts',
    'VerifierWrapper.sol'
  );
  if (fs_1.default.existsSync(wrapperPath)) {
    try {
      const wrapperSource = fs_1.default.readFileSync(wrapperPath, 'utf8');
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
        const wrapperFactory = new ethers_1.ContractFactory(
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
        const wrapperOut = path_1.default.join(
          process.cwd(),
          'artifacts',
          `wrapper-address.${String(chainId)}.json`
        );
        fs_1.default.writeFileSync(
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
        compileErr
      );
    }
  } else {
    logger.warn('VerifierWrapper.sol not found; skipping wrapper deployment');
  }
}
main().catch((e) => {
  logger.error('Main function failed', e);
  process.exit(1);
});
