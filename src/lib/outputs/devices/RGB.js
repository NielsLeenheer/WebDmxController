import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * RGB Light Device Type
 * Standard 3-channel RGB fixture
 *
 * Channels:
 * 0: Red
 * 1: Green
 * 2: Blue
 */
export class RGBDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'RGB',
            name: 'RGB Light',
            channels: 3,
            defaultValues: [0, 0, 0],
            controls: [
                {
                    name: 'Color',
                    type: CONTROL_TYPES.RGB,
                    startChannel: 0
                }
            ]
        });
    }
}

export const RGB = new RGBDeviceType();
