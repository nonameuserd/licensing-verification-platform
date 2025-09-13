#!/usr/bin/env ts-node
'use strict';
/**
 * Setup script for ZK-SNARK circuit
 * Generates trusted setup parameters for the ExamProof circuit
 */
Object.defineProperty(exports, '__esModule', { value: true });
const child_process_1 = require('child_process');
const fs_1 = require('fs');
const path_1 = require('path');
const logger_1 = require('../src/lib/logger');
const CIRCUIT_NAME = 'ExamProof';
const BUILD_DIR = (0, path_1.join)(__dirname, '..', 'build');
const SETUP_DIR = (0, path_1.join)(__dirname, '..', 'zkey');
// Determine the powers-of-tau power to use. Prefer an existing local pot14
// if present (the repo historically shipped pot14 files). If not present,
// fall back to 16 which supports larger circuits.
let PTAU_POWER = 16;
try {
  const candidate14 = (0, path_1.join)(SETUP_DIR, 'pot14_final.ptau');
  if ((0, fs_1.existsSync)(candidate14)) {
    PTAU_POWER = 14;
    console.log('Using existing pot14_final.ptau (PTAU_POWER=14)');
  }
} catch (_) {
  // keep default
}
function ensureDirectoryExists(dir) {
  if (!(0, fs_1.existsSync)(dir)) {
    (0, fs_1.mkdirSync)(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}
function runCommand(command, description, logger) {
  logger.info(`Starting: ${description}`);
  logger.debug('Executing command', { command, description });
  try {
    (0, child_process_1.execSync)(command, {
      stdio: 'inherit',
      cwd: (0, path_1.join)(__dirname, '..'),
    });
    logger.info(`Completed: ${description}`);
    console.log(`✅ ${description} completed successfully`);
  } catch (error) {
    logger.error(`Failed: ${description}`, error, { command });
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}
function main() {
  const logger = new logger_1.CircuitLogger('circuit-setup');
  const startTime = Date.now();
  logger.setupStart('trusted-setup');
  console.log('🔧 Setting up ZK-SNARK circuit...');
  try {
    // Ensure directories exist
    ensureDirectoryExists(BUILD_DIR);
    ensureDirectoryExists(SETUP_DIR);
    logger.debug('Setup directories ensured', { BUILD_DIR, SETUP_DIR });
    // Check if circuit files exist
    const r1csPath = (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
    if (!(0, fs_1.existsSync)(r1csPath)) {
      logger.info('Circuit not compiled. Compiling first...');
      console.log('⚠️  Circuit not compiled. Compiling first...');
      // Try several likely locations for the circom source (handles dist vs source layouts)
      // Prefer the project's source circuit file in the repo `src/` directory
      // This avoids compiling the dist-bundled copy which may have been transformed
      const candidateSources = [
        (0, path_1.join)(process.cwd(), 'src', `${CIRCUIT_NAME}.circom`),
        (0, path_1.join)(
          process.cwd(),
          'circuits',
          'src',
          `${CIRCUIT_NAME}.circom`
        ),
        (0, path_1.join)(__dirname, '..', 'src', `${CIRCUIT_NAME}.circom`),
        (0, path_1.join)(
          __dirname,
          '..',
          '..',
          'src',
          `${CIRCUIT_NAME}.circom`
        ),
        (0, path_1.join)(
          process.cwd(),
          'circuits',
          'dist',
          'src',
          `${CIRCUIT_NAME}.circom`
        ),
        (0, path_1.join)(
          process.cwd(),
          'circuits',
          'build',
          `${CIRCUIT_NAME}.r1cs`
        ),
      ];
      let srcPath = null;
      for (const p of candidateSources) {
        if ((0, fs_1.existsSync)(p)) {
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
      const includeLocal = (0, path_1.join)(process.cwd(), 'src');
      const includeCircomlib = (0, path_1.join)(
        process.cwd(),
        '..',
        'node_modules',
        'circomlib',
        'circuits'
      );
      runCommand(
        `circom ${srcPath} -l ${includeLocal} -l ${includeCircomlib} --r1cs --wasm --sym --c -o ${BUILD_DIR}/`,
        'Circuit compilation',
        logger
      );
    }
    // Fast-path: if setup artifacts already exist, skip heavy ceremony work.
    // Check both the setup dir and the mirrored dist location where compiled
    // scripts expect artifacts to live.
    const proofZkey = (0, path_1.join)(SETUP_DIR, `${CIRCUIT_NAME}_0001.zkey`);
    const verificationKey = (0, path_1.join)(
      SETUP_DIR,
      'verification_key.json'
    );
    const distSetupPath = (0, path_1.join)(
      process.cwd(),
      'dist',
      'circuits',
      'zkey'
    );
    const distProofZkey = (0, path_1.join)(
      distSetupPath,
      `${CIRCUIT_NAME}_0001.zkey`
    );
    const distVerificationKey = (0, path_1.join)(
      distSetupPath,
      'verification_key.json'
    );
    // Treat files as present only if they exist and are non-empty. Some test
    // helpers create zero-byte placeholder files which cause snarkjs to fail
    // with "Invalid File format" when attempting to read the zkey. Use a
    // small helper to ensure we only skip setup when artifacts look valid.
    const fileExistsAndNonEmpty = (p) => {
      try {
        return (0, fs_1.existsSync)(p) && (0, fs_1.statSync)(p).size > 0;
      } catch (_) {
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
      console.log(
        'Setup artifacts already exist. Skipping heavy snarkjs steps.'
      );
      // Ensure artifacts are mirrored into dist for downstream compiled scripts
      try {
        if (!(0, fs_1.existsSync)(distSetupPath))
          ensureDirectoryExists(distSetupPath);
        const srcDir = (0, fs_1.existsSync)(SETUP_DIR)
          ? SETUP_DIR
          : distSetupPath;
        const files = (0, fs_1.readdirSync)(srcDir);
        for (const f of files) {
          const srcF = (0, path_1.join)(srcDir, f);
          const dstF = (0, path_1.join)(distSetupPath, f);
          try {
            // Skip mirroring zero-byte files which are likely placeholders
            // created by tests or from earlier runs.
            try {
              if ((0, fs_1.statSync)(srcF).size === 0) {
                console.warn(`Skipping zero-byte artifact: ${srcF}`);
                continue;
              }
            } catch (_) {
              // If stat fails, fall back to copying and let it be handled by caller
            }
            (0, fs_1.copyFileSync)(srcF, dstF);
            console.log(`Mirrored ${srcF} -> ${dstF}`);
          } catch (e) {
            // non-fatal
            console.warn(`Failed to mirror ${srcF} to ${dstF}: ${e.message}`);
          }
        }
        // Also mirror the compiled build artifacts into dist so the proof
        // generation script can find the wasm and supporting files under
        // dist/circuits/build/.
        const distBuildPath = (0, path_1.join)(
          process.cwd(),
          'dist',
          'circuits',
          'build'
        );
        if ((0, fs_1.existsSync)(BUILD_DIR)) {
          ensureDirectoryExists(distBuildPath);
          function copyDirRecursive(src, dst) {
            const entries = (0, fs_1.readdirSync)(src, { withFileTypes: true });
            for (const entry of entries) {
              const srcPath = (0, path_1.join)(src, entry.name);
              const dstPath = (0, path_1.join)(dst, entry.name);
              if (entry.isDirectory()) {
                ensureDirectoryExists(dstPath);
                copyDirRecursive(srcPath, dstPath);
              } else {
                try {
                  (0, fs_1.copyFileSync)(srcPath, dstPath);
                } catch (e) {
                  console.warn(
                    `Failed to copy ${srcPath} -> ${dstPath}: ${e.message}`
                  );
                }
              }
            }
          }
          try {
            copyDirRecursive(BUILD_DIR, distBuildPath);
            console.log(`Mirrored build/ -> ${distBuildPath}`);
          } catch (e) {
            console.warn(`Failed to mirror build to dist: ${e.message}`);
          }
        }
        // Ensure an artifacts directory exists to store verifier address and
        // other ephemeral outputs created by deployment scripts.
        const artifactsDir = (0, path_1.join)(process.cwd(), 'artifacts');
        if (!(0, fs_1.existsSync)(artifactsDir)) {
          ensureDirectoryExists(artifactsDir);
          console.log(`Created artifacts directory: ${artifactsDir}`);
        }
      } catch (e) {
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
    const distFinalPtau = (0, path_1.join)(
      process.cwd(),
      'dist',
      'circuits',
      'zkey',
      `pot${PTAU_POWER}_final.ptau`
    );
    if ((0, fs_1.existsSync)(distFinalPtau)) {
      try {
        (0, fs_1.copyFileSync)(
          distFinalPtau,
          (0, path_1.join)(SETUP_DIR, `pot${PTAU_POWER}_final.ptau`)
        );
        logger.info('Using prebuilt Powers of Tau final from dist', {
          distFinalPtau,
        });
        console.log(
          `ℹ️  Using prebuilt ${distFinalPtau} — skipping powersoftau steps`
        );
      } catch (e) {
        // If copy fails, fall back to generating locally
        logger.warn(
          'Failed to copy prebuilt pot file from dist; will generate locally',
          e.message
        );
      }
    }
    if (
      !(0, fs_1.existsSync)(
        (0, path_1.join)(SETUP_DIR, `pot${PTAU_POWER}_final.ptau`)
      )
    ) {
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
      const distSetupPath = (0, path_1.join)(
        process.cwd(),
        'dist',
        'circuits',
        'zkey'
      );
      if ((0, fs_1.existsSync)(SETUP_DIR)) {
        ensureDirectoryExists(distSetupPath);
        const files = (0, fs_1.readdirSync)(SETUP_DIR);
        for (const f of files) {
          const srcF = (0, path_1.join)(SETUP_DIR, f);
          const dstF = (0, path_1.join)(distSetupPath, f);
          try {
            (0, fs_1.copyFileSync)(srcF, dstF);
            console.log(`Mirrored ${srcF} -> ${dstF}`);
          } catch (e) {
            // non-fatal
            console.warn(`Failed to mirror ${srcF} to ${dstF}: ${e.message}`);
          }
        }
      }
    } catch (e) {
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
    logger.setupError(error, 'trusted-setup');
    logger.performance('circuit-setup-failed', duration, {
      circuitName: CIRCUIT_NAME,
      error: error.message,
    });
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}
if (require.main === module) {
  main();
}
