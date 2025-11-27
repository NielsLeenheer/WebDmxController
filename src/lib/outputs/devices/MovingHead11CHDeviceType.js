import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Moving Head Device Type (11-channel)
 * Pan, Pan Fine, Tilt, Tilt Fine, Speed, Dimmer, Strobe, RGBW
 *
 * Channels:
 * 0: Pan
 * 1: Pan Fine
 * 2: Tilt
 * 3: Tilt Fine
 * 4: Speed
 * 5: Dimmer
 * 6: Strobe
 * 7: Red
 * 8: Green
 * 9: Blue
 * 10: White
 */
export class MovingHead11CHDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'moving-head-11ch',
            name: 'Moving Head (11ch)',
            channels: 11,
            defaultValues: [0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0],  // Dimmer at full brightness
            controls: [
                {
                    id: 'pantilt',
                    type: CONTROL_TYPES.PanTilt16,  // 16-bit control (uses 4 channels)
                    startChannel: 0
                },
                {
                    id: 'speed',
                    type: CONTROL_TYPES.Speed,
                    startChannel: 4
                },
                {
                    id: 'dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 5
                },
                {
                    id: 'strobe',
                    type: CONTROL_TYPES.Strobe,
                    startChannel: 6
                },
                {
                    id: 'color',
                    type: CONTROL_TYPES.Color,
                    startChannel: 7
                },
                {
                    id: 'white',
                    type: CONTROL_TYPES.White,
                    startChannel: 10
                }
            ]
        });
    }
}
