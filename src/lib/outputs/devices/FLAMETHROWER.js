import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Flamethrower Device Type
 * Safety channel + Flame control
 *
 * Channels:
 * 0: Safety
 * 1: Flame
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
                    type: CONTROL_TYPES.Safety,
                    startChannel: 0
                },
                {
                    name: 'Flame',
                    type: CONTROL_TYPES.Flame,
                    startChannel: 1
                }
            ]
        });
    }
}

export const FLAMETHROWER = new FlamethrowerDeviceType();
