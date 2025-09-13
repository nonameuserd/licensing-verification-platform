#!/usr/bin/env ts-node

/**
 * Deploy verifier contract to testnet
 * Usage: ts-node scripts/deploy-testnet.ts [network]
 * Example: ts-node scripts/deploy-testnet.ts sepolia
 */

import fs from 'fs';
import path from 'path';
import { JsonRpcProvider, ContractFactory, Wallet } from 'ethers';
import { CircuitLogger } from '../src/lib/logger';
import { getNetwork, getAvailableNetworks } from '../src/lib/networks';

const logger = new CircuitLogger('deploy-testnet');

async function main() {
  const networkName = process.argv[2] || 'sepolia';
  const environment = process.env['NODE_ENV'] || 'development';

  try {
    const network = getNetwork(environment, networkName);
    const privateKey = process.env['PRIVATE_KEY'];

    if (!privateKey) {
      logger.error('PRIVATE_KEY environment variable is required');
      logger.info('Set PRIVATE_KEY in your .env file or environment');
      process.exit(1);
    }

    logger.info(`Deploying to ${network.name} (Chain ID: ${network.chainId})`);

    // Create provider and wallet
    const provider = new JsonRpcProvider(network.rpcUrl);
    const wallet = new Wallet(privateKey, provider);

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
    const solPath = path.join(
      process.cwd(),
      'contracts',
      'ExamProofVerifier.sol'
    );
    if (!fs.existsSync(solPath)) {
      logger.error(`Contract not found: ${solPath}`);
      logger.info(
        'Run "yarn generate-verifier" first to generate the contract'
      );
      process.exit(1);
    }

    const solSource = fs.readFileSync(solPath, 'utf8');

    // Compile with solc
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
    const factory = new ContractFactory(abi, bytecode, wallet);

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
      const artifactsDir = path.join(process.cwd(), 'artifacts');
      if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
      }

      const deploymentInfo = {
        address,
        network: networkName,
        chainId: network.chainId,
        rpcUrl: network.rpcUrl,
        deployedAt: new Date().toISOString(),
        transactionHash: contract.deploymentTransaction()?.hash,
      };

      const outPath = path.join(
        artifactsDir,
        `verifier-address.${network.chainId}.json`
      );
      fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
      logger.info(`Deployment info saved to: ${outPath}`);

      // Verify contract has code
      const deployedCode = await provider.getCode(address);
      if (!deployedCode || deployedCode === '0x') {
        throw new Error('Deployed contract has no code');
      }

      logger.info('Contract verification: ✅ Code deployed successfully');
    } catch (error) {
      logger.error('Deployment failed:', (error as Error).message);
      process.exit(1);
    }
  } catch (networkErr: unknown) {
    logger.error('Network configuration error', networkErr as Error);
    logger.info('Available networks:', getAvailableNetworks(environment));
    process.exit(1);
  }
}

function getExplorerUrl(networkName: string, address: string): string {
  const explorers = {
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
    amoy: `https://amoy.polygonscan.com/address/${address}`,
    arbitrumSepolia: `https://sepolia.arbiscan.io/address/${address}`,
    optimismSepolia: `https://sepolia-optimism.etherscan.io/address/${address}`,
  };
  return explorers[networkName as keyof typeof explorers] || '';
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}
