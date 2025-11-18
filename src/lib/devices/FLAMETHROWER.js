import { DeviceType } from './DeviceType.js';

/**
 * Flamethrower Device Type
 * Safety channel + Fuel control
 */
export class FlamethrowerDeviceType extends DeviceType {
    constructor() {
        super(
            'Flamethrower',
            2,
            [
                { name: 'Safety', channel: 0 },
                { name: 'Fuel', channel: 1 }
            ],
            [
                {
                    name: 'Safety',
                    type: 'toggle',
                    offValue: 0,
                    onValue: 125,
                    components: { value: 0 }
                },
                {
                    name: 'Fuel',
                    type: 'slider',
                    color: '#ff5722',
                    components: { value: 1 }
                }
            ]
        );
    }
}

export const FLAMETHROWER = new FlamethrowerDeviceType();
