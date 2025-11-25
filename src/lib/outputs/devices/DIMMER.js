import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Dimmer Device Type
 * Single channel intensity control
 *
 * Channels:
 * 0: Intensity
 */
export class DimmerDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'DIMMER',
            name: 'Dimmer',
            channels: 1,
            defaultValues: [255],  // Full brightness by default
            controls: [
                {
                    name: 'Dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 0
                }
            ]
        });
    }
}

export const DIMMER = new DimmerDeviceType();
