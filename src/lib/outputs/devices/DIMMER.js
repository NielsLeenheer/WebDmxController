import { DeviceType } from './DeviceType.js';
import { SliderControl } from '../controls/index.js';

/**
 * Dimmer Device Type
 * Single channel intensity control
 *
 * Channels:
 * 0: Intensity
 */
export class DimmerDeviceType extends DeviceType {
    constructor() {
        super({
            id: 'DIMMER',
            name: 'Dimmer',
            channels: 1,
            defaultValues: [255],  // Full brightness by default
            controls: [
                {
                    name: 'Intensity',
                    type: new SliderControl('intensity', 'Intensity'),
                    startChannel: 0,
                    color: '#ffffff',
                    gradient: 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)',
                    thumbColor: (value) => `rgb(${value}, ${value}, ${value})`
                }
            ]
        });
    }
}

export const DIMMER = new DimmerDeviceType();
