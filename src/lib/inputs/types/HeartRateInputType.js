import { InputType } from './InputType.js';

/**
 * Heart Rate Monitor Input Type
 *
 * Exposes:
 * - heartrate: current BPM (0-220)
 * - beat: pulse value (1→0) that fires on each heartbeat
 *
 * Also acts as a button (trigger/release per beat) for CSS class triggers.
 */
export class HeartRateInputType extends InputType {
	constructor() {
		super('heartrate', 'Heart Rate Monitor');
	}

	getExportedValues(input) {
		const base = input.cssIdentifier ? `--${input.cssIdentifier}` : '--heartrate';

		return [
			{
				key: 'heartrate',
				label: 'Heart Rate',
				cssProperty: `${base}-heartrate`,
				type: 'range',
				min: 0,
				max: 220,
				unit: 'bpm',
				description: 'Heart rate (0-220 BPM)'
			},
			{
				key: 'beat',
				label: 'Beat',
				cssProperty: `${base}-beat`,
				type: 'range',
				min: 0,
				max: 1,
				unit: '',
				description: 'Beat pulse (1→0, decays over RR interval)'
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
