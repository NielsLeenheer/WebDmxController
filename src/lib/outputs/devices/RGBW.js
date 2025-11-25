import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * RGBW Light Device Type
 * 4-channel RGB + White fixture
 *
 * Channels:
 * 0: Red
 * 1: Green
 * 2: Blue
 * 3: White
 */
export class RGBWDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'RGBW',
            name: 'RGBW Light',
            channels: 4,
            defaultValues: [0, 0, 0, 0],
            controls: [
                {
                    name: 'Color',
                    type: CONTROL_TYPES.RGB,
                    startChannel: 0
                },
                {
                    name: 'White',
                    type: CONTROL_TYPES.White,
                    startChannel: 3
                }
            ]
        });
    }
}

export const RGBW = new RGBWDeviceType();
