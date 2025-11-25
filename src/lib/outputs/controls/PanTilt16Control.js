import { XYPad16ControlType } from './types/XYPad16ControlType.js';

/**
 * Pan/Tilt Control (16-bit)
 * Controls position for moving head fixtures (high precision)
 */
export class PanTilt16Control extends XYPad16ControlType {
	constructor() {
		super('pantilt16', 'Pan/Tilt');
	}
}
