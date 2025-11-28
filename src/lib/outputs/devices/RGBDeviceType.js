import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * RGB Light Device Type
 * Standard 3-channel RGB fixture
 *
 * Channels:
 * 0: Red
 * 1: Green
 * 2: Blue
 */
export class RGBDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'rgb',
            name: 'RGB Light',
            channels: 3,
            defaultValues: [0, 0, 0],
            controls: [
                {
                    id: 'color',
                    type: CONTROL_TYPES.Color,
                    startChannel: 0
                }
            ]
        });
    }
}
