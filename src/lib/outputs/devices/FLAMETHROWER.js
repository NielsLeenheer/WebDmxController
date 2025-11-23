import { DeviceType } from './DeviceType.js';
import { SliderControl } from '../controls/index.js';

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
                    type: new SliderControl('safety', 'Safety'),
                    startChannel: 0,
                    controlType: 'toggle',  // UI hint for toggle behavior
                    offValue: 0,
                    onValue: 255
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
