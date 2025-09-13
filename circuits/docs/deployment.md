# Blockchain Deployment Guide

This guide explains how to deploy the ZK-SNARK verifier contract to blockchain networks (both testnets and mainnets) and test on-chain verification.

## Prerequisites

1. **Node.js and dependencies**: Ensure you have Node.js installed and run `yarn install` in the circuits directory
2. **Network ETH**: You'll need ETH for gas fees (testnet ETH for development, mainnet ETH for production)
3. **RPC Provider**: Sign up for a free RPC provider (Infura, Alchemy, or QuickNode)
4. **Private Key**: A wallet private key for deployment

## Step 1: Environment Setup

1. **Copy the environment template**:

   ```bash
   cp env.example .env
   ```

2. **Fill in your environment variables** in `.env`:

   **For Development (Testnets)**:

   ```bash
   # Your wallet private key (without 0x prefix)
   PRIVATE_KEY=your_private_key_here
   NODE_ENV=development

   # Testnet RPC URLs (replace YOUR_INFURA_KEY with your actual key)
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   AMOY_RPC_URL=https://polygon-amoy.infura.io/v3/YOUR_INFURA_KEY
   ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
   OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
   ```

   **For Production (Mainnets)**:

   ```bash
   # Your wallet private key (without 0x prefix)
   PRIVATE_KEY=your_private_key_here
   NODE_ENV=production

   # Mainnet RPC URLs (replace YOUR_INFURA_KEY with your actual key)
   ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY
   ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
   OPTIMISM_RPC_URL=https://mainnet.optimism.io
   ```

3. **Get ETH for gas fees**:
   - **Testnets**: Get free testnet ETH from faucets
     - **Sepolia**: https://sepoliafaucet.com/
     - **Amoy (Polygon)**: https://faucet.polygon.technology/
     - **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia
     - **Optimism Sepolia**: https://faucet.quicknode.com/optimism/sepolia
   - **Mainnets**: Use real ETH from exchanges or wallets

## Step 2: Generate Circuit Artifacts

Before deploying, ensure you have the latest circuit artifacts:

```bash
# Generate the verifier contract
yarn generate-verifier

# Generate a proof for testing
yarn generate-proof
```

## Step 3: Deploy to Blockchain Network

Deploy the verifier contract to your chosen network:

```bash
# Deploy to testnets (automatically uses development environment)
yarn deploy testnet sepolia
yarn deploy testnet amoy
yarn deploy testnet arbitrumSepolia
yarn deploy testnet optimismSepolia

# Deploy to mainnets (automatically uses production environment)
yarn deploy mainnet ethereum
yarn deploy mainnet polygon
yarn deploy mainnet arbitrum
yarn deploy mainnet optimism
```

The deployment script will:

- Compile the Solidity contract
- Deploy it to the specified testnet
- Save the deployment address to `artifacts/verifier-address.{chainId}.json`
- Provide explorer links for verification

## Step 4: Test On-Chain Verification

Test the deployed contract with your generated proof:

```bash
# Test on testnets (automatically uses development environment)
yarn test-onchain-verify testnet sepolia
yarn test-onchain-verify testnet amoy
yarn test-onchain-verify testnet arbitrumSepolia
yarn test-onchain-verify testnet optimismSepolia

# Test on mainnets (automatically uses production environment)
yarn test-onchain-verify mainnet ethereum
yarn test-onchain-verify mainnet polygon
yarn test-onchain-verify mainnet arbitrum
yarn test-onchain-verify mainnet optimism
```

## Supported Networks

### Development (Testnets)

| Network          | Chain ID | RPC URL                                    | Explorer                              | Faucet                                        |
| ---------------- | -------- | ------------------------------------------ | ------------------------------------- | --------------------------------------------- |
| Sepolia          | 11155111 | https://sepolia.infura.io/v3/YOUR_KEY      | https://sepolia.etherscan.io          | https://sepoliafaucet.com                     |
| Amoy (Polygon)   | 80002    | https://polygon-amoy.infura.io/v3/YOUR_KEY | https://amoy.polygonscan.com          | https://faucet.polygon.technology             |
| Arbitrum Sepolia | 421614   | https://sepolia-rollup.arbitrum.io/rpc     | https://sepolia.arbiscan.io           | https://faucet.quicknode.com/arbitrum/sepolia |
| Optimism Sepolia | 11155420 | https://sepolia.optimism.io                | https://sepolia-optimism.etherscan.io | https://faucet.quicknode.com/optimism/sepolia |

### Production (Mainnets)

| Network  | Chain ID | RPC URL                                       | Explorer                        | Cost (Approx) |
| -------- | -------- | --------------------------------------------- | ------------------------------- | ------------- |
| Ethereum | 1        | https://mainnet.infura.io/v3/YOUR_KEY         | https://etherscan.io            | $50-200       |
| Polygon  | 137      | https://polygon-mainnet.infura.io/v3/YOUR_KEY | https://polygonscan.com         | $0.01-0.10    |
| Arbitrum | 42161    | https://arb1.arbitrum.io/rpc                  | https://arbiscan.io             | $0.10-0.50    |
| Optimism | 10       | https://mainnet.optimism.io                   | https://optimistic.etherscan.io | $0.10-0.50    |

## Troubleshooting

### Common Issues

1. **"Insufficient funds" error**:

   - Get more testnet ETH from faucets
   - Check your wallet balance

2. **"Contract not found" error**:

   - Run `yarn generate-verifier` first
   - Ensure the contract file exists in `contracts/ExamProofVerifier.sol`

3. **"No deployment found" error**:

   - Deploy the contract first using `yarn deploy [network]`
   - Check that the deployment file exists in `artifacts/`

4. **"On-chain verification failed" error**:
   - Verify the proof was generated correctly
   - Check that the circuit artifacts match the deployed contract
   - Ensure you're using the correct network

### Debug Information

The scripts provide detailed logging to help debug issues:

- Contract deployment addresses
- Transaction hashes
- Explorer links
- Gas estimates
- Error details

### Gas Optimization

For L2 networks (Polygon, Arbitrum, Optimism), gas costs are much lower:

- **Ethereum testnets**: ~$0.50-2.00 per transaction
- **L2 testnets**: ~$0.01-0.10 per transaction

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit private keys** to version control
2. **Use testnet keys only** - never use mainnet private keys
3. **Test thoroughly** on testnets before mainnet deployment
4. **Verify contract source code** on block explorers when possible

## Next Steps

After successful testnet deployment and verification:

1. **Verify contract source** on the block explorer
2. **Test with different proof inputs** to ensure robustness
3. **Monitor gas costs** and optimize if needed
4. **Prepare for mainnet deployment** with proper security measures

## Example Workflows

### Development Workflow (Testnet)

```bash
# 1. Setup environment
cp env.example .env
# Edit .env with testnet values

# 2. Generate artifacts
yarn generate-verifier
yarn generate-proof

# 3. Deploy to testnet
yarn deploy testnet sepolia

# 4. Test verification
yarn test-onchain-verify testnet sepolia

# 5. Check on explorer
# Visit the provided explorer URL to see your contract
```

### Production Workflow (Mainnet)

```bash
# 1. Setup environment
cp env.example .env
# Edit .env with mainnet values

# 2. Generate artifacts
yarn generate-verifier
yarn generate-proof

# 3. Deploy to mainnet
yarn deploy mainnet polygon

# 4. Test verification
yarn test-onchain-verify mainnet polygon

# 5. Check on explorer
# Visit the provided explorer URL to see your contract
```

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the script logs for detailed error information
3. Ensure all prerequisites are met
4. Verify your environment configuration
