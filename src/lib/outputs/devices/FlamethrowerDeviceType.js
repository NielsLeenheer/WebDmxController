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
            id: 'flamethrower',
            name: 'Flamethrower',
            channels: 2,
            defaultValues: [0, 0],
            controls: [
                {
                    id: 'safety',
                    type: CONTROL_TYPES.Safety,
                    startChannel: 0
                },
                {
                    id: 'flame',
                    type: CONTROL_TYPES.Flame,
                    startChannel: 1
                }
            ]
        });
    }
}
