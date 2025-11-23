import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Smoke Machine Device Type
 * Single channel output control
 *
 * Channels:
 * 0: Output
 */
export class SmokeDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'SMOKE',
            name: 'Smoke Machine',
            channels: 1,
            defaultValues: [0],
            controls: [
                {
                    name: 'Output',
                    type: CONTROL_TYPES.Output,
                    startChannel: 0
                }
            ]
        });
    }
}

export const SMOKE = new SmokeDeviceType();
