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
            id: 'dimmer',
            name: 'Dimmer',
            channels: 1,
            defaultValues: [255],  // Full brightness by default
            controls: [
                {
                    id: 'dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 0
                }
            ]
        });
    }
}
