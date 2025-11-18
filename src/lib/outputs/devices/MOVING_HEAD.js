import { DeviceType } from './DeviceType.js';

/**
 * Moving Head Device Type (Basic 7-channel)
 * Pan, Tilt, Dimmer, RGBW
 */
export class MovingHeadDeviceType extends DeviceType {
    constructor() {
        const defaultValues = [0, 0, 255, 0, 0, 0, 0]; // Dimmer at full brightness
        
        super(
            'Moving Head (Basic)',
            7,
            [
                { name: 'Pan', channel: 0 },
                { name: 'Tilt', channel: 1 },
                { name: 'Dimmer', channel: 2 },
                { name: 'Red', channel: 3 },
                { name: 'Green', channel: 4 },
                { name: 'Blue', channel: 5 },
                { name: 'White', channel: 6 }
            ],
            [
                {
                    name: 'Pan/Tilt',
                    type: 'xypad',
                    components: { x: 0, y: 1 }
                },
                {
                    name: 'Dimmer',
                    type: 'slider',
                    color: '#888888',
                    components: { value: 2 }
                },
                {
                    name: 'Color',
                    type: 'rgb',
                    components: { r: 3, g: 4, b: 5 }
                },
                {
                    name: 'White',
                    type: 'slider',
                    color: '#808080',
                    components: { value: 6 }
                }
            ],
            defaultValues
        );
    }
}

export const MOVING_HEAD = new MovingHeadDeviceType();
