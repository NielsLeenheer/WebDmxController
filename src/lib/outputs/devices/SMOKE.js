import { DeviceType } from './DeviceType.js';

/**
 * Smoke Machine Device Type
 * Single channel output control
 */
export class SmokeDeviceType extends DeviceType {
    constructor() {
        super(
            'Smoke Machine',
            1,
            [
                { name: 'Output', channel: 0 }
            ],
            [
                {
                    name: 'Output',
                    type: 'slider',
                    color: '#666666',
                    components: { value: 0 }
                }
            ]
        );
    }
}

export const SMOKE = new SmokeDeviceType();
