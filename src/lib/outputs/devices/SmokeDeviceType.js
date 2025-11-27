import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Smoke Machine Device Type
 * Single channel smoke control
 *
 * Channels:
 * 0: Smoke
 */
export class SmokeDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'smoke',
            name: 'Smoke Machine',
            channels: 1,
            defaultValues: [0],
            controls: [
                {
                    id: 'smoke',
                    type: CONTROL_TYPES.Smoke,
                    startChannel: 0
                }
            ]
        });
    }
}
