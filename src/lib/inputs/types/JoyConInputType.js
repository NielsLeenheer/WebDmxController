import { InputType } from './InputType.js';

/**
 * Nintendo Joy-Con Input Type (sensors only)
 *
 * The auto-created sensor input exports IMU values as CSS properties.
 * Buttons and stick are separate inputs using standard 'button' and 'stick' types.
 */
export class JoyConInputType extends InputType {
	constructor() {
		super('joycon', 'Joy-Con Sensors');
	}

	getExportedValues(input) {
		const base = input.cssIdentifier ? `--${input.cssIdentifier}` : '--joycon';

		return [
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
			}
		];
	}

	isButton() {
		return false;
	}

	hasValues() {
		return true;
	}
}
