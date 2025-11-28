import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * RGBA Light Device Type
 * 4-channel RGB + Amber fixture
 *
 * Channels:
 * 0: Red
 * 1: Green
 * 2: Blue
 * 3: Amber
 */
export class RGBADeviceType extends DeviceType {
    constructor() {
        super({
            id: 'rgba',
            name: 'RGBA Light',
            channels: 4,
            defaultValues: [0, 0, 0, 0],
            controls: [
                {
                    id: 'color',
                    type: CONTROL_TYPES.Color,
                    startChannel: 0
                },
                {
                    id: 'amber',
                    type: CONTROL_TYPES.Amber,
                    startChannel: 3
                }
            ]
        });
    }
}
