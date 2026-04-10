import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Laser Projector Device Type (ILDA only)
 *
 * No DMX channels — uses ILDA via Helios DAC for X/Y drawing.
 * SVG geometry is sampled and sent through the device's DAC connection.
 */
export class LaserProjectorDeviceType extends DeviceType {
	constructor() {
		super({
			id: 'laser-projector',
			name: 'Laser Projector',
			channels: 0,
			defaultValues: [],
			controls: [
				{
					id: 'ilda',
					type: CONTROL_TYPES.ILDA,
					startChannel: 0
				}
			]
		});
	}
}
