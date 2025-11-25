import { InputType } from './InputType.js';

/**
 * Thingy:52 Input Type
 *
 * Nordic Thingy:52 motion sensor.
 * A single thingy input exposes button functionality plus all sensor values simultaneously.
 */
export class ThingyInputType extends InputType {
	constructor() {
		super('thingy', 'Thingy:52');
	}

	getExportedValues(input) {
		const base = input.cssProperty || '--thingy';

		// A thingy input exposes all sensor values simultaneously
		return [
			// Pan/Tilt (gravity-compensated orientation)
			{
				key: 'pan',
				label: 'Pan',
				cssProperty: `${base}-pan`,
				type: 'range',
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Pan angle (-180° to 180°)'
			},
			{
				key: 'tilt',
				label: 'Tilt',
				cssProperty: `${base}-tilt`,
				type: 'range',
				min: -90,
				max: 90,
				unit: 'deg',
				description: 'Tilt angle (-90° to 90°)'
			},

			// Euler angles
			{
				key: 'euler-roll',
				label: 'Roll',
				cssProperty: `${base}-euler-roll`,
				type: 'range',
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Roll angle (-180° to 180°)'
			},
			{
				key: 'euler-pitch',
				label: 'Pitch',
				cssProperty: `${base}-euler-pitch`,
				type: 'range',
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Pitch angle (-180° to 180°)'
			},
			{
				key: 'euler-yaw',
				label: 'Yaw',
				cssProperty: `${base}-euler-yaw`,
				type: 'range',
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Yaw angle (-180° to 180°)'
			},

			// Quaternion
			{
				key: 'quat-w',
				label: 'Quaternion W',
				cssProperty: `${base}-quat-w`,
				type: 'range',
				min: -1,
				max: 1,
				unit: '',
				description: 'Quaternion W component (-1 to 1)'
			},
			{
				key: 'quat-x',
				label: 'Quaternion X',
				cssProperty: `${base}-quat-x`,
				type: 'range',
				min: -1,
				max: 1,
				unit: '',
				description: 'Quaternion X component (-1 to 1)'
			},
			{
				key: 'quat-y',
				label: 'Quaternion Y',
				cssProperty: `${base}-quat-y`,
				type: 'range',
				min: -1,
				max: 1,
				unit: '',
				description: 'Quaternion Y component (-1 to 1)'
			},
			{
				key: 'quat-z',
				label: 'Quaternion Z',
				cssProperty: `${base}-quat-z`,
				type: 'range',
				min: -1,
				max: 1,
				unit: '',
				description: 'Quaternion Z component (-1 to 1)'
			},

			// Accelerometer
			{
				key: 'accel-x',
				label: 'Accel X',
				cssProperty: `${base}-accel-x`,
				type: 'range',
				min: -4,
				max: 4,
				unit: 'g',
				description: 'X acceleration (-4g to 4g)'
			},
			{
				key: 'accel-y',
				label: 'Accel Y',
				cssProperty: `${base}-accel-y`,
				type: 'range',
				min: -4,
				max: 4,
				unit: 'g',
				description: 'Y acceleration (-4g to 4g)'
			},
			{
				key: 'accel-z',
				label: 'Accel Z',
				cssProperty: `${base}-accel-z`,
				type: 'range',
				min: -4,
				max: 4,
				unit: 'g',
				description: 'Z acceleration (-4g to 4g)'
			},

			// Gyroscope
			{
				key: 'gyro-x',
				label: 'Gyro X',
				cssProperty: `${base}-gyro-x`,
				type: 'range',
				min: -2000,
				max: 2000,
				unit: 'deg/s',
				description: 'X angular velocity (-2000 to 2000 deg/s)'
			},
			{
				key: 'gyro-y',
				label: 'Gyro Y',
				cssProperty: `${base}-gyro-y`,
				type: 'range',
				min: -2000,
				max: 2000,
				unit: 'deg/s',
				description: 'Y angular velocity (-2000 to 2000 deg/s)'
			},
			{
				key: 'gyro-z',
				label: 'Gyro Z',
				cssProperty: `${base}-gyro-z`,
				type: 'range',
				min: -2000,
				max: 2000,
				unit: 'deg/s',
				description: 'Z angular velocity (-2000 to 2000 deg/s)'
			},

			// Compass
			{
				key: 'compass-x',
				label: 'Compass X',
				cssProperty: `${base}-compass-x`,
				type: 'range',
				min: -100,
				max: 100,
				unit: 'µT',
				description: 'X magnetic field (-100 to 100 µT)'
			},
			{
				key: 'compass-y',
				label: 'Compass Y',
				cssProperty: `${base}-compass-y`,
				type: 'range',
				min: -100,
				max: 100,
				unit: 'µT',
				description: 'Y magnetic field (-100 to 100 µT)'
			},
			{
				key: 'compass-z',
				label: 'Compass Z',
				cssProperty: `${base}-compass-z`,
				type: 'range',
				min: -100,
				max: 100,
				unit: 'µT',
				description: 'Z magnetic field (-100 to 100 µT)'
			}
		];
	}

	isButton() {
		return true;
	}

	hasValues() {
		return true;
	}
}
