import { DeviceType } from './DeviceType.js';
import { SliderControl } from '../../controls/definitions.js';

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
                    type: new SliderControl('output', 'Output'),
                    startChannel: 0,
                    color: '#666666'
                }
            ]
        });
    }
}

export const SMOKE = new SmokeDeviceType();
