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
export { DEVICE_TYPES } from './devices/index.js';
import { DEVICE_TYPES } from './devices/index.js';

/**
 * Get preview data for a device based on its type and control values
 * Generic function that works with any device type by examining its controls
 *
 * NEW: Accepts control values object instead of DMX array
 *
 * @param {string} deviceType - The device type key (e.g., 'rgb', 'flamethrower')
 * @param {Object} controlValues - Control values object { "color": { red, green, blue }, "dimmer": 255, ... }
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
        const value = controlValues[control.id];  // Use device control id
        if (value === undefined) continue;

        const controlTypeId = control.type.type;  // e.g., 'rgb', 'slider', 'xypad'

        if (controlTypeId === 'rgb') {
            // RGB/RGBA control - pass through the color object
            controls.push('color');
            data.color = value;  // Keep as { red, green, blue } object
        } else if (controlTypeId === 'slider' || controlTypeId === 'toggle') {
            // Slider/Toggle control - extract value
            const controlKey = control.id;  // Use device control id
            controls.push(controlKey);
            data[controlKey] = value ?? (controlTypeId === 'toggle' ? control.type.offValue : 0);
        } else if (controlTypeId === 'xypad' || controlTypeId === 'xypad16') {
            // XY Pad control (Pan/Tilt) - keep as pantilt object
            controls.push('pantilt');
            data.pantilt = value;  // Keep as { pan, tilt } object
        }
    }

    return { controls, data };
}


/**
 * Get preview data for trigger control values
 * Only includes enabled controls (those present in triggerValues)
 *
 * NEW: Accepts control values object instead of channelValues/enabledControls
 *
 * @param {string} deviceType - The device type key (e.g., 'rgb', 'flamethrower')
 * @param {Object} triggerValues - Control values object { "Color": { r, g, b }, ... }
 * @returns {Object} Preview data with controls array and data object
 */
export function getTriggerValuesPreviewData(deviceType, triggerValues) {
    // With the new architecture, this is the same as getDevicePreviewData
    // since enabled controls are implicitly those present in the object
    return getDevicePreviewData(deviceType, triggerValues);
}
