import { DEVICE_TYPES } from './devices.js';

/**
 * Get color preview for a device based on its type and values
 * This is used for generating CSS color property from device values
 * Returns pure RGB color - all special effects (white/amber/intensity layers, smoke, fire, etc.) 
 * are handled by the Preview component as separate control layers
 * 
 * @param {string} deviceType - The type of device (RGB, RGBA, RGBW, etc.)
 * @param {Array<number>} values - Array of channel values (0-255)
 * @returns {string} CSS color string (RGB only, or transparent if no RGB control)
 */
export function getDeviceColor(deviceType, values) {
    if (!values || values.length === 0) {
        return 'transparent';
    }

    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        return 'transparent';
    }

    // Find RGB control and extract R, G, B component indices
    const rgbControl = deviceTypeDef.controls?.find(c => c.type === 'rgb');
    if (rgbControl) {
        const r = values[rgbControl.components.r] ?? 0;
        const g = values[rgbControl.components.g] ?? 0;
        const b = values[rgbControl.components.b] ?? 0;
        return `rgb(${r}, ${g}, ${b})`;
    }

    // No RGB control - return transparent
    // (dimmer/intensity, smoke, flamethrower, etc. are handled by Preview component layers)
    return 'transparent';
}
