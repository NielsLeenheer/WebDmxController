/**
 * Device Type Definitions
 * 
 * Import all device type profiles from the devices directory
 */
import { RGB } from './devices/RGB.js';
import { RGBA } from './devices/RGBA.js';
import { RGBW } from './devices/RGBW.js';
import { DIMMER } from './devices/DIMMER.js';
import { SMOKE } from './devices/SMOKE.js';
import { MOVING_HEAD } from './devices/MOVING_HEAD.js';
import { MOVING_HEAD_11CH } from './devices/MOVING_HEAD_11CH.js';
import { FLAMETHROWER } from './devices/FLAMETHROWER.js';

// Export device types for backward compatibility
export const DEVICE_TYPES = {
    RGB,
    RGBA,
    RGBW,
    DIMMER,
    SMOKE,
    MOVING_HEAD,
    MOVING_HEAD_11CH,
    FLAMETHROWER
};

/**
 * Get preview data for a device based on its type and values
 * Generic function that works with any device type by examining its controls
 * 
 * @param {string} deviceType - The device type key (e.g., 'RGB', 'FLAMETHROWER')
 * @param {Array<number>} values - Array of channel values
 * @returns {Object} Preview data with controls array and data object
 */
export function getDevicePreviewData(deviceType, values) {
    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        return { controls: [], data: {} };
    }

    const controls = [];
    const data = {};

    // Process each control in the device type
    for (const control of deviceTypeDef.controls) {
        if (control.type === 'rgb') {
            // RGB control - extract color
            controls.push('color');
            const r = values[control.components.r] ?? 0;
            const g = values[control.components.g] ?? 0;
            const b = values[control.components.b] ?? 0;
            data.color = `rgb(${r}, ${g}, ${b})`;
        } else if (control.type === 'slider' || control.type === 'toggle') {
            // Slider/Toggle control - extract value
            const componentIndex = Object.values(control.components)[0];
            const channel = deviceTypeDef.components[componentIndex].channel;
            const controlKey = control.name.toLowerCase();
            controls.push(controlKey);
            data[controlKey] = values[channel] ?? 0;
        } else if (control.type === 'xypad') {
            // XY Pad control (Pan/Tilt) - extract pan and tilt values
            controls.push('pantilt');
            const panChannel = deviceTypeDef.components[control.components.x].channel;
            const tiltChannel = deviceTypeDef.components[control.components.y].channel;
            data.pan = values[panChannel] ?? 0;
            data.tilt = values[tiltChannel] ?? 0;
        }
    }

    return { controls, data };
}

/**
 * Convert named channels object to device channel array
 * Maps channel names to the correct array indices for a device type
 * 
 * @param {string} deviceType - The device type key (e.g., 'RGB', 'FLAMETHROWER')
 * @param {Object} channels - Object with channel names as keys and values
 * @returns {Array<number>} Array of channel values in correct order
 */
export function convertChannelsToArray(deviceType, channels) {
    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        console.warn(`Unknown device type: ${deviceType}`);
        return [];
    }

    // Create array with default values
    const result = deviceTypeDef.getDefaultValues();

    // Map named channels to array indices
    for (const component of deviceTypeDef.components) {
        if (channels[component.name] !== undefined) {
            result[component.channel] = channels[component.name];
        }
    }

    return result;
}

/**
 * Get preview data for trigger values
 * Only includes enabled controls from the trigger
 * 
 * @param {string} deviceType - The device type key (e.g., 'RGB', 'FLAMETHROWER')
 * @param {Object} triggerValues - Trigger values object with channelValues and enabledControls
 * @returns {Object} Preview data with controls array and data object
 */
export function getTriggerValuesPreviewData(deviceType, triggerValues) {
    const deviceTypeDef = DEVICE_TYPES[deviceType];
    if (!deviceTypeDef) {
        return { controls: [], data: {} };
    }

    if (!triggerValues || !triggerValues.channelValues || !triggerValues.enabledControls) {
        return { controls: [], data: {} };
    }

    const enabledControls = triggerValues.enabledControls;
    const channelValues = triggerValues.channelValues;
    
    // Create array filled with zeros, then populate with channel values
    const values = new Array(deviceTypeDef.channels).fill(0);
    for (const [channelIndex, value] of Object.entries(channelValues)) {
        const idx = parseInt(channelIndex);
        if (idx >= 0 && idx < values.length) {
            values[idx] = value;
        }
    }

    const controls = [];
    const data = {};

    // Process each control in the device type
    for (const control of deviceTypeDef.controls) {
        // Only include controls that are enabled in the trigger
        if (!enabledControls.includes(control.name)) {
            continue;
        }

        if (control.type === 'rgb') {
            // RGB control - extract color
            controls.push('color');
            const r = values[control.components.r] ?? 0;
            const g = values[control.components.g] ?? 0;
            const b = values[control.components.b] ?? 0;
            data.color = `rgb(${r}, ${g}, ${b})`;
        } else if (control.type === 'slider' || control.type === 'toggle') {
            // Slider/Toggle control - extract value
            const componentIndex = Object.values(control.components)[0];
            const channel = deviceTypeDef.components[componentIndex].channel;
            const controlKey = control.name.toLowerCase();
            controls.push(controlKey);
            data[controlKey] = values[channel] ?? 0;
        } else if (control.type === 'xypad') {
            // XY Pad control (Pan/Tilt) - extract pan and tilt values
            controls.push('pantilt');
            const panChannel = deviceTypeDef.components[control.components.x].channel;
            const tiltChannel = deviceTypeDef.components[control.components.y].channel;
            data.pan = values[panChannel] ?? 0;
            data.tilt = values[tiltChannel] ?? 0;
        }
    }

    return { controls, data };
}

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
