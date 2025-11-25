import { InputType } from './InputType.js';

/**
 * Thingy:52 Input Type
 *
 * Nordic Thingy:52 motion sensor with multiple sensor outputs.
 * Exports different values based on the specific sensor control.
 */
export class ThingyInputType extends InputType {
	constructor() {
		super('thingy', 'Thingy:52');
	}

	getExportedValues(input) {
		const controlId = input.inputControlId || '';

		// Euler angles (-180 to 180 degrees)
		if (controlId.startsWith('euler-')) {
			return [
				{
					key: 'value',
					label: 'Angle',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -180,
					max: 180,
					unit: 'deg',
					description: 'Euler angle in degrees (-180° to 180°)'
				}
			];
		}

		// Pan (gravity-compensated yaw, -180 to 180)
		if (controlId === 'pan') {
			return [
				{
					key: 'value',
					label: 'Pan',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -180,
					max: 180,
					unit: 'deg',
					description: 'Pan angle in degrees (-180° to 180°)'
				}
			];
		}

		// Tilt (gravity-compensated pitch, -90 to 90)
		if (controlId === 'tilt') {
			return [
				{
					key: 'value',
					label: 'Tilt',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -90,
					max: 90,
					unit: 'deg',
					description: 'Tilt angle in degrees (-90° to 90°)'
				}
			];
		}

		// Quaternion components (-1 to 1)
		if (controlId.startsWith('quat-')) {
			return [
				{
					key: 'value',
					label: 'Quaternion',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -1,
					max: 1,
					unit: '',
					description: 'Quaternion component (-1 to 1)'
				}
			];
		}

		// Accelerometer (-4g to 4g)
		if (controlId.startsWith('accel-')) {
			return [
				{
					key: 'value',
					label: 'Acceleration',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -4,
					max: 4,
					unit: 'g',
					description: 'Acceleration in g (-4g to 4g)'
				}
			];
		}

		// Gyroscope (-2000 to 2000 deg/s)
		if (controlId.startsWith('gyro-')) {
			return [
				{
					key: 'value',
					label: 'Angular Velocity',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -2000,
					max: 2000,
					unit: 'deg/s',
					description: 'Angular velocity in deg/s (-2000 to 2000)'
				}
			];
		}

		// Compass (-100 to 100 µT)
		if (controlId.startsWith('compass-')) {
			return [
				{
					key: 'value',
					label: 'Magnetic Field',
					cssProperty: input.cssProperty,
					type: 'range',
					min: -100,
					max: 100,
					unit: 'µT',
					description: 'Magnetic field in µT (-100 to 100)'
				}
			];
		}

		// Thingy button - no continuous values
		if (controlId === 'button') {
			return [];
		}

		// Default fallback
		return [];
	}

	isContinuous() {
		return true;
	}

	/**
	 * Get available sensor controls for Thingy:52
	 * @returns {Array} Array of available sensor control definitions
	 */
	static getAvailableSensors() {
		return [
			{ id: 'pan', name: 'Pan', category: 'orientation' },
			{ id: 'tilt', name: 'Tilt', category: 'orientation' },
			{ id: 'euler-roll', name: 'Roll', category: 'euler' },
			{ id: 'euler-pitch', name: 'Pitch', category: 'euler' },
			{ id: 'euler-yaw', name: 'Yaw', category: 'euler' },
			{ id: 'quat-w', name: 'Quaternion W', category: 'quaternion' },
			{ id: 'quat-x', name: 'Quaternion X', category: 'quaternion' },
			{ id: 'quat-y', name: 'Quaternion Y', category: 'quaternion' },
			{ id: 'quat-z', name: 'Quaternion Z', category: 'quaternion' },
			{ id: 'accel-x', name: 'Accel X', category: 'accelerometer' },
			{ id: 'accel-y', name: 'Accel Y', category: 'accelerometer' },
			{ id: 'accel-z', name: 'Accel Z', category: 'accelerometer' },
			{ id: 'gyro-x', name: 'Gyro X', category: 'gyroscope' },
			{ id: 'gyro-y', name: 'Gyro Y', category: 'gyroscope' },
			{ id: 'gyro-z', name: 'Gyro Z', category: 'gyroscope' },
			{ id: 'compass-x', name: 'Compass X', category: 'compass' },
			{ id: 'compass-y', name: 'Compass Y', category: 'compass' },
			{ id: 'compass-z', name: 'Compass Z', category: 'compass' },
			{ id: 'button', name: 'Button', category: 'button' }
		];
	}
}
