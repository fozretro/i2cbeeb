#!/usr/bin/env node
/**
 * Playwright script to build AP6 ROM using Archimedes Live emulator
 * 
 * 1. Starts A5000 emulator with preset=a5000 and basic=
 * 2. Copies rommanager.bas to HostFS as AP6
 * 3. Copies required build files (!Compile, 6502_BASIC) to HostFS
 * 4. Runs *EXEC !Compile
 * 5. Waits for BUILD_END marker in OUT file
 * 6. Copies compiled ROM (any file starting with "ap6v") to out/
 * 
 * Usage: node build_ap6_playwright.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(...args) {
  if (VERBOSE) {
    console.log(...args);
  }
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

async function buildAP6() {
  log('Launching browser...');
  const browser = await chromium.launch({
    headless: !VERBOSE, // Run in non-headless mode when verbose
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    log('Loading A5000 emulator...');
    await page.goto('https://archi.medes.live/#preset=a5000&basic=', {
      waitUntil: 'networkidle',
    });
    
    log('Waiting for emulator to initialize...');
    await page.waitForFunction(() => typeof FS !== 'undefined', {
      timeout: 30000,
    });
    
    log('Waiting for HostFS...');
    await page.waitForFunction(() => {
      try {
        if (typeof FS === 'undefined') return false;
        FS.readdir('/hostfs/');
        return true;
      } catch(e) {
        return false;
      }
    }, { timeout: 10000 });
    
    log('Emulator ready');
    await page.waitForTimeout(1000);
    
    const rommanagerPath = path.join(__dirname, '../../src.rommanager/rommanager.bas');
    if (!fs.existsSync(rommanagerPath)) {
      throw new Error(`File not found: ${rommanagerPath}`);
    }
    
    log('Reading rommanager.bas...');
    const fileData = fs.readFileSync(rommanagerPath);
    const binPath = path.join(__dirname, 'bin');
    const requiredFiles = ['!Compile', '6502_BASIC'];
    
    // Copy AP6 (rommanager.bas) first
    process.stdout.write('Copying files to HostFS... ');
    const uploaded = await page.evaluate(({ filename, data }) => {
      try {
        const uint8Array = new Uint8Array(data);
        if (typeof putFileOnHostFs === 'function') {
          const blob = new Blob([uint8Array]);
          putFileOnHostFs(filename, blob, '/');
          return { success: true };
        } else {
          FS.createDataFile('/hostfs', filename, uint8Array, true, true);
          return { success: true };
        }
      } catch(e) {
        return { success: false, error: e.message };
      }
    }, { filename: 'AP6', data: Array.from(fileData) });
    
    if (!uploaded.success) {
      throw new Error(`Failed to upload AP6: ${uploaded.error}`);
    }
    
    // Copy other required files
    for (const filename of requiredFiles) {
      const filePath = path.join(binPath, filename);
      if (fs.existsSync(filePath)) {
        const reqFileData = fs.readFileSync(filePath);
        const reqUploaded = await page.evaluate(({ filename, data }) => {
          try {
            const uint8Array = new Uint8Array(data);
            if (typeof putFileOnHostFs === 'function') {
              const blob = new Blob([uint8Array]);
              putFileOnHostFs(filename, blob, '/');
              return { success: true };
            } else {
              FS.createDataFile('/hostfs', filename, uint8Array, true, true);
              return { success: true };
            }
          } catch(e) {
            return { success: false, error: e.message };
          }
        }, { filename, data: Array.from(reqFileData) });
        
        if (!reqUploaded.success) {
          throw new Error(`Failed to upload ${filename}: ${reqUploaded.error}`);
        }
      } else {
        throw new Error(`Required file not found: ${filename}`);
      }
    }
    console.log('done');
    
    // Run *EXEC !Compile
    process.stdout.write('Executing build... ');
    const inputBox = page.locator('textarea, input[type="text"]').first();
    await inputBox.waitFor({ state: 'visible', timeout: 5000 });
    await inputBox.click();
    // Type the command - simple approach that worked with !MkAP6
    await inputBox.press('Shift+Digit8', { delay: 10 }); // This types *
    await inputBox.type('EXEC !Compile', { delay: 10 });
    
    const runButton = page.locator('button:has-text("Run"), button[aria-label*="Run"], button:has-text("Run (ctrl-enter")').first();
    
    try {
      await runButton.waitFor({ state: 'visible', timeout: 5000 });
      await runButton.click();
    } catch(e) {
      await inputBox.press('Enter');
    }
    console.log('done');
    
    // Wait for build to complete (poll OUT file)
    process.stdout.write('Waiting for build');
    let buildComplete = false;
    let lineCleared = false;
    let outFileContent = '';
    let attempts = 0;
    const maxAttempts = 120;
    
    while (!buildComplete && attempts < maxAttempts) {
      await page.waitForTimeout(500); // Reduced from 1000ms to 500ms for faster polling
      attempts++;
      if (attempts % 10 === 0) { // Adjusted for 500ms intervals (every 5 seconds)
        process.stdout.write('.');
      }
      if (VERBOSE && attempts % 20 === 0) { // Adjusted for 500ms intervals (every 10 seconds)
        log(`\n  [${Math.floor(attempts * 0.5)}s] Still waiting...`);
      }
      
      const checkResult = await page.evaluate(() => {
        const results = { found: false, content: '', size: 0, error: null, buildComplete: false, buildFailed: false };
        try {
          const files = FS.readdir('/hostfs/').filter(f => f !== '.' && f !== '..');
          const outFile = files.find(f => f.toLowerCase() === 'out' || f.toLowerCase().startsWith('out,'));
          
          if (outFile) {
            try {
              const buf = FS.readFile('/hostfs/' + outFile, { encoding: 'binary' });
              const bytes = new Uint8Array(buf);
              let text = '';
              try {
                text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
              } catch(e) {
                text = String.fromCharCode.apply(null, bytes);
              }
              results.found = true;
              results.content = text;
              results.size = bytes.length;
              
              const lowerText = text.toLowerCase();
              
              // Extract build output between BUILD_START and BUILD_END
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
                  // Skip RUN and *Quit lines (case-insensitive, trimmed)
                  const trimmedLower = lowerLine.trim();
                  if (!trimmedLower.includes('run') && 
                      !trimmedLower.includes('*quit') && 
                      !trimmedLower.startsWith('*quit') &&
                      trimmedLower !== 'run') {
                    buildLines.push(line);
                  }
                }
              }
              
              results.buildOutput = buildLines.join('\n').trim();
              results.foundBuildEnd = foundBuildEnd;
              
              // Check for BUILD_END (completion marker)
              if (foundBuildEnd) {
                // If BUILD_END is reached, check if there's any content (other than RUN/*Quit)
                // Any content = error, no content = success
                const cleanOutput = results.buildOutput.replace(/\s+/g, ' ').trim();
                
                if (cleanOutput.length > 0) {
                  // There's content between BUILD_START and BUILD_END (excluding RUN/*Quit)
                  // This is an error
                  results.buildFailed = true;
                } else {
                  // BUILD_END reached with no content = success
                  results.buildComplete = true;
                }
              }
            } catch(e) {
              results.error = e.message;
            }
          }
        } catch(e) {
          results.error = e.message;
        }
        return results;
      });
      
      if (checkResult.found) {
        outFileContent = checkResult.content;
        
        // Check for failures during polling
        if (checkResult.buildFailed) {
          // Output only the build failure text (between BUILD_START and BUILD_END)
          // Clear the progress line first
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          if (checkResult.buildOutput) {
            // Show the build output in red
            failure('');
            console.log(`${colors.red}${checkResult.buildOutput}${colors.reset}`);
          } else {
            failure('errors detected in OUT file');
          }
          await browser.close();
          process.exit(1);
        }
        
        if (checkResult.buildComplete) {
          // Double-check: if there's content, it's actually a failure
          if (checkResult.buildOutput && checkResult.buildOutput.replace(/\s+/g, ' ').trim().length > 0) {
            // Content found = error, not success
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
            failure('');
            console.log(`${colors.red}${checkResult.buildOutput}${colors.reset}`);
            await browser.close();
            process.exit(1);
          }
          buildComplete = true;
          // Move to a new line (don't try to clear, just move to next line)
          if (!lineCleared) {
            process.stdout.write('\n');
            lineCleared = true;
          }
          // In verbose mode, show what we detected
          if (VERBOSE) {
            log(`Build complete detected! OUT file size: ${checkResult.size} bytes`);
            if (checkResult.buildOutput) {
              log(`Extracted build output length: ${checkResult.buildOutput.length} chars`);
            }
          }
          break;
        }
        
        // Show OUT file content more frequently in verbose mode
        if (VERBOSE && attempts % 10 === 0) { // Every 5 seconds in verbose mode
          const lines = outFileContent.split('\n').filter(l => l.trim()).slice(-5);
          if (lines.length > 0) {
            log(`  OUT file (last 5 lines):`);
            lines.forEach(line => log(`    ${line}`));
          }
        }
      }
    }
    
    // Move to a new line if not already done
    if (!lineCleared) {
      process.stdout.write('\n');
      lineCleared = true;
    }
    
    // Extract build output one final time to check for failures
    let buildOutput = '';
    if (outFileContent) {
      const lines = outFileContent.split('\n');
      let inBuildSection = false;
      const buildLines = [];
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.includes('build_start')) {
          inBuildSection = true;
          continue;
        }
        if (lowerLine.includes('build_end')) {
          inBuildSection = false;
          break;
        }
        if (inBuildSection) {
          // Skip RUN and *Quit lines (case-insensitive, trimmed)
          const trimmedLower = lowerLine.trim();
          if (!trimmedLower.includes('run') && 
              !trimmedLower.includes('*quit') && 
              !trimmedLower.startsWith('*quit') &&
              trimmedLower !== 'run') {
            buildLines.push(line);
          }
        }
      }
      buildOutput = buildLines.join('\n').trim();
    }
    
    // Always show OUT file content in verbose mode when build completes or times out
    if (VERBOSE && outFileContent) {
      log('\nFull OUT file contents:');
      log('─'.repeat(60));
      log(outFileContent);
      log('─'.repeat(60));
      if (buildOutput) {
        log('\nExtracted build output (BUILD_START to BUILD_END):');
        log('─'.repeat(60));
        log(buildOutput);
        log('─'.repeat(60));
      }
    }
    
    if (!buildComplete) {
      // Clear the progress line
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      // If we have build output, show it; otherwise show timeout message
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
      await browser.close();
      process.exit(1);
    }
    
    // Final check: if BUILD_END was reached but there's content (other than RUN/*Quit),
    // treat it as an error
    if (buildComplete && buildOutput) {
      const cleanOutput = buildOutput.replace(/\s+/g, ' ').trim();
      
      // If there's any content (not just whitespace), it's an error
      if (cleanOutput.length > 0) {
        // Clear the progress line
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        failure('');
        // Output only the build failure text in red
        console.log(`${colors.red}${buildOutput}${colors.reset}`);
        await browser.close();
        process.exit(1);
      }
    }
    
    // Check for AP6v* ROM in HostFS
    const romCheckResult = await page.evaluate(() => {
      const results = { found: false, name: null, size: 0, error: null };
      try {
        const files = FS.readdir('/hostfs/').filter(f => f !== '.' && f !== '..');
        const romFile = files.find(f => {
          const lower = f.toLowerCase();
          return lower.startsWith('ap6v') && !lower.includes('out');
        });
        
        if (romFile) {
          const buf = FS.readFile('/hostfs/' + romFile, { encoding: 'binary' });
          const bytes = new Uint8Array(buf);
          results.found = true;
          results.name = romFile;
          results.size = bytes.length;
        }
      } catch(e) {
        results.error = e.message;
      }
      return results;
    });
    
    if (romCheckResult.found) {
      await page.evaluate((romFilename) => {
        if (typeof downloadHostFSfile === 'function') {
          downloadHostFSfile(romFilename);
        }
      }, romCheckResult.name);
      
      await page.waitForTimeout(500); // Reduced from 2000ms - download is just a trigger, we read directly from HostFS
      
      const romData = await page.evaluate((romFilename) => {
        try {
          const buf = FS.readFile('/hostfs/' + romFilename, { encoding: 'binary' });
          return Array.from(new Uint8Array(buf));
        } catch(e) {
          return null;
        }
      }, romCheckResult.name);
      
      if (romData) {
        // Ensure out directory exists
        const outDir = path.join(__dirname, 'out');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        const localRomPath = path.join(outDir, romCheckResult.name.split(',')[0]);
        fs.writeFileSync(localRomPath, Buffer.from(romData));
        
        // Calculate relative path from project root (two levels up from __dirname)
        const projectRoot = path.join(__dirname, '../..');
        const relativePath = path.relative(projectRoot, localRomPath);
        success(`${romData.length} bytes -> ${relativePath}`);
      } else {
        failure('Could not read ROM data from HostFS');
        await browser.close();
        process.exit(1);
      }
    } else {
      // ROM not found - show OUT file content to help debug
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      failure('AP6v* ROM not found in HostFS');
      
      // Show build output if available (in red)
      if (buildOutput) {
        console.log(`${colors.red}${buildOutput}${colors.reset}`);
      } else if (outFileContent) {
        console.log('\nOUT file contents:');
        console.log('─'.repeat(60));
        console.log(outFileContent);
        console.log('─'.repeat(60));
      }
      
      if (romCheckResult.error) {
        console.log(`  ${colors.red}${romCheckResult.error}${colors.reset}`);
      }
      await browser.close();
      process.exit(1);
    }
    
  } catch (error) {
    failure(error.message);
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }
}

buildAP6().catch(console.error);
