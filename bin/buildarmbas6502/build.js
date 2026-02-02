#!/usr/bin/env node
/**
 * Shared Playwright script to build ROMs using Archimedes Live emulator and Arm BASIC 6502.
 *
 * 1. Starts A5000 emulator with preset=a5000 and basic=
 * 2. Copies project .bas to HostFS (name from config.hostFsName)
 * 3. Copies !Compile script and 6502_BASIC module to HostFS
 * 4. Runs *EXEC !Compile
 * 5. Waits for BUILD_END marker in OUT file
 * 6. Copies compiled ROM (matching config.romPattern) to config.outDir
 *
 * Usage: node build.js --config <path-to-config.json> [--verbose]
 * Config: { sourcePath, hostFsName, romPattern, compileScriptPath, outDir, projectName }
 * Paths in config are relative to the config file's directory.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const configArgIndex = process.argv.indexOf('--config');
const configPath = configArgIndex >= 0 && process.argv[configArgIndex + 1]
  ? path.resolve(process.cwd(), process.argv[configArgIndex + 1])
  : null;

if (!configPath || !fs.existsSync(configPath)) {
  console.error('Usage: node build.js --config <path-to-config.json> [--verbose]');
  process.exit(1);
}

const configDir = path.dirname(configPath);
const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const config = {
  sourcePath: path.resolve(configDir, rawConfig.sourcePath),
  hostFsName: rawConfig.hostFsName,
  romPattern: rawConfig.romPattern,
  compileScriptPath: path.resolve(configDir, rawConfig.compileScriptPath),
  outDir: path.resolve(configDir, rawConfig.outDir),
  projectName: rawConfig.projectName || 'ROM',
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(...args) {
  if (VERBOSE) console.log(...args);
}

function success(msg) {
  console.log(`${colors.green}SUCCESS:${colors.reset}`);
  console.log(`${msg}`);
}

function failure(msg) {
  if (msg) {
    console.log(`${colors.red}FAILED:${colors.reset} ${msg}`);
  } else {
    console.log(`${colors.red}FAILED:${colors.reset}`);
  }
}

async function waitForExploration(page) {
  if (VERBOSE) {
    console.log(`\n${colors.blue}Keeping browser open for 5 minutes for exploration...${colors.reset}`);
    await page.waitForTimeout(5 * 60 * 1000);
  }
}

const BUILD_DIR = path.join(__dirname, 'bin');

async function runBuild() {
  log('Launching browser...');
  const browser = await chromium.launch({ headless: !VERBOSE });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    log('Loading A5000 emulator...');
    await page.goto('https://archi.medes.live/#preset=a5000&basic=', {
      waitUntil: 'networkidle',
    });

    log('Waiting for emulator to initialize...');
    await page.waitForFunction(() => typeof FS !== 'undefined', { timeout: 30000 });

    log('Waiting for HostFS...');
    await page.waitForFunction(() => {
      try {
        if (typeof FS === 'undefined') return false;
        FS.readdir('/hostfs/');
        return true;
      } catch (e) {
        return false;
      }
    }, { timeout: 10000 });

    log('Emulator ready');
    await page.waitForTimeout(1000);

    if (!fs.existsSync(config.sourcePath)) {
      throw new Error(`File not found: ${config.sourcePath}`);
    }

    log('Reading source and build files...');
    const fileData = fs.readFileSync(config.sourcePath);
    const compileScriptData = fs.readFileSync(config.compileScriptPath);
    const basicModulePath = path.join(BUILD_DIR, '6502_BASIC');
    if (!fs.existsSync(basicModulePath)) {
      throw new Error(`6502_BASIC not found: ${basicModulePath}`);
    }
    const basicModuleData = fs.readFileSync(basicModulePath);

    process.stdout.write('Copying files to HostFS... ');
    const upload = (filename, data) =>
      page.evaluate(
        ({ filename, data }) => {
          try {
            const uint8Array = new Uint8Array(data);
            if (typeof putFileOnHostFs === 'function') {
              const blob = new Blob([uint8Array]);
              putFileOnHostFs(filename, blob, '/');
              return { success: true };
            }
            FS.createDataFile('/hostfs', filename, uint8Array, true, true);
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
        { filename, data: Array.from(data) }
      );

    const uploaded = await upload(config.hostFsName, fileData);
    if (!uploaded.success) throw new Error(`Failed to upload ${config.hostFsName}: ${uploaded.error}`);

    const compileUploaded = await upload('!Compile', compileScriptData);
    if (!compileUploaded.success) throw new Error(`Failed to upload !Compile: ${compileUploaded.error}`);

    const basicUploaded = await upload('6502_BASIC', basicModuleData);
    if (!basicUploaded.success) throw new Error(`Failed to upload 6502_BASIC: ${basicUploaded.error}`);

    console.log('done');

    process.stdout.write('Executing build... ');
    const inputBox = page.locator('textarea, input[type="text"]').first();
    await inputBox.waitFor({ state: 'visible', timeout: 5000 });
    await inputBox.click();
    await inputBox.press('Shift+Digit8', { delay: 10 });
    await inputBox.type('EXEC !Compile', { delay: 10 });

    const runButton = page.locator('button:has-text("Run"), button[aria-label*="Run"], button:has-text("Run (ctrl-enter")').first();
    try {
      await runButton.waitFor({ state: 'visible', timeout: 5000 });
      await runButton.click();
    } catch (e) {
      await inputBox.press('Enter');
    }
    console.log('done');

    process.stdout.write('Waiting for build');
    let buildComplete = false;
    let lineCleared = false;
    let outFileContent = '';
    let attempts = 0;
    const maxAttempts = 120;
    const patternLower = config.romPattern.toLowerCase();

    while (!buildComplete && attempts < maxAttempts) {
      await page.waitForTimeout(500);
      attempts++;
      if (attempts % 10 === 0) process.stdout.write('.');
      if (VERBOSE && attempts % 20 === 0) log(`\n  [${Math.floor(attempts * 0.5)}s] Still waiting...`);

      const checkResult = await page.evaluate(() => {
        const results = { found: false, content: '', size: 0, error: null, buildComplete: false, buildFailed: false };
        try {
          const files = FS.readdir('/hostfs/').filter((f) => f !== '.' && f !== '..');
          const outFile = files.find((f) => f.toLowerCase() === 'out' || f.toLowerCase().startsWith('out,'));

          if (outFile) {
            try {
              const buf = FS.readFile('/hostfs/' + outFile, { encoding: 'binary' });
              const bytes = new Uint8Array(buf);
              let text = '';
              try {
                text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
              } catch (e) {
                text = String.fromCharCode.apply(null, bytes);
              }
              results.found = true;
              results.content = text;
              results.size = bytes.length;

              const lines = text.split('\n');
              let inBuildSection = false;
              const buildLines = [];
              let foundBuildEnd = false;

              for (const line of lines) {
                const lowerLine = line.toLowerCase().trim();
                if (lowerLine.includes('build_start')) {
                  inBuildSection = true;
                  continue;
                }
                if (lowerLine.includes('build_end')) {
                  inBuildSection = false;
                  foundBuildEnd = true;
                  break;
                }
                if (inBuildSection) {
                  const trimmedLower = lowerLine.trim();
                  if (trimmedLower === '*' || trimmedLower === '') continue; // prompt echo
                  if (
                    trimmedLower.includes('run') ||
                    trimmedLower.includes('*quit') ||
                    trimmedLower.startsWith('*quit') ||
                    trimmedLower === 'run'
                  ) {
                    continue;
                  }
                  if (
                    trimmedLower.includes('**b6502') ||
                    trimmedLower.includes('*b6502') ||
                    trimmedLower.includes('arm bbc basic') ||
                    trimmedLower.includes('(c) acorn') ||
                    trimmedLower.includes('starting with') ||
                    trimmedLower.includes('bytes free') ||
                    trimmedLower.includes('program renumbered')
                  ) {
                    continue;
                  }
                  buildLines.push(line);
                }
              }

              results.buildOutput = buildLines.join('\n').trim();
              results.foundBuildEnd = foundBuildEnd;

              if (foundBuildEnd) {
                const cleanOutput = results.buildOutput.replace(/\s+/g, ' ').trim();
                results.buildFailed = cleanOutput.length > 0;
                if (!results.buildFailed) results.buildComplete = true;
              }
            } catch (e) {
              results.error = e.message;
            }
          }
        } catch (e) {
          results.error = e.message;
        }
        return results;
      });

      if (checkResult.found) {
        outFileContent = checkResult.content;

        if (checkResult.buildFailed) {
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          if (checkResult.buildOutput) {
            failure('');
            console.log(`${colors.red}${checkResult.buildOutput}${colors.reset}`);
          } else {
            failure('errors detected in OUT file');
          }
          await waitForExploration(page);
          await browser.close();
          process.exit(1);
        }

        if (checkResult.buildComplete) {
          if (checkResult.buildOutput && checkResult.buildOutput.replace(/\s+/g, ' ').trim().length > 0) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
            failure('');
            console.log(`${colors.red}${checkResult.buildOutput}${colors.reset}`);
            await waitForExploration(page);
            await browser.close();
            process.exit(1);
          }
          buildComplete = true;
          if (!lineCleared) {
            process.stdout.write('\n');
            lineCleared = true;
          }
          if (VERBOSE) {
            log(`Build complete. OUT file size: ${checkResult.size} bytes`);
          }
          break;
        }

        if (VERBOSE && attempts % 10 === 0) {
          const lines = outFileContent.split('\n').filter((l) => l.trim()).slice(-5);
          if (lines.length > 0) {
            log('  OUT file (last 5 lines):');
            lines.forEach((line) => log(`    ${line}`));
          }
        }
      }
    }

    if (!lineCleared) {
      process.stdout.write('\n');
      lineCleared = true;
    }

    let buildOutput = '';
    if (outFileContent) {
      const lines = outFileContent.split('\n');
      let inBuildSection = false;
      const buildLines = [];
      for (const line of lines) {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.includes('build_start')) inBuildSection = true;
        else if (lowerLine.includes('build_end')) break;
        else if (inBuildSection) {
          const trimmedLower = line.trim().toLowerCase();
          if (trimmedLower === '*' || trimmedLower === '') continue;
          if (
            trimmedLower.includes('run') ||
            trimmedLower.includes('*quit') ||
            trimmedLower === 'run'
          ) continue;
          if (
            trimmedLower.includes('**b6502') ||
            trimmedLower.includes('*b6502') ||
            trimmedLower.includes('arm bbc basic') ||
            trimmedLower.includes('(c) acorn') ||
            trimmedLower.includes('starting with') ||
            trimmedLower.includes('bytes free') ||
            trimmedLower.includes('program renumbered')
          ) continue;
          buildLines.push(line);
        }
      }
      buildOutput = buildLines.join('\n').trim();
    }

    if (VERBOSE && outFileContent) {
      log('\nFull OUT file contents:');
      log('─'.repeat(60));
      log(outFileContent);
      log('─'.repeat(60));
    }

    if (!buildComplete) {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      if (buildOutput) {
        failure('');
        console.log(`${colors.red}${buildOutput}${colors.reset}`);
      } else {
        failure('did not complete within expected time');
        if (outFileContent) {
          console.log('\nOUT file contents:');
          console.log('─'.repeat(60));
          console.log(outFileContent);
          console.log('─'.repeat(60));
        }
      }
      await waitForExploration(page);
      await browser.close();
      process.exit(1);
    }

    if (buildComplete && buildOutput && buildOutput.replace(/\s+/g, ' ').trim().length > 0) {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      failure('');
      console.log(`${colors.red}${buildOutput}${colors.reset}`);
      await waitForExploration(page);
      await browser.close();
      process.exit(1);
    }

    const romCheckResult = await page.evaluate((pattern) => {
      const results = { found: false, name: null, size: 0, error: null };
      try {
        const files = FS.readdir('/hostfs/').filter((f) => f !== '.' && f !== '..');
        const romFile = files.find((f) => {
          const lower = f.toLowerCase();
          return lower.startsWith(pattern) && !lower.includes('out');
        });

        if (romFile) {
          const buf = FS.readFile('/hostfs/' + romFile, { encoding: 'binary' });
          const bytes = new Uint8Array(buf);
          results.found = true;
          results.name = romFile;
          results.size = bytes.length;
        }
      } catch (e) {
        results.error = e.message;
      }
      return results;
    }, patternLower);

    if (romCheckResult.found) {
      await page.evaluate((romFilename) => {
        if (typeof downloadHostFSfile === 'function') downloadHostFSfile(romFilename);
      }, romCheckResult.name);

      await page.waitForTimeout(500);

      const romData = await page.evaluate((romFilename) => {
        try {
          const buf = FS.readFile('/hostfs/' + romFilename, { encoding: 'binary' });
          return Array.from(new Uint8Array(buf));
        } catch (e) {
          return null;
        }
      }, romCheckResult.name);

      if (romData) {
        if (!fs.existsSync(config.outDir)) {
          fs.mkdirSync(config.outDir, { recursive: true });
        }
        const localRomPath = path.join(config.outDir, romCheckResult.name.split(',')[0]);
        fs.writeFileSync(localRomPath, Buffer.from(romData));
        const relativePath = path.relative(process.cwd(), localRomPath);
        success(`${romData.length} bytes -> ${relativePath}`);
        await waitForExploration(page);
      } else {
        failure('Could not read ROM data from HostFS');
        await waitForExploration(page);
        await browser.close();
        process.exit(1);
      }
    } else {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      failure(`${config.romPattern}* ROM not found in HostFS`);
      if (buildOutput) console.log(`${colors.red}${buildOutput}${colors.reset}`);
      else if (outFileContent) {
        console.log('\nOUT file contents:');
        console.log('─'.repeat(60));
        console.log(outFileContent);
        console.log('─'.repeat(60));
      }
      if (romCheckResult.error) console.log(`  ${colors.red}${romCheckResult.error}${colors.reset}`);
      await waitForExploration(page);
      await browser.close();
      process.exit(1);
    }
  } catch (error) {
    failure(error.message);
    await waitForExploration(page);
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBuild().catch(console.error);
