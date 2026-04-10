import { InputType } from './InputType.js';
import { AUDIO_BANDS } from '../devices/AudioInputDevice.js';

/**
 * Audio Input Type
 *
 * Defines the CSS properties and beat classes exported by an audio input.
 * Three frequency bands (bass, mid, high) each expose:
 *   - energy as %: --{name}-bass, --{name}-mid, --{name}-high
 *   - beat class:  .{name}-bass,  .{name}-mid,  .{name}-high
 * Plus overall volume: --{name}-volume
 */
export class AudioInputType extends InputType {
	constructor() {
		super('audio', 'Audio');
	}

	getExportedValues(input) {
		const base = input.cssIdentifier ? `--${input.cssIdentifier}` : '--audio';

		const values = AUDIO_BANDS.map(band => ({
			key: band.id,
			label: band.label,
			cssProperty: `${base}-${band.id}`,
			type: 'range',
			min: 0,
			max: 1,
			unit: '%',
			description: `${band.label} energy (${band.lo}–${band.hi} Hz)`
		}));

		values.push({
			key: 'volume',
			label: 'Volume',
			cssProperty: `${base}-volume`,
			type: 'range',
			min: 0,
			max: 1,
			unit: '%',
			description: 'Overall volume level'
		});

		return values;
	}

	/**
	 * Get the beat states available for trigger selection.
	 * Each band can be independently used as a trigger.
	 */
	getBeatStates() {
		return AUDIO_BANDS.map(band => ({
			value: band.id,
			label: `${band.label} Beat`
		}));
	}

	isButton() {
		return true;
	}

	hasValues() {
		return true;
	}
}
