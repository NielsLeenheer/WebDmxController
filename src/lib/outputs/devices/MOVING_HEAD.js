import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../../controls/definitions.js';

/**
 * Moving Head Device Type (Basic 7-channel)
 * Pan, Tilt, Dimmer, RGBW
 *
 * Channels:
 * 0: Pan
 * 1: Tilt
 * 2: Dimmer
 * 3: Red
 * 4: Green
 * 5: Blue
 * 6: White
 */
export class MovingHeadDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'MOVING_HEAD',
            name: 'Moving Head (Basic)',
            channels: 7,
            defaultValues: [0, 0, 255, 0, 0, 0, 0],  // Dimmer at full brightness
            controls: [
                {
                    name: 'Pan/Tilt',
                    type: CONTROL_TYPES.PanTilt,
                    startChannel: 0
                },
                {
                    name: 'Dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 2,
                    color: '#888888'
                },
                {
                    name: 'Color',
                    type: CONTROL_TYPES.RGB,
                    startChannel: 3
                },
                {
                    name: 'White',
                    type: CONTROL_TYPES.White,
                    startChannel: 6,
                    color: '#808080'
                }
            ]
        });
    }
}

export const MOVING_HEAD = new MovingHeadDeviceType();
