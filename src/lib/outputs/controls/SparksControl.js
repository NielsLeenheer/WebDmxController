import { ControlType } from './types/ControlType.js';

/**
 * Sparks Control — Spark Machine spray height.
 *
 * Slider covers 5 discrete DMX zones (Off / Gear 1–4, DMX 0-209). A
 * separate "Cleaning" checkbox overrides the slider with DMX 255, so the
 * user can jump straight into cleaning mode without sliding through the
 * intermediate gears.
 *
 * Value shape: { level: number (0-209), cleaning: boolean }
 */
export class SparksControl extends ControlType {
	constructor() {
		super({
			id: 'sparks',
			name: 'Sparks',
			type: 'sparks',
			defaultValue: { level: 0, cleaning: false }
		});
	}

	getChannelCount() {
		return 1;
	}

	getDefaultValue() {
		return { ...this.defaultValue };
	}

	valueToDMX(value) {
		const v = value ?? this.defaultValue;
		if (v.cleaning) return [255];
		const level = Math.max(0, Math.min(209, v.level ?? 0));
		return [level];
	}

	dmxToValue(dmxValues) {
		const dmx = dmxValues[0] ?? 0;
		if (dmx >= 210) return { level: 0, cleaning: true };
		return { level: dmx, cleaning: false };
	}

	/**
	 * Stepped flame-like gradient — 5 hard-stop zones matching the DMX bands
	 * (0-25 Off, 26-71 Gear 1, 72-117 Gear 2, 118-163 Gear 3, 164-209 Gear 4)
	 * scaled to the slider's 0-209 range.
	 */
	getGradient() {
		return 'linear-gradient(to right, #1a1a1a 0% 12%, #7a2c10 12% 34%, #ff5722 34% 56%, #ff9800 56% 78%, #ffc107 78% 100%)';
	}

	getColor(value) {
		if (value?.cleaning) return '#000';
		const level = value?.level ?? 0;
		if (level <= 25)  return '#1a1a1a';
		if (level <= 71)  return '#7a2c10';
		if (level <= 117) return '#ff5722';
		if (level <= 163) return '#ff9800';
		return '#ffc107';
	}

	getValueMetadata() {
		return {
			values: [
				{
					id: 'level',
					label: 'Sparks',
					type: 'range',
					cssProperty: '--sparks',
					sample: false,
					min: 0,
					max: 209,
					unit: '',
					dmxMin: 0,
					dmxMax: 209,
					description: 'Spark spray level (0-209 across 5 gears)'
				},
				{
					id: 'cleaning',
					label: 'Cleaning',
					type: 'toggle',
					cssProperty: '--sparks-cleaning',
					sample: false,
					on: 'on',
					off: 'off',
					dmxOn: 1,
					dmxOff: 0,
					description: 'Cleaning mode (overrides level with DMX 255)'
				}
			]
		};
	}

	getSamplingConfig() {
		return {
			properties: [
				{
					cssProperty: '--sparks',
					parse: (v) => {
						const n = parseInt(v);
						if (isNaN(n)) return null;
						return { level: Math.max(0, Math.min(209, n)) };
					}
				},
				{
					cssProperty: '--sparks-cleaning',
					parse: (v) => ({ cleaning: v.trim().toLowerCase() === 'on' })
				}
			],
			finalize: (merged) => {
				if (Object.keys(merged).length === 0) return {};
				return {
					level: merged.level ?? 0,
					cleaning: merged.cleaning ?? false
				};
			}
		};
	}
}
