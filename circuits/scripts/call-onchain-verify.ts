import path from 'path';
import fs from 'fs';
import { JsonRpcProvider, Contract } from 'ethers';

async function main() {
  const rpc = process.env['RPC_URL'] || 'http://127.0.0.1:8545';
  const provider = new JsonRpcProvider(rpc);
  const signer = await provider.getSigner(0);

  const addrPath = path.join(
    process.cwd(),
    'artifacts',
    'verifier-address.txt'
  );
  if (!fs.existsSync(addrPath))
    throw new Error('verifier address file not found');
  const verifierAddress = fs.readFileSync(addrPath, 'utf8').trim();

  const verifierAbi = [
    'function verifyProof(uint256[2], uint256[2][2], uint256[2], uint256[25]) view returns (bool)',
  ];

  const contract = new Contract(verifierAddress, verifierAbi, signer);

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

  // Transform snarkjs output to solidity input
  const pA = [
    BigInt(proof.pi_a[0]).toString(),
    BigInt(proof.pi_a[1]).toString(),
  ];
  const pB = [
    [BigInt(proof.pi_b[0][1]).toString(), BigInt(proof.pi_b[0][0]).toString()],
    [BigInt(proof.pi_b[1][1]).toString(), BigInt(proof.pi_b[1][0]).toString()],
  ];
  const pC = [
    BigInt(proof.pi_c[0]).toString(),
    BigInt(proof.pi_c[1]).toString(),
  ];
  const pubSignals = publicSignals
    .map((s: string) => BigInt(s).toString())
    .slice(0, 25);

  // Type the on-chain verifier function to avoid `any`.
  type VerifyProofFn = (
    a: [string, string],
    b: [[string, string], [string, string]],
    c: [string, string],
    input: string[]
  ) => Promise<boolean>;

  const verifier = contract as unknown as { verifyProof: VerifyProofFn };
  const ok = await verifier.verifyProof(
    pA as [string, string],
    pB as [[string, string], [string, string]],
    pC as [string, string],
    pubSignals
  );
  console.log('On-chain verify result:', ok);
  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
