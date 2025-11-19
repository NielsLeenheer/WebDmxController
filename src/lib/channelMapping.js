import { DEVICE_TYPES } from './outputs/devices.js';

/**
 * Get control mapping from source device type to target device type
 * Returns a map of source control name → target control name for compatible controls
 */
export function getControlMapping(sourceType, targetType) {
    const sourceControls = DEVICE_TYPES[sourceType]?.controls;
    const targetControls = DEVICE_TYPES[targetType]?.controls;

    if (!sourceControls || !targetControls) {
        return {};
    }

    const mapping = {};

    // Find common controls by name and type
    for (const sourceControl of sourceControls) {
        for (const targetControl of targetControls) {
            if (sourceControl.name === targetControl.name && sourceControl.type === targetControl.type) {
                mapping[sourceControl.name] = targetControl.name;
                break;
            }
        }
    }

    return mapping;
}

/**
 * Check if two devices can be linked (have at least one common control)
 */
export function canLinkDevices(sourceType, targetType) {
    const mapping = getControlMapping(sourceType, targetType);
    return Object.keys(mapping).length > 0;
}

/**
 * Get channels affected by a control
 * Returns array of channel indices that this control manages
 */
function getControlChannels(deviceType, controlName) {
    const deviceDef = DEVICE_TYPES[deviceType];
    const control = deviceDef.controls.find(c => c.name === controlName);

    if (!control) return [];

    const channels = [];

    // Get all component indices from the control
    for (const componentIndex of Object.values(control.components)) {
        const channel = deviceDef.components[componentIndex].channel;
        channels.push(channel);
    }

    return channels;
}

/**
 * Apply source device values to target device using control mapping
 * Returns new array of target values with mapped control values updated
 *
 * @param {string} sourceType - Source device type
 * @param {string} targetType - Target device type
 * @param {Array} sourceValues - Source device channel values
 * @param {Array} targetValues - Target device channel values
 * @param {Array|null} syncedControls - Array of control names to sync, or null for all
 * @param {boolean} mirrorPan - Whether to mirror pan values (invert)
 */
export function applyLinkedValues(sourceType, targetType, sourceValues, targetValues, syncedControls = null, mirrorPan = false) {
    const mapping = getControlMapping(sourceType, targetType);
    const newValues = [...targetValues];

    // For each mapped control
    for (const [sourceControlName, targetControlName] of Object.entries(mapping)) {
        // If syncedControls is specified, only sync those controls
        if (syncedControls !== null && !syncedControls.includes(sourceControlName)) {
            continue;
        }

        // Get channels for source and target controls
        const sourceChannels = getControlChannels(sourceType, sourceControlName);
        const targetChannels = getControlChannels(targetType, targetControlName);

        // Copy values from source channels to target channels
        for (let i = 0; i < Math.min(sourceChannels.length, targetChannels.length); i++) {
            let value = sourceValues[sourceChannels[i]];

            // Mirror pan if enabled and this is Pan/Tilt control's x-axis (pan)
            if (mirrorPan && sourceControlName === 'Pan/Tilt' && i === 0) {
                value = 255 - value;
            }

            newValues[targetChannels[i]] = value;
        }
    }

    return newValues;
}

/**
 * Get list of devices that can be linked to the given device type
 */
export function getLinkableDeviceTypes(deviceType) {
    return Object.keys(DEVICE_TYPES).filter(type =>
        type !== deviceType && canLinkDevices(deviceType, type)
    );
}

/**
 * Get array of target channel indices that are controlled by synced controls (disabled when linked)
 *
 * @param {string} sourceType - Source device type
 * @param {string} targetType - Target device type
 * @param {Array|null} syncedControls - Array of control names that are synced, or null for all
 */
export function getMappedChannels(sourceType, targetType, syncedControls = null) {
    const mapping = getControlMapping(sourceType, targetType);
    const disabledChannels = [];

    // For each mapped control
    for (const [sourceControlName, targetControlName] of Object.entries(mapping)) {
        // If syncedControls is specified, only include channels for those controls
        if (syncedControls !== null && !syncedControls.includes(sourceControlName)) {
            continue;
        }

        // Get channels for the target control and add to disabled list
        const targetChannels = getControlChannels(targetType, targetControlName);
        disabledChannels.push(...targetChannels);
    }

    return disabledChannels;
}

/**
 * Get available controls that can be synced between two device types
 * Returns array of { controlName, sourceControl, targetControl } objects
 */
export function getAvailableSyncControls(sourceType, targetType) {
    const mapping = getControlMapping(sourceType, targetType);
    const sourceControls = DEVICE_TYPES[sourceType].controls;
    const targetControls = DEVICE_TYPES[targetType].controls;
    const result = [];

    for (const [sourceControlName, targetControlName] of Object.entries(mapping)) {
        const sourceControl = sourceControls.find(c => c.name === sourceControlName);
        const targetControl = targetControls.find(c => c.name === targetControlName);

        result.push({
            controlName: sourceControlName,
            sourceControl,
            targetControl
        });
    }

    return result;
}
