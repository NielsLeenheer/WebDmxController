import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../../controls/definitions.js';

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
            id: 'MOVING_HEAD_11CH',
            name: 'Moving Head (11ch)',
            channels: 11,
            defaultValues: [0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0],  // Dimmer at full brightness
            controls: [
                {
                    name: 'Pan/Tilt',
                    type: CONTROL_TYPES.PanTilt16,  // 16-bit control (uses 4 channels)
                    startChannel: 0
                },
                {
                    name: 'Speed',
                    type: CONTROL_TYPES.Speed,
                    startChannel: 4,
                    color: '#666666'
                },
                {
                    name: 'Dimmer',
                    type: CONTROL_TYPES.Dimmer,
                    startChannel: 5,
                    color: '#888888'
                },
                {
                    name: 'Strobe',
                    type: CONTROL_TYPES.Strobe,
                    startChannel: 6,
                    color: '#888888'
                },
                {
                    name: 'Color',
                    type: CONTROL_TYPES.RGB,
                    startChannel: 7
                },
                {
                    name: 'White',
                    type: CONTROL_TYPES.White,
                    startChannel: 10,
                    color: '#808080'
                }
            ]
        });
    }
}

export const MOVING_HEAD_11CH = new MovingHead11CHDeviceType();
