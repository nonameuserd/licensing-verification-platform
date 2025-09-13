import fs from 'fs';
import path from 'path';
import { JsonRpcProvider, Contract, isAddress } from 'ethers';
import { CircuitLogger } from '../src/lib/logger';

const logger = new CircuitLogger('check-vk-onchain');

function extractConstantsFromSol(solSource: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /uint256\s+constant\s+(\w+)\s*=\s*([0-9]+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(solSource))) {
    map[m[1]] = m[2];
  }
  return map;
}

function collectICs(
  constants: Record<string, string>
): Array<{ x: string; y: string }> {
  const ics: Array<{ x: string; y: string }> = [];
  // find keys like IC0x, IC0y, IC1x, IC1y, ...
  const keys = Object.keys(constants);
  const icIndices = new Set<number>();
  for (const k of keys) {
    const m = k.match(/^IC(\d+)[xy]$/);
    if (m) icIndices.add(Number(m[1]));
  }
  const indices = Array.from(icIndices).sort((a, b) => a - b);
  for (const i of indices) {
    const x = constants[`IC${i}x`];
    const y = constants[`IC${i}y`];
    if (x && y) ics.push({ x, y });
  }
  return ics;
}

async function tryReadOnChainConstants(rpc: string, address: string) {
  try {
    const provider = new JsonRpcProvider(rpc);
    if (!isAddress(address)) {
      logger.warn('Provided verifier address is not a valid address', {
        address,
      });
      return null;
    }
    const code = await provider.getCode(address);
    if (!code || code === '0x') {
      logger.warn('No code at provided verifier address', { address });
      return null;
    }
    // There's no standard ABI to read constants embedded as solidity `constant` values.
    // We attempt some common public getters if present (best-effort).
    const possibleGetters = [
      'vk_alpha_1',
      'vk_beta_2',
      'vk_gamma_2',
      'vk_delta_2',
      'IC',
    ];
    const result: Record<string, unknown> = {};
    // Try each as a call; ignore failures
    for (const g of possibleGetters) {
      try {
        const abi = [`function ${g}() view returns (uint256)`];
        const c = new Contract(address, abi, provider);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = await (c as any)[g]();
        result[g] = val;
      } catch {
        // ignore
      }
    }
    return result;
  } catch (err) {
    logger.warn('Failed to query on-chain verifier', { error: err });
    return null;
  }
}

async function main() {
  const cwd = process.cwd();
  const zkPath = path.join(cwd, 'zkey', 'verification_key.json');
  const solPath = path.join(cwd, 'contracts', 'ExamProofVerifier.sol');

  if (!fs.existsSync(zkPath)) {
    logger.error('verification_key.json not found', { zkPath });
    process.exit(1);
  }
  if (!fs.existsSync(solPath)) {
    logger.error('ExamProofVerifier.sol not found', { solPath });
    process.exit(1);
  }

  const vkRaw = fs.readFileSync(zkPath, 'utf8');
  const vk = JSON.parse(vkRaw);

  const sol = fs.readFileSync(solPath, 'utf8');
  const constants = extractConstantsFromSol(sol);
  const ics = collectICs(constants);

  logger.info('verification_key.json summary', {
    nPublic: vk.nPublic,
    icLength: (vk.IC || []).length,
  });
  logger.info('ExamProofVerifier.sol: found IC count', { icCount: ics.length });

  let ok = true;

  // Compare IC length
  if ((vk.IC || []).length !== ics.length) {
    logger.error('Mismatch IC length', {
      verificationKeyLength: (vk.IC || []).length,
      contractLength: ics.length,
    });
    ok = false;
  } else {
    // compare each IC
    for (let i = 0; i < ics.length; i++) {
      const vkIC = vk.IC[i];
      const cIC = ics[i];
      const vk_x = String(vkIC[0]);
      const vk_y = String(vkIC[1]);
      if (vk_x !== cIC.x || vk_y !== cIC.y) {
        logger.error('IC mismatch', {
          index: i,
          verificationKey: { x: vk_x, y: vk_y },
          contract: { x: cIC.x, y: cIC.y },
        });
        ok = false;
      }
    }
  }

  // Compare alpha
  if (vk.vk_alpha_1) {
    const a = vk.vk_alpha_1;
    const ax = String(a[0]);
    const ay = String(a[1]);
    const cx = constants['alphax'];
    const cy = constants['alphay'];
    if (!cx || !cy) {
      logger.warn('Contract alphax/alphay not found in source constants');
      ok = false;
    } else if (ax !== cx || ay !== cy) {
      logger.error('alpha mismatch', {
        verificationKey: { x: ax, y: ay },
        contract: { x: cx, y: cy },
      });
      ok = false;
    } else {
      logger.info('alpha matches');
    }
  }

  // Compare gamma2 and delta2 if present (best-effort mapping)
  if (vk.vk_gamma_2) {
    const g = vk.vk_gamma_2;
    const gx = String(g[0][0]);
    const gy = String(g[0][1]);
    // contract gammax1/gammax2/gammay1/gammay2 store the 2x2 representation; try to match one of the known placements
    const gm1 = constants['gammax1'];
    const gm2 = constants['gammax2'];
    const gmy1 = constants['gammay1'];
    const gmy2 = constants['gammay2'];
    if (!gm1 || !gm2 || !gmy1 || !gmy2) {
      logger.warn('Contract gamma constants not found for comparison');
      ok = false;
    } else {
      // The verification_key.json orders coordinates as [[x1,x2],[y1,y2], [1,0]]
      // Compare by checking presence of any of the numbers
      const match =
        [gm1, gm2, gmy1, gmy2].includes(gx) ||
        [gm1, gm2, gmy1, gmy2].includes(gy);
      if (!match) {
        logger.error(
          'gamma2 values do not appear to match contract gamma constants'
        );
        ok = false;
      } else {
        logger.info('gamma2 appears to match (best-effort)');
      }
    }
  }

  if (!ok) {
    logger.error(
      'Verification key mismatch detected between zkey/verification_key.json and ExamProofVerifier.sol constants'
    );
    logger.info(
      'If the verifier was deployed from different build artifacts, on-chain verification will fail even if snarkjs verify passes off-chain.'
    );
    process.exit(2);
  }

  logger.info(
    'Verification key appears to match contract constants (basic checks passed)'
  );

  // If an address is provided, attempt best-effort on-chain reads
  const argv = process.argv.slice(2);
  const addrIndex = argv.indexOf('--address');
  const rpcIndex = argv.indexOf('--rpc');
  if (addrIndex !== -1 && argv[addrIndex + 1]) {
    const addr = argv[addrIndex + 1];
    const rpc =
      rpcIndex !== -1 && argv[rpcIndex + 1]
        ? argv[rpcIndex + 1]
        : 'http://127.0.0.1:8545';
    logger.info('Attempting on-chain reads', { address: addr, rpc });
    const onchain = await tryReadOnChainConstants(rpc, addr);
    if (!onchain) {
      logger.warn(
        'No on-chain VK getters found; contract likely embeds constants as internal constants not readable via ABI.'
      );
      process.exit(0);
    }
    logger.info('On-chain read results (best-effort)', { results: onchain });
  }
}

main().catch((e) => {
  logger.error('Main function failed', e as Error);
  process.exit(1);
});
