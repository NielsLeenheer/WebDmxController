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

export class Device {
    constructor(id, type, startChannel, name = '', linkedTo = null, cssId = null, syncedControls = null, mirrorPan = false) {
        this.id = id;
        this.type = type;
        this.startChannel = startChannel;
        this.name = name || `${DEVICE_TYPES[type].name} ${id}`;

        // Get default values from device type profile
        this.defaultValues = DEVICE_TYPES[type].getDefaultValues();

        this.linkedTo = linkedTo; // ID of device to follow, or null
        this.syncedControls = syncedControls; // Array of control names to sync, or null for all
        this.mirrorPan = mirrorPan; // Whether to mirror pan values for linked devices
        this.cssId = cssId || this.generateCssId(this.name);
    }

    /**
     * Generate CSS-safe ID from device name
     */
    generateCssId(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/_+/g, '_')          // Collapse multiple underscores
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
    }

    /**
     * Update CSS ID when name changes
     */
    updateCssId() {
        this.cssId = this.generateCssId(this.name);
    }

    setValue(controlIndex, value) {
        this.defaultValues[controlIndex] = Math.max(0, Math.min(255, value));
    }

    getValue(controlIndex) {
        return this.defaultValues[controlIndex];
    }

    getChannelValues() {
        return this.defaultValues;
    }

    isLinked() {
        return this.linkedTo !== null;
    }
}

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

    // Special case: Flamethrower needs fuel layer before safety layer
    // so that safety appears on top in the DOM
    if (deviceType === 'FLAMETHROWER') {
        const safetyIndex = controls.indexOf('safety');
        const fuelIndex = controls.indexOf('fuel');
        if (safetyIndex !== -1 && fuelIndex !== -1 && safetyIndex < fuelIndex) {
            // Swap them so fuel comes first
            controls[safetyIndex] = 'fuel';
            controls[fuelIndex] = 'safety';
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

