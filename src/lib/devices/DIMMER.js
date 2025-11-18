import { DeviceType } from './DeviceType.js';

/**
 * Dimmer Device Type
 * Single channel intensity control
 */
export class DimmerDeviceType extends DeviceType {
    constructor() {
        const defaultValues = [255]; // Full brightness by default
        
        super(
            'Dimmer',
            1,
            [
                { name: 'Intensity', channel: 0 }
            ],
            [
                {
                    name: 'Intensity',
                    type: 'slider',
                    color: '#ffffff',
                    gradient: 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)',
                    thumbColor: (value) => `rgb(${value}, ${value}, ${value})`,
                    components: { value: 0 }
                }
            ],
            defaultValues
        );
    }
}

export const DIMMER = new DimmerDeviceType();
