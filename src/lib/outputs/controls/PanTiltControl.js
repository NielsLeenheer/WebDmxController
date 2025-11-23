import { XYPadControlType } from './types/XYPadControlType.js';

/**
 * Pan/Tilt Control (8-bit)
 * Controls position for moving head fixtures (standard precision)
 */
export class PanTiltControl extends XYPadControlType {
	constructor() {
		super('pantilt', 'Pan/Tilt');
	}
}
