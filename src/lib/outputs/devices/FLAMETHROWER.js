import { DeviceType } from './DeviceType.js';
import { SliderControl, ToggleControl } from '../controls/index.js';

/**
 * Flamethrower Device Type
 * Safety channel + Fuel control
 *
 * Channels:
 * 0: Safety
 * 1: Fuel
 */
export class FlamethrowerDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'FLAMETHROWER',
            name: 'Flamethrower',
            channels: 2,
            defaultValues: [0, 0],
            controls: [
                {
                    name: 'Safety',
                    type: new ToggleControl('safety', 'Safety', 0, 255),
                    startChannel: 0
                },
                {
                    name: 'Fuel',
                    type: new SliderControl('fuel', 'Fuel'),
                    startChannel: 1,
                    color: '#ff5722'
                }
            ]
        });
    }
}

export const FLAMETHROWER = new FlamethrowerDeviceType();
