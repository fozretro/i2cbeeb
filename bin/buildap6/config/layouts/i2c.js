/**
 * AP6 amalgam with relocated I²CBeeb replacing TreeCopy (default production layout).
 *
 * ROM paths are relative to bin/buildap6/ when smjoin-create.js runs.
 */

module.exports = {
    id: "i2c",
    description: "AP6v134t with I²C replacing TreeCopy",
    romFiles: [
        {
            path: "../../bin/buildplus1support/out/AP1v131",
            name: "AP1Plus",
        },
        {
            path: "tmp/i2c-reloc.rom",
            name: "I2C",
            pageAlignment: true,
        },
        {
            path: "../../bin/buildrommanager/out/AP6v134",
            name: "ROMManager",
            pageAlignment: false,
        },
        {
            path: "../../roms/TUBEelk-v1.10.rom",
            name: "TUBEelk",
            pageAlignment: false,
        },
        {
            path: "../../roms/AP6Count-v0.05.rom",
            name: "AP6Count",
            pageAlignment: false,
        },
    ],
    output: {
        path: "../../dist/ap6.rom",
        name: "AP6v134t-I2C ROM (TreeCopy replaced with I2C)",
    },
    i2cLabels: {
        source: "tmp/C.I2CEAP6.labels",
        output: "../../dist/ap6-i2c.labels",
        manifest: "../../dist/ap6-i2c.manifest.json",
        moduleName: "I2C",
        romBase: 0x8000,
    },
};
