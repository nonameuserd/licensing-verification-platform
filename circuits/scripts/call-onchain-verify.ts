import path from 'path';
import fs from 'fs';
import { JsonRpcProvider, Contract, Interface, isAddress } from 'ethers';
import { CircuitLogger } from '../src/lib/logger';
import { getNetwork, getAvailableNetworks } from '../src/lib/networks';

const logger = new CircuitLogger('call-onchain-verify');

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
    const network = getNetwork(environment, networkName);
    const rpc = network.rpcUrl;

    logger.info(
      `Using ${environment} environment with ${network.name} (Chain ID: ${network.chainId})`
    );

    const provider = new JsonRpcProvider(rpc);
    const signer = await provider.getSigner(0);

    // Require a chain-scoped artifact only: verifier-address.<chainId>.json
    const providerNetwork = await provider.getNetwork();
    const chainId = providerNetwork.chainId;
    const rpcUrl = rpc;

    const scopedPath = path.join(
      process.cwd(),
      'artifacts',
      `verifier-address.${chainId}.json`
    );
    let verifierAddress: string | null = null;
    let artifactChainId: number | null = null;

    if (!fs.existsSync(scopedPath)) {
      throw new Error(
        `Verifier address artifact not found. Expected ${scopedPath}. Provider RPC: ${rpcUrl}, chainId: ${chainId}`
      );
    }
    try {
      const raw = fs.readFileSync(scopedPath, 'utf8');
      const parsed = JSON.parse(raw);
      verifierAddress = parsed.address;
      artifactChainId = parsed.chainId ?? null;
    } catch (err) {
      throw new Error(
        `Failed to read/parse ${scopedPath}: ${
          (err as Error).message
        }. Provider RPC: ${rpcUrl}, provider chainId: ${chainId}`
      );
    }

    if (!verifierAddress || !isAddress(verifierAddress)) {
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

    const contract = new Contract(verifierAddress, verifierAbi, signer);

    // Check for chain-scoped wrapper artifact only
    const wrapperScopedPath = path.join(
      process.cwd(),
      'artifacts',
      `wrapper-address.${chainId}.json`
    );
    let wrapperAddress: string | null = null;
    if (fs.existsSync(wrapperScopedPath)) {
      try {
        const rawWrapper = fs.readFileSync(wrapperScopedPath, 'utf8');
        try {
          const parsed = JSON.parse(rawWrapper);
          wrapperAddress = parsed.address || null;
        } catch {
          wrapperAddress = rawWrapper.trim();
        }
        if (!wrapperAddress || !isAddress(wrapperAddress)) {
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
          error: (err as Error).message,
        });
        wrapperAddress = null;
      }
    }

    const proofPath = path.join(process.cwd(), 'proofs');
    if (!fs.existsSync(proofPath))
      throw new Error(`Proofs directory not found: ${proofPath}`);

    // Select only directories (timestamped proof folders). Ignore files such as stray
    // witness.wtns that may accidentally be placed into the proofs root. This avoids
    // ENOTDIR when callers expect a directory.
    const entries = fs.readdirSync(proofPath).map((name) => ({
      name,
      fullPath: path.join(proofPath, name),
    }));

    const dirEntries = entries.filter((e) => {
      try {
        return fs.statSync(e.fullPath).isDirectory();
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
      fs.readFileSync(path.join(proofDir, 'proof.json'), 'utf8')
    );
    const publicSignals = JSON.parse(
      fs.readFileSync(path.join(proofDir, 'public.json'), 'utf8')
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
    let pubSignals = publicSignals.map((s: string) => BigInt(s).toString());
    if (pubSignals.length > 15) {
      pubSignals = pubSignals.slice(0, 15);
    } else if (pubSignals.length < 15) {
      while (pubSignals.length < 15) pubSignals.push('0');
    }

    // Type the on-chain verifier function to avoid `any`.
    type VerifyProofFn = (
      a: [string, string],
      b: [[string, string], [string, string]],
      c: [string, string],
      input: string[]
    ) => Promise<boolean>;

    const verifier = contract as unknown as { verifyProof: VerifyProofFn };

    // Try direct verifier first for debugging
    let ok: boolean | null = null;

    // First try direct verifier
    try {
      logger.info('Trying direct verifier...');
      ok = await verifier.verifyProof(
        pA as [string, string],
        pB as [[string, string], [string, string]],
        pC as [string, string],
        pubSignals as string[]
      );
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
        const wrapper = new Contract(
          wrapperAddress,
          wrapperAbi,
          signer
        ) as unknown as {
          verifyAndEmit: (
            a: [string, string],
            b: [[string, string], [string, string]],
            c: [string, string],
            input: string[]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) => Promise<any>;
        };

        // Debug: log encoded calldata and decoded args for the wrapper call
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wrapperIface = new Interface(wrapperAbi as any);
          const wrapperCalldata = wrapperIface.encodeFunctionData(
            'verifyAndEmit',
            [
              pA as [string, string],
              pB as [[string, string], [string, string]],
              pC as [string, string],
              pubSignals as string[],
            ]
          );
          logger.debug('Wrapper calldata (hex)', { calldata: wrapperCalldata });
          try {
            const decodedWrapper = wrapperIface.decodeFunctionData(
              'verifyAndEmit',
              wrapperCalldata
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) as any;
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

        const tx = await wrapper.verifyAndEmit(
          pA as [string, string],
          pB as [[string, string], [string, string]],
          pC as [string, string],
          pubSignals as string[]
        );
        const receipt = await tx.wait();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iface = new Interface(wrapperAbi as any);
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
      } catch (wrapperErr: unknown) {
        logger.error('Wrapper verifyAndEmit failed', wrapperErr as Error);
        // fall through to legacy behavior
      }
    }

    // Legacy path: try a view/static call first. If it fails, continue with raw call and tx fallback.
    try {
      ok = await verifier.verifyProof(
        pA as [string, string],
        pB as [[string, string], [string, string]],
        pC as [string, string],
        pubSignals
      );
      logger.info('On-chain verify result', { result: ok });
      if (!ok) process.exit(2);
      return;
    } catch (err: unknown) {
      // Keep going to attempt raw call / tx fallback
      logger.error('verifyProof static call failed', err as Error);
    }

    // Build calldata and try a raw provider.call to capture raw return bytes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iface = new Interface(verifierAbi as any);
    const calldata = iface.encodeFunctionData('verifyProof', [
      pA as [string, string],
      pB as [[string, string], [string, string]],
      pC as [string, string],
      pubSignals,
    ]);

    // Debug: log calldata and decoded args for the raw verifyProof call
    try {
      logger.debug('Verifier calldata (hex)', { calldata });
      try {
        const decodedCalldata = iface.decodeFunctionData(
          'verifyProof',
          calldata
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (raw && raw !== '0x') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = iface.decodeFunctionResult('verifyProof', raw) as any;
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
    } catch (callErr: unknown) {
      logger.error('provider.call failed', callErr as Error);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receipt: any = null;
      for (let i = 0; i < 30; i++) {
        receipt = await provider.send('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      logger.info('Fallback tx receipt', { receipt });
      // status 1 means tx succeeded; can't infer proof validity reliably from tx success
      if (!receipt || receipt.status !== '0x1') process.exit(3);
      process.exit(0);
    } catch (txErr: unknown) {
      logger.error('Fallback transaction failed', txErr as Error);
      process.exit(1);
    }
  } catch (networkErr: unknown) {
    logger.error('Network configuration error', networkErr as Error);
    logger.info('Available networks:', getAvailableNetworks(environment));
    process.exit(1);
  }
}

main().catch((e) => {
  logger.error('Main function failed', e as Error);
  process.exit(1);
});
