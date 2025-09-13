#!/usr/bin/env ts-node
'use strict';
/**
 * Deploy verifier contract to testnet
 * Usage: ts-node scripts/deploy-testnet.ts [network]
 * Example: ts-node scripts/deploy-testnet.ts sepolia
 */
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
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const ethers_1 = require('ethers');
const logger_1 = require('../src/lib/logger');
const networks_1 = require('../src/lib/networks');
const logger = new logger_1.CircuitLogger('deploy-testnet');
async function main() {
  const networkName = process.argv[2] || 'sepolia';
  const environment = process.env['NODE_ENV'] || 'development';
  try {
    const network = (0, networks_1.getNetwork)(environment, networkName);
    const privateKey = process.env['PRIVATE_KEY'];
    if (!privateKey) {
      logger.error('PRIVATE_KEY environment variable is required');
      logger.info('Set PRIVATE_KEY in your .env file or environment');
      process.exit(1);
    }
    logger.info(`Deploying to ${network.name} (Chain ID: ${network.chainId})`);
    // Create provider and wallet
    const provider = new ethers_1.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers_1.Wallet(privateKey, provider);
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = Number(balance) / 1e18;
    logger.info(`Wallet balance: ${balanceEth.toFixed(4)} ETH`);
    if (balanceEth < 0.01) {
      logger.warn('Low balance! You may need testnet ETH for deployment');
      logger.info(`Get testnet ETH from faucets:`);
      logger.info(`- Sepolia: https://sepoliafaucet.com/`);
      logger.info(`- Amoy: https://faucet.polygon.technology/`);
      logger.info(
        `- Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia`
      );
      logger.info(
        `- Optimism Sepolia: https://faucet.quicknode.com/optimism/sepolia`
      );
    }
    // Read and compile contract
    const solPath = path_1.default.join(
      process.cwd(),
      'contracts',
      'ExamProofVerifier.sol'
    );
    if (!fs_1.default.existsSync(solPath)) {
      logger.error(`Contract not found: ${solPath}`);
      logger.info(
        'Run "yarn generate-verifier" first to generate the contract'
      );
      process.exit(1);
    }
    const solSource = fs_1.default.readFileSync(solPath, 'utf8');
    // Compile with solc
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
      settings: {
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
        optimizer: { enabled: true, runs: 200 },
      },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors && output.errors.length > 0) {
      logger.error('Compilation errors:', output.errors);
      process.exit(1);
    }
    const contractName = Object.keys(
      output.contracts['ExamProofVerifier.sol']
    )[0];
    const abi = output.contracts['ExamProofVerifier.sol'][contractName].abi;
    const bytecode =
      '0x' +
      output.contracts['ExamProofVerifier.sol'][contractName].evm.bytecode
        .object;
    // Deploy contract
    logger.info('Deploying ExamProofVerifier...');
    const factory = new ethers_1.ContractFactory(abi, bytecode, wallet);
    try {
      const contract = await factory.deploy();
      logger.info(
        `Transaction hash: ${contract.deploymentTransaction()?.hash}`
      );
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      logger.info(`✅ Contract deployed successfully!`);
      logger.info(`Address: ${address}`);
      logger.info(`Network: ${network.name} (${network.chainId})`);
      logger.info(`Explorer: ${getExplorerUrl(networkName, address)}`);
      // Save deployment info
      const artifactsDir = path_1.default.join(process.cwd(), 'artifacts');
      if (!fs_1.default.existsSync(artifactsDir)) {
        fs_1.default.mkdirSync(artifactsDir, { recursive: true });
      }
      const deploymentInfo = {
        address,
        network: networkName,
        chainId: network.chainId,
        rpcUrl: network.rpcUrl,
        deployedAt: new Date().toISOString(),
        transactionHash: contract.deploymentTransaction()?.hash,
      };
      const outPath = path_1.default.join(
        artifactsDir,
        `verifier-address.${network.chainId}.json`
      );
      fs_1.default.writeFileSync(
        outPath,
        JSON.stringify(deploymentInfo, null, 2)
      );
      logger.info(`Deployment info saved to: ${outPath}`);
      // Verify contract has code
      const deployedCode = await provider.getCode(address);
      if (!deployedCode || deployedCode === '0x') {
        throw new Error('Deployed contract has no code');
      }
      logger.info('Contract verification: ✅ Code deployed successfully');
    } catch (error) {
      logger.error('Deployment failed:', error.message);
      process.exit(1);
    }
  } catch (networkErr) {
    logger.error('Network configuration error', networkErr);
    logger.info(
      'Available networks:',
      (0, networks_1.getAvailableNetworks)(environment)
    );
    process.exit(1);
  }
}
function getExplorerUrl(networkName, address) {
  const explorers = {
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
    amoy: `https://amoy.polygonscan.com/address/${address}`,
    arbitrumSepolia: `https://sepolia.arbiscan.io/address/${address}`,
    optimismSepolia: `https://sepolia-optimism.etherscan.io/address/${address}`,
  };
  return explorers[networkName] || '';
}
if (require.main === module) {
  main().catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}
