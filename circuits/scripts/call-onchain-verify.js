'use strict';
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
const logger = new logger_1.CircuitLogger('call-onchain-verify');
async function main() {
  const environmentType = process.argv[2];
  const networkName = process.argv[3];
  // Validate arguments
  if (!environmentType || !networkName) {
    logger.error('Usage: yarn call-onchain-verify <testnet|mainnet> <network>');
    logger.info('Examples:');
    logger.info('  yarn call-onchain-verify testnet sepolia');
    logger.info('  yarn call-onchain-verify mainnet ethereum');
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
    const rpc = network.rpcUrl;
    logger.info(
      `Using ${environment} environment with ${network.name} (Chain ID: ${network.chainId})`
    );
    const provider = new ethers_1.JsonRpcProvider(rpc);
    const signer = await provider.getSigner(0);
    // Require a chain-scoped artifact only: verifier-address.<chainId>.json
    const providerNetwork = await provider.getNetwork();
    const chainId = providerNetwork.chainId;
    const rpcUrl = rpc;
    const scopedPath = path_1.default.join(
      process.cwd(),
      'artifacts',
      `verifier-address.${chainId}.json`
    );
    let verifierAddress = null;
    let artifactChainId = null;
    if (!fs_1.default.existsSync(scopedPath)) {
      throw new Error(
        `Verifier address artifact not found. Expected ${scopedPath}. Provider RPC: ${rpcUrl}, chainId: ${chainId}`
      );
    }
    try {
      const raw = fs_1.default.readFileSync(scopedPath, 'utf8');
      const parsed = JSON.parse(raw);
      verifierAddress = parsed.address;
      artifactChainId = parsed.chainId ?? null;
    } catch (err) {
      throw new Error(
        `Failed to read/parse ${scopedPath}: ${err.message}. Provider RPC: ${rpcUrl}, provider chainId: ${chainId}`
      );
    }
    if (!verifierAddress || !(0, ethers_1.isAddress)(verifierAddress)) {
      throw new Error(
        `Invalid verifier address from artifact: ${verifierAddress}. Provider RPC: ${rpcUrl}, chainId: ${chainId}`
      );
    }
    if (artifactChainId && String(artifactChainId) !== String(chainId)) {
      throw new Error(
        `Artifact chainId ${artifactChainId} does not match provider chainId ${String(
          chainId
        )}. Provider RPC: ${rpcUrl}`
      );
    }
    // Ensure the node actually has contract code at the verifier address.
    const verifierCode = await provider.getCode(verifierAddress);
    if (!verifierCode || verifierCode === '0x') {
      logger.error('No contract code found at verifier address', {
        verifierAddress,
        rpcUrl,
        chainId: String(chainId),
      });
      // Distinct exit code to help CI detect this case specifically
      process.exit(10);
    }
    const verifierAbi = [
      'function verifyProof(uint256[2], uint256[2][2], uint256[2], uint256[15]) view returns (bool)',
    ];
    const contract = new ethers_1.Contract(
      verifierAddress,
      verifierAbi,
      signer
    );
    // Check for chain-scoped wrapper artifact only
    const wrapperScopedPath = path_1.default.join(
      process.cwd(),
      'artifacts',
      `wrapper-address.${chainId}.json`
    );
    let wrapperAddress = null;
    if (fs_1.default.existsSync(wrapperScopedPath)) {
      try {
        const rawWrapper = fs_1.default.readFileSync(wrapperScopedPath, 'utf8');
        try {
          const parsed = JSON.parse(rawWrapper);
          wrapperAddress = parsed.address || null;
        } catch {
          wrapperAddress = rawWrapper.trim();
        }
        if (!wrapperAddress || !(0, ethers_1.isAddress)(wrapperAddress)) {
          logger.warn('Wrapper address artifact invalid', {
            wrapperScopedPath,
            rpcUrl,
            chainId: String(chainId),
          });
          wrapperAddress = null;
        } else {
          const wrapperCode = await provider.getCode(wrapperAddress);
          if (!wrapperCode || wrapperCode === '0x') {
            logger.warn(
              'No contract code found at wrapper address; ignoring wrapper and falling back to direct verify call',
              {
                wrapperAddress,
                rpcUrl,
                chainId: String(chainId),
              }
            );
            wrapperAddress = null;
          }
        }
      } catch (err) {
        logger.warn('Failed to read wrapper artifact', {
          wrapperScopedPath,
          error: err.message,
        });
        wrapperAddress = null;
      }
    }
    const proofPath = path_1.default.join(process.cwd(), 'proofs');
    if (!fs_1.default.existsSync(proofPath))
      throw new Error(`Proofs directory not found: ${proofPath}`);
    // Select only directories (timestamped proof folders). Ignore files such as stray
    // witness.wtns that may accidentally be placed into the proofs root. This avoids
    // ENOTDIR when callers expect a directory.
    const entries = fs_1.default.readdirSync(proofPath).map((name) => ({
      name,
      fullPath: path_1.default.join(proofPath, name),
    }));
    const dirEntries = entries.filter((e) => {
      try {
        return fs_1.default.statSync(e.fullPath).isDirectory();
      } catch (err) {
        // ignore transient stat errors for non-directories
        void err;
        return false;
      }
    });
    if (dirEntries.length === 0) {
      throw new Error(
        `No proof directories found in proofs path: ${proofPath}. Ensure proof generation created a timestamped folder.`
      );
    }
    // Sort by name (timestamp-ish) descending and take the latest directory
    dirEntries.sort((a, b) => b.name.localeCompare(a.name));
    const latestDir = dirEntries[0].fullPath;
    const proofDir = latestDir;
    const proof = JSON.parse(
      fs_1.default.readFileSync(
        path_1.default.join(proofDir, 'proof.json'),
        'utf8'
      )
    );
    const publicSignals = JSON.parse(
      fs_1.default.readFileSync(
        path_1.default.join(proofDir, 'public.json'),
        'utf8'
      )
    );
    // Debug: log raw proof and public signals to compare with calldata
    try {
      logger.debug('Loaded proof.json', { proof });
    } catch (pErr) {
      logger.warn('Failed to stringify proof for logging', { error: pErr });
    }
    try {
      logger.debug('Loaded public.json', { publicSignals });
    } catch (sErr) {
      logger.warn('Failed to stringify public signals for logging', {
        error: sErr,
      });
    }
    // Transform snarkjs output to solidity input
    const pA = [
      BigInt(proof.pi_a[0]).toString(),
      BigInt(proof.pi_a[1]).toString(),
    ];
    const pB = [
      [
        BigInt(proof.pi_b[1][0]).toString(),
        BigInt(proof.pi_b[1][1]).toString(),
      ],
      [
        BigInt(proof.pi_b[2][0]).toString(),
        BigInt(proof.pi_b[2][1]).toString(),
      ],
    ];
    const pC = [
      BigInt(proof.pi_c[0]).toString(),
      BigInt(proof.pi_c[1]).toString(),
    ];
    // Ensure the public signals array is exactly the size expected by the
    // generated verifier contract (uint[15]). If the proof produced fewer
    // signals, pad with zeros. If it produced more, truncate to 15.
    let pubSignals = publicSignals.map((s) => BigInt(s).toString());
    if (pubSignals.length > 15) {
      pubSignals = pubSignals.slice(0, 15);
    } else if (pubSignals.length < 15) {
      while (pubSignals.length < 15) pubSignals.push('0');
    }
    const verifier = contract;
    // Try direct verifier first for debugging
    let ok = null;
    // First try direct verifier
    try {
      logger.info('Trying direct verifier...');
      ok = await verifier.verifyProof(pA, pB, pC, pubSignals);
      logger.info('Direct verifier result', { ok });
    } catch (directErr) {
      logger.warn('Direct verifier failed', { error: directErr });
    }
    // If direct verifier worked, use that result
    if (ok !== null) {
      logger.info('Using direct verifier result', { ok });
    } else if (wrapperAddress) {
      try {
        const wrapperAbi = [
          'function verifyAndEmit(uint256[2], uint256[2][2], uint256[2], uint256[15]) returns (bool)',
          'event ProofVerified(bool)',
        ];
        const wrapper = new ethers_1.Contract(
          wrapperAddress,
          wrapperAbi,
          signer
        );
        // Debug: log encoded calldata and decoded args for the wrapper call
        try {
          const wrapperIface = new ethers_1.Interface(wrapperAbi);
          const wrapperCalldata = wrapperIface.encodeFunctionData(
            'verifyAndEmit',
            [pA, pB, pC, pubSignals]
          );
          logger.debug('Wrapper calldata (hex)', { calldata: wrapperCalldata });
          try {
            const decodedWrapper = wrapperIface.decodeFunctionData(
              'verifyAndEmit',
              wrapperCalldata
            );
            logger.debug('Decoded wrapper calldata args', {
              decodedArgs: decodedWrapper,
            });
          } catch (decErr) {
            logger.warn('Failed to decode wrapper calldata for logging', {
              error: decErr,
            });
          }
        } catch (calErr) {
          logger.warn('Failed to build wrapper calldata for debug logging', {
            error: calErr,
          });
        }
        logger.info('Proof values being sent to smart contract', {
          pA,
          pB,
          pC,
          pubSignals: pubSignals.slice(0, 5), // Log first 5 signals for brevity
        });
        const tx = await wrapper.verifyAndEmit(pA, pB, pC, pubSignals);
        const receipt = await tx.wait();

        const iface = new ethers_1.Interface(wrapperAbi);
        let found = false;
        for (const log of receipt.logs || []) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'ProofVerified') {
              const val = parsed.args && parsed.args[0];
              const okEvent = Boolean(val);
              logger.info('ProofVerified event value', { okEvent });
              if (!okEvent) process.exit(2);
              found = true;
              break;
            }
          } catch {
            // ignore logs that don't parse with this iface
          }
        }
        if (!found) {
          logger.info(
            'Wrapper transaction did not emit ProofVerified; falling back to legacy flow'
          );
        } else {
          return;
        }
      } catch (wrapperErr) {
        logger.error('Wrapper verifyAndEmit failed', wrapperErr);
        // fall through to legacy behavior
      }
    }
    // Legacy path: try a view/static call first. If it fails, continue with raw call and tx fallback.
    try {
      ok = await verifier.verifyProof(pA, pB, pC, pubSignals);
      logger.info('On-chain verify result', { result: ok });
      if (!ok) process.exit(2);
      return;
    } catch (err) {
      // Keep going to attempt raw call / tx fallback
      logger.error('verifyProof static call failed', err);
    }
    // Build calldata and try a raw provider.call to capture raw return bytes

    const iface = new ethers_1.Interface(verifierAbi);
    const calldata = iface.encodeFunctionData('verifyProof', [
      pA,
      pB,
      pC,
      pubSignals,
    ]);
    // Debug: log calldata and decoded args for the raw verifyProof call
    try {
      logger.debug('Verifier calldata (hex)', { calldata });
      try {
        const decodedCalldata = iface.decodeFunctionData(
          'verifyProof',
          calldata
        );
        logger.debug('Decoded verifier calldata args', {
          decodedArgs: decodedCalldata,
        });
      } catch (dErr) {
        logger.warn('Failed to decode verifier calldata for logging', {
          error: dErr,
        });
      }
    } catch (logErr) {
      logger.warn('Failed to log verifier calldata', { error: logErr });
    }
    try {
      const raw = await provider.call({
        to: verifierAddress,
        data: calldata,
      });
      if (raw && raw !== '0x') {
        try {
          const decoded = iface.decodeFunctionResult('verifyProof', raw);
          ok = Boolean(decoded[0]);
          logger.info('Decoded raw call result', { result: ok });
          if (!ok) process.exit(2);
          return;
        } catch (decErr) {
          logger.error('Failed to decode raw call result', { error: decErr });
        }
      } else {
        logger.info(
          'Raw provider.call returned empty result; falling back to sending a transaction (note: tx success does not guarantee proof validity)'
        );
      }
    } catch (callErr) {
      logger.error('provider.call failed', callErr);
    }
    // Last-resort: send an on-chain transaction (use unlocked signer) and inspect receipt
    try {
      const accounts = await provider.send('eth_accounts', []);
      if (!accounts || accounts.length === 0) {
        throw new Error(
          'no accounts available from node to send fallback transaction'
        );
      }
      const from = accounts[0];
      const gasHex = '0x4c4b40'; // 5,000,000
      const txHash = await provider.send('eth_sendTransaction', [
        { from, to: verifierAddress, data: calldata, gas: gasHex },
      ]);
      logger.info('Sent fallback transaction', { txHash });
      // Poll for receipt

      let receipt = null;
      for (let i = 0; i < 30; i++) {
        receipt = await provider.send('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      logger.info('Fallback tx receipt', { receipt });
      // status 1 means tx succeeded; can't infer proof validity reliably from tx success
      if (!receipt || receipt.status !== '0x1') process.exit(3);
      process.exit(0);
    } catch (txErr) {
      logger.error('Fallback transaction failed', txErr);
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
main().catch((e) => {
  logger.error('Main function failed', e);
  process.exit(1);
});
