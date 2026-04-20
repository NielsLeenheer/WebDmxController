import { ControlType } from './ControlType.js';
import { nearestPaletteColorIndex } from '../../../inputs/colors.js';

/**
 * Wheel Control Type (1 channel: segmented value space)
 *
 * Models DMX channels that combine a discrete static list, an optional
 * modifier list (half-colors / shake variants), and bidirectional rotation
 * ranges — all on one channel. The UI exposes a swatch grid with a
 * "mode" checkbox (Mixed colors / Shake) and a bipolar speed slider
 * (-100..+100, 0 = selected swatch is live).
 *
 * Value shape: { index, modifier, speed }
 * - `index`: position within the active list (static OR modifier, per `modifier`)
 * - `modifier`: false = static slot, true = modifier slot
 * - `speed`: rotation speed, 0 = stopped
 */
export class WheelControlType extends ControlType {
	constructor({
		id,
		name,
		staticSlots,
		modifierSlots = null,
		fwdRange,
		revRange,
		cssPrefix = 'wheel'
	}) {
		super({
			id,
			name,
			type: 'wheel',
			defaultValue: { index: 0, modifier: false, speed: 0 }
		});

		this.staticSlots = staticSlots;
		this.modifierSlots = modifierSlots;
		this.fwdRange = fwdRange;
		this.revRange = revRange;
		this.cssPrefix = cssPrefix;
	}

	getChannelCount() {
		return 1;
	}

	getDefaultValue() {
		return { ...this.defaultValue };
	}

	_hasColorSlots() {
		return this.staticSlots.some(s => s.colors?.[0]);
	}

	_activeSlots(modifier) {
		return modifier ? (this.modifierSlots ?? this.staticSlots) : this.staticSlots;
	}

	_resolveSlot(index, modifier) {
		const slots = this._activeSlots(modifier);
		const clamped = Math.max(0, Math.min(slots.length - 1, index ?? 0));
		return slots[clamped];
	}

	valueToDMX(value) {
		const v = value ?? this.defaultValue;
		const speed = v.speed ?? 0;
		const modifier = !!v.modifier;

		if (speed === 0) {
			const slot = this._resolveSlot(v.index ?? 0, modifier);
			if (!slot) return [0];
			return [Math.round((slot.dmxStart + slot.dmxEnd) / 2)];
		}

		const range = speed > 0 ? this.fwdRange : this.revRange;
		const magnitude = Math.min(100, Math.abs(speed)) / 100;
		const span = range.end - range.start;
		const t = range.ordering === 'fast-to-slow' ? (1 - magnitude) : magnitude;
		const dmx = Math.round(range.start + t * span);
		return [Math.max(0, Math.min(255, dmx))];
	}

	dmxToValue(dmxValues, previous = null) {
		const dmx = dmxValues[0] ?? 0;
		const prev = previous ?? this.defaultValue;

		if (dmx >= this.fwdRange.start && dmx <= this.fwdRange.end) {
			const span = this.fwdRange.end - this.fwdRange.start;
			const t = span === 0 ? 0 : (dmx - this.fwdRange.start) / span;
			const magnitude = this.fwdRange.ordering === 'fast-to-slow' ? (1 - t) : t;
			return {
				index: prev.index ?? 0,
				modifier: !!prev.modifier,
				speed: Math.max(1, Math.round(magnitude * 100))
			};
		}

		if (dmx >= this.revRange.start && dmx <= this.revRange.end) {
			const span = this.revRange.end - this.revRange.start;
			const t = span === 0 ? 0 : (dmx - this.revRange.start) / span;
			const magnitude = this.revRange.ordering === 'fast-to-slow' ? (1 - t) : t;
			return {
				index: prev.index ?? 0,
				modifier: !!prev.modifier,
				speed: -Math.max(1, Math.round(magnitude * 100))
			};
		}

		if (this.modifierSlots) {
			for (let i = 0; i < this.modifierSlots.length; i++) {
				const s = this.modifierSlots[i];
				if (dmx >= s.dmxStart && dmx <= s.dmxEnd) {
					return { index: i, modifier: true, speed: 0 };
				}
			}
		}

		for (let i = 0; i < this.staticSlots.length; i++) {
			const s = this.staticSlots[i];
			if (dmx >= s.dmxStart && dmx <= s.dmxEnd) {
				return { index: i, modifier: false, speed: 0 };
			}
		}

		return { ...this.defaultValue };
	}

