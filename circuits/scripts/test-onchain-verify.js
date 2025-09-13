#!/usr/bin/env ts-node
'use strict';
/**
 * Test on-chain verification on testnet
 * Usage: ts-node scripts/test-onchain-verify.ts [network]
 * Example: ts-node scripts/test-onchain-verify.ts sepolia
 */
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = __importDefault(require('path'));
const fs_1 = __importDefault(require('fs'));
const ethers_1 = require('ethers');
const logger_1 = require('../src/lib/logger');
const networks_1 = require('../src/lib/networks');
const logger = new logger_1.CircuitLogger('test-onchain-verify');
async function main() {
  const environmentType = process.argv[2];
  const networkName = process.argv[3];
  // Validate arguments
  if (!environmentType || !networkName) {
    logger.error('Usage: yarn test-onchain-verify <testnet|mainnet> <network>');
    logger.info('Examples:');
    logger.info('  yarn test-onchain-verify testnet sepolia');
    logger.info('  yarn test-onchain-verify mainnet ethereum');
    process.exit(1);
  }
  if (environmentType !== 'testnet' && environmentType !== 'mainnet') {
    logger.error(`Invalid environment type: ${environmentType}`);
    logger.info('Must be either "testnet" or "mainnet"');
    process.exit(1);
  }
  const environment =
    environmentType === 'testnet' ? 'development' : 'production';
  try {
    const network = (0, networks_1.getNetwork)(environment, networkName);
    const privateKey = process.env['PRIVATE_KEY'];
    if (!privateKey) {
      logger.error('PRIVATE_KEY environment variable is required');
      process.exit(1);
    }
    logger.info(
      `Testing on-chain verification on ${network.name} (Chain ID: ${network.chainId})`
    );
    // Create provider and wallet
    const provider = new ethers_1.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers_1.Wallet(privateKey, provider);
    // Find the latest proof
    const proofsDir = path_1.default.join(process.cwd(), 'proofs');
    if (!fs_1.default.existsSync(proofsDir)) {
      logger.error('No proofs directory found. Run proof generation first.');
      process.exit(1);
    }
    // Get the latest proof directory
    const proofDirs = fs_1.default
      .readdirSync(proofsDir)
      .filter((dir) =>
        fs_1.default.statSync(path_1.default.join(proofsDir, dir)).isDirectory()
      )
      .sort()
      .reverse();
    if (proofDirs.length === 0) {
      logger.error('No proof directories found. Run proof generation first.');
      process.exit(1);
    }
    const latestProofDir = path_1.default.join(proofsDir, proofDirs[0]);
    logger.info(`Using proof from: ${latestProofDir}`);
    // Read proof and public signals
    const proofPath = path_1.default.join(latestProofDir, 'proof.json');
    const publicPath = path_1.default.join(latestProofDir, 'public.json');
    if (
      !fs_1.default.existsSync(proofPath) ||
      !fs_1.default.existsSync(publicPath)
    ) {
      logger.error('Proof or public signals file not found');
      process.exit(1);
    }
    const proof = JSON.parse(fs_1.default.readFileSync(proofPath, 'utf8'));
    const publicSignals = JSON.parse(
      fs_1.default.readFileSync(publicPath, 'utf8')
    );
    logger.info(`Proof loaded: ${Object.keys(proof).join(', ')}`);
    logger.info(`Public signals: ${publicSignals.length} elements`);
    // Find deployed contract address
    const artifactsDir = path_1.default.join(process.cwd(), 'artifacts');
    const deploymentPath = path_1.default.join(
      artifactsDir,
      `verifier-address.${network.chainId}.json`
    );
    if (!fs_1.default.existsSync(deploymentPath)) {
      logger.error(`No deployment found for chain ID ${network.chainId}`);
      logger.info(
        `Run deployment first: ts-node scripts/deploy.ts ${networkName}`
      );
      process.exit(1);
    }
    const deployment = JSON.parse(
      fs_1.default.readFileSync(deploymentPath, 'utf8')
    );
    const contractAddress = deployment.address;
    logger.info(`Using deployed contract: ${contractAddress}`);
    // Contract ABI (minimal verifier interface)
    const verifierABI = [
      {
        inputs: [
          {
            internalType: 'uint[2]',
            name: '_pA',
            type: 'uint[2]',
          },
          {
            internalType: 'uint[2][2]',
            name: '_pB',
            type: 'uint[2][2]',
          },
          {
            internalType: 'uint[2]',
            name: '_pC',
            type: 'uint[2]',
          },
          {
            internalType: 'uint[15]',
            name: '_pubSignals',
            type: 'uint[15]',
          },
        ],
        name: 'verifyProof',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ];
    // Create contract instance
    const contract = new ethers_1.Contract(
      contractAddress,
      verifierABI,
      wallet
    );
    // Prepare proof data for contract call
    const proofData = [
      proof.pi_a.slice(0, 2), // pA
      [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)], // pB
      proof.pi_c.slice(0, 2), // pC
      publicSignals.slice(0, 15), // pubSignals (truncated to 15)
    ];
    logger.info('Calling verifyProof on contract...');
    logger.info(
      `Public signals: [${publicSignals.slice(0, 5).join(', ')}...] (${
        publicSignals.length
      } total)`
    );
    try {
      // Call the contract
      const result = await contract['verifyProof'](...proofData);
      if (result) {
        logger.info('✅ On-chain verification SUCCESSFUL!');
        logger.info(`Contract address: ${contractAddress}`);
        logger.info(`Network: ${network.name}`);
        logger.info(
          `Explorer: ${getExplorerUrl(networkName, contractAddress)}`
        );
      } else {
        logger.error('❌ On-chain verification FAILED!');
        logger.error('The contract returned false for a valid proof');
        // Debug information
        logger.info('Debug information:');
        logger.info(`- Proof elements: ${Object.keys(proof).join(', ')}`);
        logger.info(`- Public signals count: ${publicSignals.length}`);
        logger.info(`- Contract expects: 15 public signals`);
        logger.info(`- Network: ${network.name} (${network.chainId})`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Contract call failed:', error.message);
      // Check if it's a gas estimation error
      if (error.message.includes('gas')) {
        logger.info('This might be a gas estimation issue. Try:');
        logger.info('1. Check your wallet has enough ETH for gas');
        logger.info('2. Verify the contract is deployed correctly');
        logger.info('3. Check the proof data format');
      }
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
