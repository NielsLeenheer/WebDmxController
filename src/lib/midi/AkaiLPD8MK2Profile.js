import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Akai LPD8 MK2
 * RGB LED pads with full color support
 */
export class AkaiLPD8MK2Profile extends MIDIDeviceProfile {
	constructor() {
		super('Akai LPD8 MK2', [/lpd\s*8\s*mk\s*2/i, /lpd8\s*mk2/i, /lpd8.*wireless.*2/i]);
		this.padNotes = [36, 37, 38, 39, 40, 41, 42, 43];
		this.noteToPadIndex = new Map(this.padNotes.map((note, index) => [note, index]));
		this._rgbColorMap = this._getRGBColorMap();
		this.deviceId = 0x7f; // Broadcast to all devices by default
	}

	_getColorUpdateMode() {
		return 'sysex';
	}

	_getColorMap() {
		// Maintain compatibility for any velocity-based fallbacks
		return {
			'off': 0,
			'black': 0
		};
	}

	_getRGBColorMap() {
		const max = 127;
		const mid = 63;
		const dim = 31;
		return {
			'off': { r: 0, g: 0, b: 0 },
			'black': { r: 0, g: 0, b: 0 },
			'gray': { r: mid, g: mid, b: mid },
			'grey': { r: mid, g: mid, b: mid },
			'white': { r: max, g: max, b: max },
			'red': { r: max, g: 0, b: 0 },
			'red-dim': { r: dim, g: 0, b: 0 },
			'red-half': { r: mid, g: 0, b: 0 },
			'red-bright': { r: max, g: dim, b: dim },
			'orange': { r: max, g: mid, b: 0 },
			'orange-dim': { r: mid, g: dim, b: 0 },
			'orange-half': { r: mid, g: mid, b: 0 },
			'orange-bright': { r: max, g: mid, b: dim },
			'yellow': { r: max, g: max, b: 0 },
			'yellow-dim': { r: mid, g: mid, b: 0 },
			'yellow-half': { r: max, g: mid, b: 0 },
			'yellow-bright': { r: max, g: max, b: dim },
			'lime': { r: mid, g: max, b: 0 },
			'lime-dim': { r: dim, g: mid, b: 0 },
			'lime-half': { r: mid, g: mid, b: 0 },
			'lime-bright': { r: mid, g: max, b: dim },
			'green': { r: 0, g: max, b: 0 },
			'green-dim': { r: 0, g: dim, b: 0 },
			'green-half': { r: 0, g: mid, b: 0 },
			'green-bright': { r: dim, g: max, b: dim },
			'spring': { r: 0, g: max, b: mid },
			'spring-dim': { r: 0, g: dim, b: dim },
			'spring-half': { r: 0, g: mid, b: mid },
			'spring-bright': { r: dim, g: max, b: mid },
			'turquoise': { r: 0, g: mid, b: max },
			'turquoise-dim': { r: 0, g: dim, b: mid },
			'turquoise-half': { r: 0, g: mid, b: mid },
			'turquoise-bright': { r: dim, g: mid, b: max },
			'cyan': { r: 0, g: max, b: max },
			'cyan-dim': { r: 0, g: dim, b: dim },
			'cyan-half': { r: 0, g: mid, b: mid },
			'cyan-bright': { r: dim, g: max, b: max },
			'sky': { r: 0, g: mid, b: max },
			'sky-dim': { r: 0, g: dim, b: mid },
			'sky-half': { r: 0, g: mid, b: mid },
			'sky-bright': { r: dim, g: mid, b: max },
			'blue': { r: 0, g: 0, b: max },
			'blue-dim': { r: 0, g: 0, b: dim },
			'blue-half': { r: 0, g: 0, b: mid },
			'blue-bright': { r: dim, g: dim, b: max },
			'violet': { r: mid, g: 0, b: max },
			'violet-dim': { r: dim, g: 0, b: dim },
			'violet-half': { r: mid, g: 0, b: mid },
			'violet-bright': { r: max, g: dim, b: max },
			'purple': { r: max, g: 0, b: max },
			'purple-dim': { r: dim, g: 0, b: dim },
			'purple-half': { r: mid, g: 0, b: mid },
			'purple-bright': { r: max, g: dim, b: max },
			'magenta': { r: max, g: 0, b: mid },
			'magenta-dim': { r: dim, g: 0, b: dim },
			'magenta-half': { r: mid, g: 0, b: mid },
			'magenta-bright': { r: max, g: mid, b: max },
			'pink': { r: max, g: mid, b: mid },
			'pink-dim': { r: mid, g: dim, b: dim },
			'pink-half': { r: mid, g: mid, b: mid },
			'pink-bright': { r: max, g: mid, b: max }
		};
	}

	colorToRGB(color) {
		if (!color) return { r: 0, g: 0, b: 0 };
		if (typeof color === 'object' && color !== null) return color;
		if (typeof color === 'number') {
			const value = Math.max(0, Math.min(127, color));
			return { r: value, g: value, b: value };
		}

		if (typeof color === 'string') {
			const key = color.toLowerCase();
			if (this._rgbColorMap[key]) {
				return this._rgbColorMap[key];
			}

			const hexMatch = key.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
			if (hexMatch) {
				return this._hexToRGB(hexMatch[1]);
			}

			const rgbMatch = key.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
			if (rgbMatch) {
				return {
					r: parseInt(rgbMatch[1], 10),
					g: parseInt(rgbMatch[2], 10),
					b: parseInt(rgbMatch[3], 10)
				};
			}
		}

		return { r: 0, g: 0, b: 0 };
	}

	buildColorSysEx(buttonColors) {
		const payload = [];
		for (let padIndex = 0; padIndex < this.padNotes.length; padIndex++) {
			const note = this.padNotes[padIndex];
			const color = buttonColors.get(note) || 'off';
			const rgb = this._normalizeRGB(this.colorToRGB(color));
			payload.push(...this._encodeColor(rgb));
		}

		return [
			0xf0,
			0x47,
			this.deviceId & 0x7f,
			0x4c,
			0x06,
			0x00,
			0x30,
			...payload,
			0xf7
		];
	}

	_encodeColor({ r, g, b }) {
		const encodeChannel = (value) => {
			const clamped = Math.max(0, Math.min(127, value));
			return [(clamped >> 7) & 0x7f, clamped & 0x7f];
		};

		return [...encodeChannel(r), ...encodeChannel(g), ...encodeChannel(b)];
	}

	_normalizeRGB({ r, g, b }) {
		const clamp = (value) => Math.max(0, Math.min(255, value));
		return {
			r: Math.round((clamp(r) / 255) * 127),
			g: Math.round((clamp(g) / 255) * 127),
			b: Math.round((clamp(b) / 255) * 127)
		};
	}

	_hexToRGB(hex) {
		if (hex.length === 3) {
			return {
				r: parseInt(hex[0] + hex[0], 16),
				g: parseInt(hex[1] + hex[1], 16),
				b: parseInt(hex[2] + hex[2], 16)
			};
		}

		return {
			r: parseInt(hex.substring(0, 2), 16),
			g: parseInt(hex.substring(2, 4), 16),
			b: parseInt(hex.substring(4, 6), 16)
		};
	}
}
