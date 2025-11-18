import { DeviceType } from './DeviceType.js';

/**
 * RGB Light Device Type
 * Standard 3-channel RGB fixture
 */
export class RGBDeviceType extends DeviceType {
    constructor() {
        super(
            'RGB Light',
            3,
            [
                { name: 'Red', channel: 0 },
                { name: 'Green', channel: 1 },
                { name: 'Blue', channel: 2 }
            ],
            [
                {
                    name: 'Color',
                    type: 'rgb',
                    components: { r: 0, g: 1, b: 2 }
                }
            ]
        );
    }
}

export const RGB = new RGBDeviceType();
