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

export function paletteColorToDeviceHex(color) {
    return DEVICE_COLOR_MAP[color] || '#000000';
}

/**
 * Get RGB color values from a named color (UI colors)
 * @param {string} color - Color name from the palette
 * @returns {{r: number, g: number, b: number}} RGB object (0-255 per channel), or {r:0, g:0, b:0} if color not found
 */
export function paletteColorToRGB(color) {
    const hexColor = UI_COLOR_MAP[color];
    
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
