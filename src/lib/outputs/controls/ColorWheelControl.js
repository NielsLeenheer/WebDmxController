import { WheelControlType } from './types/WheelControlType.js';

// DELIBANG 150W moving head beam — observed wheel colors in DMX order.
const WHEEL_COLORS = [
	{ label: 'White',        hex: '#ffffff' },
	{ label: 'Red',          hex: '#ff0000' },
	{ label: 'Yellow',       hex: '#ffe600' },
	{ label: 'Blue',         hex: '#1040ff' },
	{ label: 'Green',        hex: '#008a2e' },
	{ label: 'Orange',       hex: '#ff7a00' },
	{ label: 'Magenta',      hex: '#ff00a0' },
	{ label: 'Cyan',         hex: '#00c8ff' },
	{ label: 'Bright Green', hex: '#7fff00' },
	{ label: 'Pink',         hex: '#ff9fc8' }
];

// Observed half-color pairings in DMX order (half 1 → half 9).
// The wheel parks between two adjacent slots, so each entry lists the two
// colors visible in the aperture.
const HALF_COLOR_PAIRINGS = [
	['Bright Green', 'Pink'],
	['Cyan',         'Bright Green'],
	['Magenta',      'Cyan'],
	['Orange',       'Magenta'],
	['Green',        'Orange'],
	['Blue',         'Green'],
	['Yellow',       'Blue'],
	['Red',          'Yellow'],
	null // Half 9 — cycling through all colors (rainbow).
];

function colorByLabel(label) {
	return WHEEL_COLORS.find(c => c.label === label)?.hex ?? '#000000';
}

function buildStaticSlots() {
	return WHEEL_COLORS.map((c, i) => ({
		label: i === 0 ? c.label : `${c.label} (${i})`,
		dmxStart: i === 0 ? 0 : 8 * i,
		dmxEnd: i === 0 ? 7 : 8 * i + 7,
		colors: [c.hex]
	}));
}

function buildModifierSlots() {
	return HALF_COLOR_PAIRINGS.map((pair, i) => {
		const dmxStart = 80 + i * 8;
		const dmxEnd = dmxStart + 7;
		if (pair === null) {
			return {
				label: 'Rainbow',
				dmxStart,
				dmxEnd,
				colors: WHEEL_COLORS.slice(1).map(c => c.hex) // all colors = render rainbow
			};
		}
		return {
			label: `${pair[0]} / ${pair[1]}`,
			dmxStart,
			dmxEnd,
			colors: [colorByLabel(pair[0]), colorByLabel(pair[1])]
		};
	});
}

export class ColorWheelControl extends WheelControlType {
	constructor() {
		super({
			id: 'color-wheel',
			name: 'Color',
			staticSlots: buildStaticSlots(),
			modifierSlots: buildModifierSlots(),
			fwdRange: { start: 152, end: 207, ordering: 'fast-to-slow' },
			revRange: { start: 208, end: 255, ordering: 'slow-to-fast' },
			cssPrefix: 'color'
		});
	}
}
