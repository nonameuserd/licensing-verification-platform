#!/usr/bin/env ts-node

/**
 * Setup script for ZK-SNARK circuit
 * Generates trusted setup parameters for the ExamProof circuit
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join } from 'path';
import { CircuitLogger, logger } from '../src/lib/logger';

const CIRCUIT_NAME = 'ExamProof';
const BUILD_DIR = join(__dirname, '..', 'build');
const SETUP_DIR = join(__dirname, '..', 'zkey');
// Determine the powers-of-tau power to use. Prefer an existing local pot14
// if present (the repo historically shipped pot14 files). If not present,
// fall back to 16 which supports larger circuits.
let PTAU_POWER = 16;
try {
  const candidate14 = join(SETUP_DIR, 'pot14_final.ptau');
  if (existsSync(candidate14)) {
    PTAU_POWER = 14;
    logger.info('Using existing pot14_final.ptau', { PTAU_POWER: 14 });
  }
} catch {
  // keep default
}

function ensureDirectoryExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info('Created directory', { directory: dir });
  }
}

function runCommand(
  command: string,
  description: string,
  logger: CircuitLogger
): void {
  logger.info(`Starting: ${description}`);
  logger.debug('Executing command', { command, description });

  try {
    execSync(command, { stdio: 'inherit', cwd: join(__dirname, '..') });
    logger.info(`Completed: ${description}`);
    logger.info(`✅ ${description} completed successfully`);
  } catch (error) {
    logger.error(`Failed: ${description}`, error as Error, { command });
    logger.error(`❌ ${description} failed:`, (error as Error).message);
    process.exit(1);
  }
}

function main(): void {
  const logger = new CircuitLogger('circuit-setup');
  const startTime = Date.now();

  logger.setupStart('trusted-setup');
  logger.info('🔧 Setting up ZK-SNARK circuit...');

  try {
    // Ensure directories exist
    ensureDirectoryExists(BUILD_DIR);
    ensureDirectoryExists(SETUP_DIR);
    logger.debug('Setup directories ensured', { BUILD_DIR, SETUP_DIR });

    // Check if circuit files exist
    const r1csPath = join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
    if (!existsSync(r1csPath)) {
      logger.info('Circuit not compiled. Compiling first...');
      logger.warn('⚠️  Circuit not compiled. Compiling first...');
      // Try several likely locations for the circom source (handles dist vs source layouts)
      // Prefer the project's source circuit file in the repo `src/` directory
      // This avoids compiling the dist-bundled copy which may have been transformed
      const candidateSources = [
        join(process.cwd(), 'src', `${CIRCUIT_NAME}.circom`),
        join(process.cwd(), 'circuits', 'src', `${CIRCUIT_NAME}.circom`),
        join(__dirname, '..', 'src', `${CIRCUIT_NAME}.circom`),
        join(__dirname, '..', '..', 'src', `${CIRCUIT_NAME}.circom`),
        join(
          process.cwd(),
          'circuits',
          'dist',
          'src',
          `${CIRCUIT_NAME}.circom`
        ),
        join(process.cwd(), 'circuits', 'build', `${CIRCUIT_NAME}.r1cs`),
      ];
      let srcPath: string | null = null;
      for (const p of candidateSources) {
        if (existsSync(p)) {
          srcPath = p;
          break;
        }
      }

      if (!srcPath) {
        logger.error(
          'Could not find circuit source file in any expected location',
          {
            candidates: candidateSources,
          }
        );
        throw new Error('Circuit source file not found');
      }

      // Use absolute path when invoking circom to avoid cwd-related path issues
      // Provide include paths so circom can resolve circomlib and local includes
      const includeLocal = join(process.cwd(), 'src');
      const includeCircomlib = join(
        process.cwd(),
        '..',
        'node_modules',
        'circomlib',
        'circuits'
      );
      // Prefer a repo-local circom binary (./.bin/circom) to avoid system
      // version mismatches that can cause parse errors. Check a few likely
      // locations and use the first one that exists.
      const localCircomCandidates = [
        join(process.cwd(), '.bin', 'circom'),
        join(process.cwd(), 'circuits', '.bin', 'circom'),
        join(__dirname, '..', '.bin', 'circom'),
      ];

      let circomCmd = 'circom';
      for (const cand of localCircomCandidates) {
        try {
          if (existsSync(cand)) {
            circomCmd = cand;
            logger.info(`Using local circom binary: ${cand}`);
            break;
          }
        } catch {
          // ignore
        }
      }

      runCommand(
        `${circomCmd} ${srcPath} -l ${includeLocal} -l ${includeCircomlib} --r1cs --wasm --sym --c -o ${BUILD_DIR}/`,
        'Circuit compilation',
        logger
      );
    }

    // Fast-path: if setup artifacts already exist, skip heavy ceremony work.
    // Check both the setup dir and the mirrored dist location where compiled
    // scripts expect artifacts to live.
    const proofZkey = join(SETUP_DIR, `${CIRCUIT_NAME}_0001.zkey`);
    const verificationKey = join(SETUP_DIR, 'verification_key.json');
    const distSetupPath = join(process.cwd(), 'dist', 'circuits', 'zkey');
    const distProofZkey = join(distSetupPath, `${CIRCUIT_NAME}_0001.zkey`);
    const distVerificationKey = join(distSetupPath, 'verification_key.json');

    // Treat files as present only if they exist and are non-empty. Some test
    // helpers create zero-byte placeholder files which cause snarkjs to fail
    // with "Invalid File format" when attempting to read the zkey. Use a
    // small helper to ensure we only skip setup when artifacts look valid.
    const fileExistsAndNonEmpty = (p: string): boolean => {
      try {
        return existsSync(p) && statSync(p).size > 0;
      } catch {
        return false;
      }
    };

    if (
      (fileExistsAndNonEmpty(proofZkey) &&
        fileExistsAndNonEmpty(verificationKey)) ||
      (fileExistsAndNonEmpty(distProofZkey) &&
        fileExistsAndNonEmpty(distVerificationKey))
    ) {
      logger.info('Found existing setup artifacts — skipping trusted setup');
      logger.info(
        'Setup artifacts already exist. Skipping heavy snarkjs steps.'
      );

      // Ensure artifacts are mirrored into dist for downstream compiled scripts
      try {
        if (!existsSync(distSetupPath)) ensureDirectoryExists(distSetupPath);
        const srcDir = existsSync(SETUP_DIR) ? SETUP_DIR : distSetupPath;
        const files = readdirSync(srcDir);
        for (const f of files) {
          const srcF = join(srcDir, f);
          const dstF = join(distSetupPath, f);
          try {
            // Skip mirroring zero-byte files which are likely placeholders
            // created by tests or from earlier runs.
            try {
              if (statSync(srcF).size === 0) {
                logger.warn(`Skipping zero-byte artifact: ${srcF}`);
                continue;
              }
            } catch {
              // If stat fails, fall back to copying and let it be handled by caller
            }
            copyFileSync(srcF, dstF);
            logger.info(`Mirrored ${srcF} -> ${dstF}`);
          } catch (e) {
            // non-fatal
            logger.warn(
              `Failed to mirror ${srcF} to ${dstF}: ${(e as Error).message}`
            );
          }
        }

        // Also mirror the compiled build artifacts into dist so the proof
        // generation script can find the wasm and supporting files under
        // dist/circuits/build/.
        const distBuildPath = join(process.cwd(), 'dist', 'circuits', 'build');
        if (existsSync(BUILD_DIR)) {
          ensureDirectoryExists(distBuildPath);

          function copyDirRecursive(src: string, dst: string) {
            const entries = readdirSync(src, { withFileTypes: true });
            for (const entry of entries) {
              const srcPath = join(src, entry.name);
              const dstPath = join(dst, entry.name);
              if (entry.isDirectory()) {
                ensureDirectoryExists(dstPath);
                copyDirRecursive(srcPath, dstPath);
              } else {
                try {
                  copyFileSync(srcPath, dstPath);
                } catch (e) {
                  logger.warn(
                    `Failed to copy ${srcPath} -> ${dstPath}: ${
                      (e as Error).message
                    }`
                  );
                }
              }
            }
          }

          try {
            copyDirRecursive(BUILD_DIR, distBuildPath);
            logger.info(`Mirrored build/ -> ${distBuildPath}`);
          } catch (e) {
            logger.warn(
              `Failed to mirror build to dist: ${(e as Error).message}`
            );
          }
        }

        // Ensure an artifacts directory exists to store verifier address and
        // other ephemeral outputs created by deployment scripts.
        const artifactsDir = join(process.cwd(), 'artifacts');
        if (!existsSync(artifactsDir)) {
          ensureDirectoryExists(artifactsDir);
          logger.info(`Created artifacts directory: ${artifactsDir}`);
        }
      } catch {
        // ignore mirroring errors
      }

      logger.setupComplete('trusted-setup', 0);
      return;
    }

    // Note: mirroring of setup artifacts into dist is performed after the
    // zkey and verification key are generated so we don't accidentally mirror
    // stale or partial files.

    // Generate trusted setup (using power of 16 for larger circuits)
    // If a prebuilt powers-of-tau final file exists in the mirrored dist
    // location, copy it in and skip the expensive powersoftau steps.
    const distFinalPtau = join(
      process.cwd(),
      'dist',
      'circuits',
      'zkey',
      `pot${PTAU_POWER}_final.ptau`
    );
    if (existsSync(distFinalPtau)) {
      try {
        copyFileSync(
          distFinalPtau,
          join(SETUP_DIR, `pot${PTAU_POWER}_final.ptau`)
        );
        logger.info('Using prebuilt Powers of Tau final from dist', {
          distFinalPtau,
        });
        logger.info(
          `Using prebuilt ${distFinalPtau} — skipping powersoftau steps`
        );
      } catch (e) {
        // If copy fails, fall back to generating locally
        logger.warn(
          'Failed to copy prebuilt pot file from dist; will generate locally',
          (e as Error).message
        );
      }
    }

    if (!existsSync(join(SETUP_DIR, `pot${PTAU_POWER}_final.ptau`))) {
      runCommand(
        `snarkjs powersoftau new bn128 ${PTAU_POWER} ${SETUP_DIR}/pot${PTAU_POWER}_0000.ptau -v`,
        'Powers of Tau phase 1',
        logger
      );

      runCommand(
        `snarkjs powersoftau contribute ${SETUP_DIR}/pot${PTAU_POWER}_0000.ptau ${SETUP_DIR}/pot${PTAU_POWER}_0001.ptau --name="First contribution" -v`,
        'Powers of Tau contribution',
        logger
      );

      runCommand(
        `snarkjs powersoftau prepare phase2 ${SETUP_DIR}/pot${PTAU_POWER}_0001.ptau ${SETUP_DIR}/pot${PTAU_POWER}_final.ptau -v`,
        'Powers of Tau phase 2 preparation',
        logger
      );
    }

    runCommand(
      `snarkjs groth16 setup ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs ${SETUP_DIR}/pot${PTAU_POWER}_final.ptau ${SETUP_DIR}/${CIRCUIT_NAME}_0000.zkey`,
      'Groth16 setup',
      logger
    );

    runCommand(
      `snarkjs zkey contribute ${SETUP_DIR}/${CIRCUIT_NAME}_0000.zkey ${SETUP_DIR}/${CIRCUIT_NAME}_0001.zkey --name="First contribution" -v`,
      'ZKey contribution',
      logger
    );

    runCommand(
      `snarkjs zkey export verificationkey ${SETUP_DIR}/${CIRCUIT_NAME}_0001.zkey ${SETUP_DIR}/verification_key.json`,
      'Verification key export',
      logger
    );

    // Mirror generated setup artifacts into dist so downstream compiled scripts
    // that expect artifacts under dist/circuits/setup can find them.
    try {
      const distSetupPath = join(process.cwd(), 'dist', 'circuits', 'zkey');
      if (existsSync(SETUP_DIR)) {
        ensureDirectoryExists(distSetupPath);
        const files = readdirSync(SETUP_DIR);
        for (const f of files) {
          const srcF = join(SETUP_DIR, f);
          const dstF = join(distSetupPath, f);
          try {
            copyFileSync(srcF, dstF);
            logger.info(`Mirrored ${srcF} -> ${dstF}`);
          } catch (e) {
            // non-fatal
            logger.warn(
              `Failed to mirror ${srcF} to ${dstF}: ${(e as Error).message}`
            );
          }
        }
      }
    } catch {
      // ignore mirroring errors
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.setupComplete('trusted-setup', duration);
    logger.performance('circuit-setup', duration, {
      circuitName: CIRCUIT_NAME,
      setupType: 'trusted-setup',
    });

    logger.info('\n🎉 Setup completed successfully!');
    logger.info('\nGenerated files:');
    logger.info(`- Proving key: ${SETUP_DIR}/${CIRCUIT_NAME}_0001.zkey`);
    logger.info(`- Verification key: ${SETUP_DIR}/verification_key.json`);
    logger.info(`- Powers of Tau: ${SETUP_DIR}/pot${PTAU_POWER}_final.ptau`);
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.setupError(error as Error, 'trusted-setup');
    logger.performance('circuit-setup-failed', duration, {
      circuitName: CIRCUIT_NAME,
      error: (error as Error).message,
    });

    logger.error('❌ Setup failed:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
