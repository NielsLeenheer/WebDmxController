import { DEVICE_TYPES } from './devices.js';

// Define semantic channel names for each device type
const CHANNEL_SEMANTICS = {
    RGB: {
        0: 'Red',
        1: 'Green',
        2: 'Blue'
    },
    RGBA: {
        0: 'Red',
        1: 'Green',
        2: 'Blue',
        3: 'Amber'
    },
    RGBW: {
        0: 'Red',
        1: 'Green',
        2: 'Blue',
        3: 'White'
    },
    DIMMER: {
        0: 'Dimmer'
    },
    SMOKE: {
        0: 'Output'
    },
    MOVING_HEAD: {
        0: 'Pan',
        1: 'Tilt',
        2: 'Dimmer',
        3: 'Red',
        4: 'Green',
        5: 'Blue',
        6: 'White'
    }
};

/**
 * Get channel mapping from source device type to target device type
 * Returns a map of source channel index → target channel index
 */
export function getChannelMapping(sourceType, targetType) {
    const sourceSemantics = CHANNEL_SEMANTICS[sourceType];
    const targetSemantics = CHANNEL_SEMANTICS[targetType];

    if (!sourceSemantics || !targetSemantics) {
        return {};
    }

    const mapping = {};

    // Find common channels by semantic name
    for (const [sourceIndex, semanticName] of Object.entries(sourceSemantics)) {
        // Find matching semantic in target
        for (const [targetIndex, targetSemantic] of Object.entries(targetSemantics)) {
            if (semanticName === targetSemantic) {
                mapping[parseInt(sourceIndex)] = parseInt(targetIndex);
                break;
            }
        }
    }

    return mapping;
}

/**
 * Check if two devices can be linked (have at least one common channel)
 */
export function canLinkDevices(sourceType, targetType) {
    const mapping = getChannelMapping(sourceType, targetType);
    return Object.keys(mapping).length > 0;
}

/**
 * Apply source device values to target device using channel mapping
 * Returns new array of target values with mapped channels updated
 */
export function applyLinkedValues(sourceType, targetType, sourceValues, targetValues) {
    const mapping = getChannelMapping(sourceType, targetType);
    const newValues = [...targetValues];

    for (const [sourceIndex, targetIndex] of Object.entries(mapping)) {
        newValues[targetIndex] = sourceValues[sourceIndex];
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
