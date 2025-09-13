#!/usr/bin/env node

/**
 * Coverage Report Generator
 *
 * This script generates comprehensive coverage reports for the entire workspace.
 * It merges coverage data from all projects and generates HTML, LCOV, and JSON reports.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COVERAGE_DIR = 'coverage';
const MERGED_COVERAGE_DIR = path.join(COVERAGE_DIR, 'merged');
const NYC_OUTPUT_DIR = path.join(COVERAGE_DIR, '.nyc_output');

console.log('🔍 Generating comprehensive coverage report...');

// Ensure coverage directories exist
if (!fs.existsSync(COVERAGE_DIR)) {
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
}

if (!fs.existsSync(MERGED_COVERAGE_DIR)) {
  fs.mkdirSync(MERGED_COVERAGE_DIR, { recursive: true });
}

if (!fs.existsSync(NYC_OUTPUT_DIR)) {
  fs.mkdirSync(NYC_OUTPUT_DIR, { recursive: true });
}

try {
  // Find all coverage.json files
  const coverageFiles = [];

  function findCoverageFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findCoverageFiles(fullPath);
      } else if (item === 'coverage-final.json') {
        coverageFiles.push(fullPath);
      }
    }
  }

  findCoverageFiles(COVERAGE_DIR);

  if (coverageFiles.length === 0) {
    console.log('❌ No coverage files found. Run tests with coverage first.');
    process.exit(1);
  }

  console.log(`📊 Found ${coverageFiles.length} coverage files:`);
  coverageFiles.forEach((file) => console.log(`  - ${file}`));

  // Copy coverage files to nyc output directory
  coverageFiles.forEach((file, index) => {
    const destFile = path.join(NYC_OUTPUT_DIR, `out${index}.json`);
    fs.copyFileSync(file, destFile);
  });

  // Generate merged report
  console.log('🔄 Merging coverage data...');
  execSync('npx nyc merge coverage/.nyc_output coverage/merged-coverage.json', {
    stdio: 'inherit',
  });

  // Generate reports
  console.log('📈 Generating coverage reports...');
  execSync(
    'npx nyc report --reporter=html --reporter=text --reporter=lcov --report-dir=coverage/merged',
    { stdio: 'inherit' }
  );

  // Generate summary
  const summaryFile = path.join(MERGED_COVERAGE_DIR, 'coverage-summary.json');
  if (fs.existsSync(summaryFile)) {
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));

    console.log('\n📊 Coverage Summary:');
    console.log('==================');

    const total = summary.total;
    console.log(
      `Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`
    );
    console.log(
      `Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`
    );
    console.log(
      `Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`
    );
    console.log(
      `Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`
    );

    // Check thresholds
    const thresholds = {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    };

    let passed = true;
    for (const [metric, threshold] of Object.entries(thresholds)) {
      if (total[metric].pct < threshold) {
        console.log(
          `❌ ${metric} coverage (${total[metric].pct}%) is below threshold (${threshold}%)`
        );
        passed = false;
      } else {
        console.log(
          `✅ ${metric} coverage (${total[metric].pct}%) meets threshold (${threshold}%)`
        );
      }
    }

    if (!passed) {
      console.log('\n❌ Coverage thresholds not met!');
      process.exit(1);
    } else {
      console.log('\n✅ All coverage thresholds met!');
    }
  }

  console.log(`\n📁 Coverage reports generated in: ${MERGED_COVERAGE_DIR}`);
  console.log(
    `🌐 Open coverage/merged/index.html in your browser to view the detailed report`
  );
} catch (error) {
  console.error('❌ Error generating coverage report:', error.message);
  process.exit(1);
}
