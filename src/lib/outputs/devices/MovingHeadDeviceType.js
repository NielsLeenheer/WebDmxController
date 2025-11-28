import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

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
            id: 'moving-head',
            name: 'Moving Head (Basic)',
            channels: 7,
            defaultValues: [0, 0, 255, 0, 0, 0, 0],  // Dimmer at full brightness
            controls: [
                {
                    id: 'pantilt',
                    type: CONTROL_TYPES.PanTilt,
                    startChannel: 0
                },
                {
                    id: 'dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 2
                },
                {
                    id: 'color',
                    type: CONTROL_TYPES.Color,
                    startChannel: 3
                },
                {
                    id: 'white',
                    type: CONTROL_TYPES.White,
                    startChannel: 6
                }
            ]
        });
    }
}
