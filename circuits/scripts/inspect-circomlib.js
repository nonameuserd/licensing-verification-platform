(async () => {
  try {
    const m = await import('circomlibjs');
    console.log('exports:', Object.keys(m));
    console.log('eddsa keys:', Object.keys(m.eddsa || {}));
    console.log(
      'has buildEddsa:',
      !!m.buildEddsa,
      'has buildPoseidon:',
      !!m.buildPoseidon
    );
  } catch (e) {
    console.error('ERR import circomlibjs:', (e && e.message) || e);
    process.exit(1);
  }
})();
