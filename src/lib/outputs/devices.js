/**
 * Device Type Registry
 *
 * Central registry of all device type definitions.
 *
 * NEW ARCHITECTURE:
 * - Device types are singleton class instances
 * - Registry provides lookup by string ID
 * - Device instances (in libraries) store type as string ID
 * - Use DEVICE_TYPES[device.type] to get the device type definition
 */
import { RGB } from './devices/RGB.js';
import { RGBA } from './devices/RGBA.js';
import { RGBW } from './devices/RGBW.js';
import { DIMMER } from './devices/DIMMER.js';
import { SMOKE } from './devices/SMOKE.js';
import { MOVING_HEAD } from './devices/MOVING_HEAD.js';
import { MOVING_HEAD_11CH } from './devices/MOVING_HEAD_11CH.js';
import { FLAMETHROWER } from './devices/FLAMETHROWER.js';

/**
 * Device Type Registry
 * Singleton instances keyed by string ID
 *
 * Example usage:
 *   const device = { type: "RGB", ... }
 *   const deviceType = DEVICE_TYPES[device.type]
 *   const dmx = controlValuesToDMX(deviceType, device.defaultValues)
 */
export const DEVICE_TYPES = {
    RGB,         // deviceType.id === 'RGB'
    RGBA,        // deviceType.id === 'RGBA'
    RGBW,        // deviceType.id === 'RGBW'
    DIMMER,      // deviceType.id === 'DIMMER'
    SMOKE,       // deviceType.id === 'SMOKE'
    MOVING_HEAD, // deviceType.id === 'MOVING_HEAD'
    MOVING_HEAD_11CH,  // deviceType.id === 'MOVING_HEAD_11CH'
    FLAMETHROWER // deviceType.id === 'FLAMETHROWER'
};

/**
 * Get preview data for a device based on its type and control values
 * Generic function that works with any device type by examining its controls
 *
 * NEW: Accepts control values object instead of DMX array
 *
 * @param {string} deviceType - The device type key (e.g., 'RGB', 'FLAMETHROWER')
 * @param {Object} controlValues - Control values object { "Color": { r, g, b }, "Dimmer": 255, ... }
 * @returns {Object} Preview data with controls array and data object
 */
export function getDevicePreviewData(deviceType, controlValues) {
    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        return { controls: [], data: {} };
    }

    const controls = [];
    const data = {};

    // Process each control in the device type
    for (const control of deviceTypeDef.controls) {
        const value = controlValues[control.name];
        if (value === undefined) continue;

        const controlTypeId = control.type.type;  // e.g., 'rgb', 'slider', 'xypad'

        if (controlTypeId === 'rgb' || controlTypeId === 'rgba') {
            // RGB/RGBA control - extract color
            controls.push('color');
            const r = value.r ?? 0;
            const g = value.g ?? 0;
            const b = value.b ?? 0;
            data.color = `rgb(${r}, ${g}, ${b})`;
        } else if (controlTypeId === 'slider') {
            // Slider control - extract value
            const controlKey = control.name.toLowerCase();
            controls.push(controlKey);
            data[controlKey] = value ?? 0;
        } else if (controlTypeId === 'xypad') {
            // XY Pad control (Pan/Tilt) - extract pan and tilt values
            controls.push('pantilt');
            data.pan = value.x ?? 128;
            data.tilt = value.y ?? 128;
        }
    }

    return { controls, data };
}

/**
 * Convert named channels object to device channel array
 * DEPRECATED: Use controlValuesToDMX from converter.js instead
 *
 * This function is kept for backward compatibility with CSS sampling,
 * but should not be used in new code.
 */
export function convertChannelsToArray(deviceType, channels) {
    // NOTE: This function returns default values as a fallback
    // CSS sampling path (App.svelte) still uses channel-based approach
    // Full conversion to control values deferred (see IMPLEMENTATION_STATUS.md)

    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        console.warn(`Unknown device type: ${deviceType}`);
        return [];
    }

    // Return default DMX array as fallback
    return deviceTypeDef.getDefaultValues();
}

/**
 * Get preview data for trigger control values
 * Only includes enabled controls (those present in triggerValues)
 *
 * NEW: Accepts control values object instead of channelValues/enabledControls
 *
 * @param {string} deviceType - The device type key (e.g., 'RGB', 'FLAMETHROWER')
 * @param {Object} triggerValues - Control values object { "Color": { r, g, b }, ... }
 * @returns {Object} Preview data with controls array and data object
 */
export function getTriggerValuesPreviewData(deviceType, triggerValues) {
    // With the new architecture, this is the same as getDevicePreviewData
    // since enabled controls are implicitly those present in the object
    return getDevicePreviewData(deviceType, triggerValues);
}

/**
 * Get color preview for a device based on its type and control values
 * This is used for generating CSS color property from device values
 * Returns pure RGB color - all special effects (white/amber/intensity layers, smoke, fire, etc.)
 * are handled by the Preview component as separate control layers
 *
 * NEW: Accepts control values object instead of DMX array
 *
 * @param {string} deviceType - The type of device (RGB, RGBA, RGBW, etc.)
 * @param {Object} controlValues - Control values object { "Color": { r, g, b }, ... }
 * @returns {string} CSS color string (RGB only, or transparent if no RGB control)
 */
export function getDeviceColor(deviceType, controlValues) {
    if (!controlValues || typeof controlValues !== 'object') {
        return 'transparent';
    }

    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        return 'transparent';
    }

    // Find Color control (RGB or RGBA type)
    const colorControl = deviceTypeDef.controls?.find(
        c => c.type.type === 'rgb' || c.type.type === 'rgba'
    );

    if (colorControl) {
        const colorValue = controlValues[colorControl.name];
        if (colorValue && typeof colorValue === 'object') {
            const r = colorValue.r ?? 0;
            const g = colorValue.g ?? 0;
            const b = colorValue.b ?? 0;
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    // No RGB/RGBA control - return transparent
    // (dimmer/intensity, smoke, flamethrower, etc. are handled by Preview component layers)
    return 'transparent';
}
