// UI colors - softer, more pleasant for on-screen display
const UI_COLOR_MAP = {
    'red': '#ff4d4f',
    'orange': '#fa8c16',
    'yellow': '#fadb14',
    'lime': '#a0d911',
    'green': '#52c41a',
    'spring': '#36cfc9',
    'turquoise': '#13c2c2',
    'cyan': '#0894ff',
    'sky': '#40a9ff',
    'blue': '#2f54eb',
    'violet': '#722ed1',
    'purple': '#531dab',
    'magenta': '#eb2f96',
    'pink': '#ff85c0'
};

// Device colors - harsh, saturated colors for hardware LEDs
const DEVICE_COLOR_MAP = {
    'red': '#ff0000',
    'orange': '#ff6600',
    'yellow': '#ffcc00',
    'lime': '#80ff00',
    'green': '#00ff00',
    'spring': '#00ff80',
    'turquoise': '#00ffff',
    'cyan': '#00bfff',
    'sky': '#0080ff',
    'blue': '#0000ff',
    'violet': '#8000ff',
    'purple': '#4000ff',
    'magenta': '#ff00ff',
    'pink': '#ff0080'
};

export function paletteColorToHex(color) {
    return UI_COLOR_MAP[color] || 'transparent';
}

/**
 * Get RGB color values from a named color (device colors - saturated for hardware LEDs)
 * @param {string} color - Color name from the palette
 * @returns {{r: number, g: number, b: number}} RGB object (0-255 per channel), or {r:0, g:0, b:0} if color not found
 */
export function paletteColorToDeviceRGB(color) {
    const hexColor = DEVICE_COLOR_MAP[color];
    
    if (!hexColor) {
        return { r: 0, g: 0, b: 0 };
    }

    // Parse hex color (#RRGGBB)
    const hex = hexColor.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

/**
 * Get the color palette array
 * @returns {string[]} Array of color names
 */
export function getPalette() {
    return Object.keys(UI_COLOR_MAP);
}

/**
 * Find the index of the slot whose color is closest to the given RGB.
 * Used by wheel-style controls to snap a CSS rgb(...) input to a fixed palette.
 *
 * @param {{r:number, g:number, b:number}} rgb - Input RGB (0-255)
 * @param {Array<{colors?: string[]}>} slots - Slots with optional `colors` hex array; the first color is used for distance
 * @returns {number} Index of the nearest slot, or 0 if none have colors
 */
export function nearestPaletteColorIndex(rgb, slots) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < slots.length; i++) {
        const hex = slots[i]?.colors?.[0];
        if (!hex) continue;

        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);

        const dr = r - rgb.r;
        const dg = g - rgb.g;
        const db = b - rgb.b;
        const distance = dr * dr + dg * dg + db * db;

        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
        }
    }

    return bestIndex;
}

/**
 * Get the next unused color from the palette
 * @param {string[]} usedColors - Array of already used color names (normalized to lowercase)
 * @returns {string|undefined} Next unused color, or undefined if palette is empty
 */
export function getUnusedFromPalette(usedColors) {
    const palette = Object.keys(UI_COLOR_MAP);
    if (!palette.length) return undefined;

    // If no colors are used, return the first one
    if (!usedColors || usedColors.length === 0) {
        return palette[0];
    }

    // Normalize used colors to lowercase for comparison
    const usedSet = new Set(usedColors.map(c => c.toLowerCase()));

    // Find first unused color
    for (const color of palette) {
        if (!usedSet.has(color)) {
            return color;
        }
    }

    // All colors are used, return undefined (caller can handle cycling)
    return undefined;
}
