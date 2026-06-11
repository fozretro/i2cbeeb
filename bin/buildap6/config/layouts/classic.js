/**
 * Original AP6v134t-style amalgam: TreeCopy in place of I²C.
 *
 * Use this layout to exercise ROM Manager and Plus 1 Support without I²CBeeb
 * (Serv7 OSBYTE 161/162 from &0D6D is the NVRAM provider).
 *
 * TreeCopy slot: roms/TreeROM-v1.62.rom (relocatable; may exceed original 1.61 size).
 * Prefer TreeCopy 1.61 (~8291 bytes) if SMJoin reports overflow.
 *
 * ROM paths are relative to bin/buildap6/ when smjoin-create.js runs.
 */

module.exports = {
    id: "classic",
    description: "AP6v134t classic (TreeCopy, no I²C)",
    romFiles: [
        {
            path: "../../bin/buildplus1support/out/AP1v131",
            name: "AP1Plus",
        },
        {
            path: "../../roms/TreeROM-v1.62.rom",
            name: "TreeCopy",
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
        // AP6Count omitted: TreeROM 1.62 leaves no room (8291-byte TreeCopy 1.61 fits with AP6Count).
    ],
    output: {
        path: "out/ap6-classic.rom",
        name: "AP6v134t classic (TreeCopy, no I2C)",
    },
};
