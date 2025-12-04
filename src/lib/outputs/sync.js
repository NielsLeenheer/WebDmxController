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
 * Returns a map of source control id → target control id for compatible controls
 *
 * NEW: Simplified - just checks if control ids match
 * (controls with same id are assumed compatible)
 */
function getControlMapping(sourceType, targetType) {
    const sourceDeviceType = DEVICE_TYPES[sourceType];
    const targetDeviceType = DEVICE_TYPES[targetType];

    if (!sourceDeviceType || !targetDeviceType) {
        return {};
    }

    const sourceControlIds = sourceDeviceType.getControlIds();
    const targetControlIds = new Set(targetDeviceType.getControlIds());
    const mapping = {};

    // Find common controls by id
    for (const controlId of sourceControlIds) {
        if (targetControlIds.has(controlId)) {
            mapping[controlId] = controlId;  // Same id on both sides
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
 * Get array of control ids that are synced between two devices
 *
 * NEW: Returns control ids instead of channel indices
 *
 * @param {string} sourceType - Source device type
 * @param {string} targetType - Target device type
 * @param {Array<string>|null} syncedControls - Array of control ids that are synced, or null for all
 * @returns {Array<string>} Array of control ids that are synced
 */
export function getMappedControls(sourceType, targetType, syncedControls = null) {
    const mapping = getControlMapping(sourceType, targetType);

    // If syncedControls is specified, filter the mapping
    if (syncedControls !== null) {
        return Object.keys(mapping).filter(id => syncedControls.includes(id));
    }

    // Otherwise, return all mapped control ids
    return Object.keys(mapping);
}


/**
 * Get available controls that can be synced between two device types
 * Returns array of { controlId, sourceControl, targetControl } objects
 */
export function getAvailableSyncControls(sourceType, targetType) {
    const mapping = getControlMapping(sourceType, targetType);
    const sourceDeviceType = DEVICE_TYPES[sourceType];
    const targetDeviceType = DEVICE_TYPES[targetType];
    const result = [];

    for (const controlId of Object.keys(mapping)) {
        const sourceControl = sourceDeviceType.getControl(controlId);
        const targetControl = targetDeviceType.getControl(controlId);

        if (sourceControl && targetControl) {
            result.push({
                controlId,
                sourceControl,
                targetControl
            });
        }
    }

    return result;
}
