/**
 * SMJoin layout selector for AP6 amalgam builds.
 *
 * Set AP6_SMJOIN_LAYOUT (or pass --layout to bin/buildap6/build.sh):
 *   i2c      — I²CBeeb replaces TreeCopy → dist/ap6.rom (default)
 *   classic  — original TreeCopy slot, no I²C → dist/ap6-classic.rom
 */

const layouts = {
    i2c: require("./layouts/i2c.js"),
    classic: require("./layouts/classic.js"),
};

const layoutId = process.env.AP6_SMJOIN_LAYOUT || "i2c";
const layout = layouts[layoutId];

if (!layout) {
    const available = Object.keys(layouts).join(", ");
    throw new Error(`Unknown AP6_SMJOIN_LAYOUT "${layoutId}". Available: ${available}`);
}

module.exports = layout;
