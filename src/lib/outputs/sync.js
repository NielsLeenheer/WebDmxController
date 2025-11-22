/**
 * Device Linking Utilities
 *
 * NEW ARCHITECTURE:
 * - Simplified control-based linking
 * - No more channel-level mapping
 * - Direct control value copying by name
 */

import { DEVICE_TYPES } from './devices.js';

/**
 * Get control mapping from source device type to target device type
 * Returns a map of source control name → target control name for compatible controls
 *
 * NEW: Simplified - just checks if control names match
 * (controls with same name are assumed compatible)
 */
export function getControlMapping(sourceType, targetType) {
    const sourceDeviceType = DEVICE_TYPES[sourceType];
    const targetDeviceType = DEVICE_TYPES[targetType];

    if (!sourceDeviceType || !targetDeviceType) {
        return {};
    }

    const sourceControlNames = sourceDeviceType.getControlNames();
    const targetControlNames = new Set(targetDeviceType.getControlNames());
    const mapping = {};

    // Find common controls by name
    for (const controlName of sourceControlNames) {
        if (targetControlNames.has(controlName)) {
            mapping[controlName] = controlName;  // Same name on both sides
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
 * Apply source device values to target device using control mapping
 * DEPRECATED: This function is no longer used with control-based values
 * Device linking is now handled directly in DeviceLibrary.propagateToLinkedDevices()
 *
 * This is kept for backward compatibility but should not be used in new code.
 */
export function applyLinkedValues(sourceType, targetType, sourceValues, targetValues, syncedControls = null, mirrorPan = false) {
    console.warn('applyLinkedValues() is deprecated. Use DeviceLibrary.propagateToLinkedDevices() instead.');
    return targetValues;
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
 * Get array of control names that are synced between two devices
 *
 * NEW: Returns control names instead of channel indices
 *
 * @param {string} sourceType - Source device type
 * @param {string} targetType - Target device type
 * @param {Array<string>|null} syncedControls - Array of control names that are synced, or null for all
 * @returns {Array<string>} Array of control names that are synced
 */
export function getMappedControls(sourceType, targetType, syncedControls = null) {
    const mapping = getControlMapping(sourceType, targetType);

    // If syncedControls is specified, filter the mapping
    if (syncedControls !== null) {
        return Object.keys(mapping).filter(name => syncedControls.includes(name));
    }

    // Otherwise, return all mapped control names
    return Object.keys(mapping);
}

/**
 * Get array of target channel indices that are controlled by synced controls
 * DEPRECATED: Use getMappedControls() instead
 */
export function getMappedChannels(sourceType, targetType, syncedControls = null) {
    console.warn('getMappedChannels() is deprecated. Use getMappedControls() instead.');
    return [];
}

/**
 * Get available controls that can be synced between two device types
 * Returns array of { controlName, sourceControl, targetControl } objects
 */
export function getAvailableSyncControls(sourceType, targetType) {
    const mapping = getControlMapping(sourceType, targetType);
    const sourceDeviceType = DEVICE_TYPES[sourceType];
    const targetDeviceType = DEVICE_TYPES[targetType];
    const result = [];

    for (const controlName of Object.keys(mapping)) {
        const sourceControl = sourceDeviceType.getControl(controlName);
        const targetControl = targetDeviceType.getControl(controlName);

        if (sourceControl && targetControl) {
            result.push({
                controlName,
                sourceControl,
                targetControl
            });
        }
    }

    return result;
}
