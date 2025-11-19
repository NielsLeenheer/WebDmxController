const NAMED_INPUT_COLOR_MAP = {
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

export function paletteColorToHex(color) {
    return NAMED_INPUT_COLOR_MAP[color] || 'transparent';
}

/**
 * Get RGB color values from a named color
 * @param {string} color - Color name from the palette
 * @returns {{r: number, g: number, b: number}} RGB object (0-255 per channel), or {r:0, g:0, b:0} if color not found
 */
export function paletteColorToRGB(color) {
    const hexColor = NAMED_INPUT_COLOR_MAP[color];
    
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
    return Object.keys(NAMED_INPUT_COLOR_MAP);
}

/**
 * Get the next unused color from the palette
 * @param {string[]} usedColors - Array of already used color names (normalized to lowercase)
 * @returns {string|undefined} Next unused color, or undefined if palette is empty
 */
export function getUnusedFromPalette(usedColors) {
    const palette = Object.keys(NAMED_INPUT_COLOR_MAP);
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
