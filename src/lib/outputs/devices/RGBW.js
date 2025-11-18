import { DeviceType } from './DeviceType.js';

/**
 * RGBW Light Device Type
 * 4-channel RGB + White fixture
 */
export class RGBWDeviceType extends DeviceType {
    constructor() {
        super(
            'RGBW Light',
            4,
            [
                { name: 'Red', channel: 0 },
                { name: 'Green', channel: 1 },
                { name: 'Blue', channel: 2 },
                { name: 'White', channel: 3 }
            ],
            [
                {
                    name: 'Color',
                    type: 'rgb',
                    components: { r: 0, g: 1, b: 2 }
                },
                {
                    name: 'White',
                    type: 'slider',
                    color: '#808080',
                    components: { value: 3 }
                }
            ]
        );
    }
}

export const RGBW = new RGBWDeviceType();
