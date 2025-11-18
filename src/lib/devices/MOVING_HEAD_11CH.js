import { DeviceType } from './DeviceType.js';

/**
 * Moving Head Device Type (11-channel)
 * Pan, Pan Fine, Tilt, Tilt Fine, Speed, Dimmer, Strobe, RGBW
 */
export class MovingHead11CHDeviceType extends DeviceType {
    constructor() {
        const defaultValues = [0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0]; // Dimmer at full brightness
        
        super(
            'Moving Head (11ch)',
            11,
            [
                { name: 'Pan', channel: 0 },
                { name: 'Pan Fine', channel: 1 },
                { name: 'Tilt', channel: 2 },
                { name: 'Tilt Fine', channel: 3 },
                { name: 'Speed', channel: 4 },
                { name: 'Dimmer', channel: 5 },
                { name: 'Strobe', channel: 6 },
                { name: 'Red', channel: 7 },
                { name: 'Green', channel: 8 },
                { name: 'Blue', channel: 9 },
                { name: 'White', channel: 10 }
            ],
            [
                {
                    name: 'Pan/Tilt',
                    type: 'xypad',
                    components: { x: 0, y: 2 }
                },
                {
                    name: 'Speed',
                    type: 'slider',
                    color: '#666666',
                    components: { value: 4 }
                },
                {
                    name: 'Dimmer',
                    type: 'slider',
                    color: '#888888',
                    components: { value: 5 }
                },
                {
                    name: 'Strobe',
                    type: 'slider',
                    color: '#888888',
                    components: { value: 6 }
                },
                {
                    name: 'Color',
                    type: 'rgb',
                    components: { r: 7, g: 8, b: 9 }
                },
                {
                    name: 'White',
                    type: 'slider',
                    color: '#808080',
                    components: { value: 10 }
                }
            ],
            defaultValues
        );
    }
}

export const MOVING_HEAD_11CH = new MovingHead11CHDeviceType();
