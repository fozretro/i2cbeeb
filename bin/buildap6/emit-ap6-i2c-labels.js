#!/usr/bin/env node

/**
 * Translate standalone I²C BeebAsm labels for the I²C slice embedded in dist/ap6.rom.
 * All symbol addresses are shifted by the SMJoin image offset of the I²C module.
 */

const fs = require('fs');
const path = require('path');

function parseBeebAsmLabels(content) {
    const trimmed = content.trim();
    if (!trimmed) {
        throw new Error('BeebAsm labels file is empty');
    }
    const jsonLike = trimmed.replace(/(\d+)L/g, '$1').replace(/'/g, '"');
    const parsed = JSON.parse(jsonLike);
    if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0] !== 'object') {
        throw new Error('BeebAsm labels file has unexpected structure');
    }
    return parsed[0];
}

function formatBeebAsmLabels(symbols) {
    const entries = Object.entries(symbols).sort(([a], [b]) => a.localeCompare(b));
    const inner = entries.map(([name, addr]) => `'${name}':${addr}L`).join(',');
    return `[{${inner}}]\n`;
}

/**
 * @param {{ sourcePath: string, outputPath: string, manifestPath: string, imageOffset: number, romBase?: number }} options
 */
function emitAp6I2cLabels(options) {
    const { sourcePath, outputPath, manifestPath, imageOffset, romBase = 0x8000 } = options;

    const sourceAbs = path.resolve(sourcePath);
    if (!fs.existsSync(sourceAbs)) {
        throw new Error(`I²C labels source not found: ${sourceAbs}`);
    }

    const symbols = parseBeebAsmLabels(fs.readFileSync(sourceAbs, 'utf8'));
    const translated = {};
    for (const [name, address] of Object.entries(symbols)) {
        if (typeof address !== 'number') {
            throw new Error(`Invalid address for label ${name}`);
        }
        translated[name] = address + imageOffset;
    }

    const outputAbs = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
    fs.writeFileSync(outputAbs, formatBeebAsmLabels(translated));

    const manifestAbs = path.resolve(manifestPath);
    fs.writeFileSync(
        manifestAbs,
        `${JSON.stringify(
            {
                romBase,
                i2cImageOffset: imageOffset,
                i2cLabelsSource: path.basename(sourceAbs),
                compositeRom: path.basename(outputAbs),
            },
            null,
            2,
        )}\n`,
    );

    console.log(`✅ I²C composite labels: ${outputAbs} (+0x${imageOffset.toString(16)} offset)`);
    console.log(`✅ Manifest: ${manifestAbs}`);
}

module.exports = { emitAp6I2cLabels, parseBeebAsmLabels, formatBeebAsmLabels };

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        console.log('Usage: node emit-ap6-i2c-labels.js <source.labels> <output.labels> <manifest.json> <hexOffset>');
        process.exit(1);
    }
    emitAp6I2cLabels({
        sourcePath: args[0],
        outputPath: args[1],
        manifestPath: args[2],
        imageOffset: parseInt(args[3], 16),
    });
}