	getValueMetadata() {
		const modeKeyword = this._hasColorSlots() ? 'dual' : 'shake';

		const modeMeta = {
			id: 'mode',
			label: `${this.name} mode`,
			type: 'string',
			cssProperty: `--${this.cssPrefix}-mode`,
			sample: false,
			values: ['normal', modeKeyword],
			description: `Wheel mode: normal or ${modeKeyword}`
		};

		const speedMeta = {
			id: 'speed',
			label: `${this.name} speed`,
			type: 'range',
			cssProperty: `--${this.cssPrefix}-speed`,
			sample: false,
			min: -100,
			max: 100,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Rotation speed (-100..100, 0 = stopped)'
		};

		if (!this._hasColorSlots()) {
			// Pattern-style wheel: --pattern is a string id (e.g. "flower").
			const patternMeta = {
				id: 'pattern',
				label: this.name,
				type: 'string',
				cssProperty: `--${this.cssPrefix}`,
				sample: true,
				values: this.staticSlots.map(s => s.id).filter(Boolean),
				description: `${this.name} slot id`
			};
			return { values: [patternMeta, modeMeta, speedMeta] };
		}

		// Color-style wheel: --red/--green/--blue + composite color.
		const channel = (id, label, property, desc) => ({
			id,
			label,
			type: 'range',
			cssProperty: property,
			sample: false,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: desc
		});

		return {
			values: [
				channel('red',   'Red',   '--red',   'Red channel of the current swatch (first color, 0-255)'),
				channel('green', 'Green', '--green', 'Green channel of the current swatch (first color, 0-255)'),
				channel('blue',  'Blue',  '--blue',  'Blue channel of the current swatch (first color, 0-255)'),
				{
					id: 'color',
					label: this.name,
					type: 'composite',
					cssProperty: 'color',
					value: 'rgb(var(--red), var(--green), var(--blue))',
					sample: true,
					description: `${this.name} — RGB from --red/--green/--blue; snaps to nearest swatch first color`
				},
				modeMeta,
				speedMeta
			]
		};
	}

	getSamplingConfig() {
		const modeKeyword = this._hasColorSlots() ? 'dual' : 'shake';

		const speedProp = {
			cssProperty: `--${this.cssPrefix}-speed`,
			parse: (v) => {
				const m = v.match(/(-?\d+(?:\.\d+)?)/);
				if (!m) return null;
				const n = parseFloat(m[1]);
				return { speed: Math.max(-100, Math.min(100, Math.round(n))) };
			}
		};

		const modeProp = {
			cssProperty: `--${this.cssPrefix}-mode`,
			parse: (v) => ({ modifier: v.trim().toLowerCase() === modeKeyword })
		};

		if (!this._hasColorSlots()) {
			const patternProp = {
				cssProperty: `--${this.cssPrefix}`,
				parse: (v) => {
					const id = v.trim().replace(/^['"]+|['"]+$/g, '');
					if (!id) return null;
					const staticIdx = this.staticSlots.findIndex(s => s.id === id);
					const modifierIdx = this.modifierSlots?.findIndex(s => s.id === id) ?? -1;
					return {
						_staticIndex: staticIdx >= 0 ? staticIdx : 0,
						_modifierIndex: modifierIdx >= 0 ? modifierIdx : 0
					};
				}
			};
			return {
				properties: [patternProp, modeProp, speedProp],
				finalize: (merged) => this._finalize(merged)
			};
		}

		const colorProp = {
			cssProperty: 'color',
			parse: (v) => {
				const m = v.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
				if (!m) return null;
				const rgb = { r: +m[1], g: +m[2], b: +m[3] };
				const staticIdx = nearestPaletteColorIndex(rgb, this.staticSlots);
				const modifierIdx = this.modifierSlots
					? nearestPaletteColorIndex(rgb, this.modifierSlots)
					: 0;
				return {
					_staticIndex: staticIdx,
					_modifierIndex: modifierIdx
				};
			}
		};

		return {
			properties: [colorProp, modeProp, speedProp],
			finalize: (merged) => this._finalize(merged)
		};
	}

	_finalize(merged) {
		const modifier = !!merged.modifier;
		const index = modifier
			? (merged._modifierIndex ?? 0)
			: (merged._staticIndex ?? 0);
		return {
			index,
			modifier,
			speed: merged.speed ?? 0
		};
	}
}
