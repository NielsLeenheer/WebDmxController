import { DeviceType } from './DeviceType.js';

/**
 * RGBA Light Device Type
 * 4-channel RGB + Amber fixture
 */
export class RGBADeviceType extends DeviceType {
    constructor() {
        super(
            'RGBA Light',
            4,
            [
                { name: 'Red', channel: 0 },
                { name: 'Green', channel: 1 },
                { name: 'Blue', channel: 2 },
                { name: 'Amber', channel: 3 }
            ],
            [
                {
                    name: 'Color',
                    type: 'rgb',
                    components: { r: 0, g: 1, b: 2 }
                },
                {
                    name: 'Amber',
                    type: 'slider',
                    color: '#ffbf00',
                    components: { value: 3 }
                }
            ]
        );
    }
}

export const RGBA = new RGBADeviceType();
