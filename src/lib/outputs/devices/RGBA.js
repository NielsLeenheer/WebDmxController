import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';
import { SliderControl } from '../controls/index.js';

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
            id: 'RGBA',
            name: 'RGBA Light',
            channels: 4,
            defaultValues: [0, 0, 0, 0],
            controls: [
                {
                    name: 'Color',
                    type: CONTROL_TYPES.RGB,
                    startChannel: 0
                },
                {
                    name: 'Amber',
                    type: new SliderControl('amber', 'Amber'),
                    startChannel: 3,
                    color: '#ffbf00'
                }
            ]
        });
    }
}

export const RGBA = new RGBADeviceType();
