import { WheelControlType } from './types/WheelControlType.js';

// Pattern icons — standalone SVGs editable in /src/assets/patterns/.
// Vite's ?raw suffix imports the file content as a string.
import noneIcon              from '../../../assets/patterns/none.svg?raw';
import circleLargeIcon       from '../../../assets/patterns/circle-large.svg?raw';
import circleMediumIcon      from '../../../assets/patterns/circle-medium.svg?raw';
import circleSmallIcon       from '../../../assets/patterns/circle-small.svg?raw';
import diagonalStripeIcon    from '../../../assets/patterns/diagonal-stripe.svg?raw';
import asteriskIcon          from '../../../assets/patterns/asterisk.svg?raw';
import crosshatchIcon        from '../../../assets/patterns/crosshatch.svg?raw';
import wifiWavesIcon         from '../../../assets/patterns/wifi-waves.svg?raw';
import apertureBladesIcon    from '../../../assets/patterns/aperture-blades.svg?raw';
import triangleIcon          from '../../../assets/patterns/triangle.svg?raw';
import threeTrianglesIcon    from '../../../assets/patterns/three-triangles.svg?raw';
import dotsIcon              from '../../../assets/patterns/dots.svg?raw';
import circleOfTrianglesIcon from '../../../assets/patterns/circle-of-triangles.svg?raw';
import flowerIcon            from '../../../assets/patterns/flower.svg?raw';

// DELIBANG 150W moving head beam — observed pattern labels in DMX order.
// `id` is the string value used for the --pattern CSS property.
const PATTERNS = [
	{ id: 'none',                label: 'None',                icon: noneIcon },
	{ id: 'circle-large',        label: 'Circle – Large',      icon: circleLargeIcon },
	{ id: 'circle-medium',       label: 'Circle – Medium',     icon: circleMediumIcon },
	{ id: 'circle-small',        label: 'Circle – Small',      icon: circleSmallIcon },
	{ id: 'diagonal-stripe',     label: 'Diagonal Stripe',     icon: diagonalStripeIcon },
	{ id: 'asterisk',            label: 'Asterisk',            icon: asteriskIcon },
	{ id: 'crosshatch',          label: 'Crosshatch',          icon: crosshatchIcon },
	{ id: 'wifi-waves',          label: 'Wifi Waves',          icon: wifiWavesIcon },
	{ id: 'aperture-blades',     label: 'Aperture Blades',     icon: apertureBladesIcon },
	{ id: 'triangle',            label: 'Triangle',            icon: triangleIcon },
	{ id: 'three-triangles',     label: 'Three Triangles',     icon: threeTrianglesIcon },
	{ id: 'dots',                label: 'Dots',                icon: dotsIcon },
	{ id: 'circle-of-triangles', label: 'Circle of Triangles', icon: circleOfTrianglesIcon },
	{ id: 'flower',              label: 'Flower',              icon: flowerIcon }
];

function buildStaticSlots() {
	return PATTERNS.map((p, i) => ({
		id: p.id,
		label: p.label,
		icon: p.icon,
		dmxStart: i === 0 ? 0 : 6 + (i - 1) * 6,
		dmxEnd: i === 0 ? 5 : 6 + (i - 1) * 6 + 5,
		colors: []
	}));
}

function buildModifierSlots() {
	// Keep UI positions aligned with the static list: 14 slots in the same
	// order as PATTERNS. Shake variants map to their pattern's DMX range
	// (DMX 84 = pattern 13 shake, 90 = 12, …, 156 = 1). 'None' has no shake
	// variant — render a disabled placeholder that re-uses None's DMX range.
	return PATTERNS.map((p, i) => {
		if (i === 0) {
			return {
				id: p.id,
				label: 'None (no shake)',
				icon: p.icon,
				dmxStart: 0,
				dmxEnd: 5,
				colors: [],
				disabled: true
			};
		}
		const start = 84 + (13 - i) * 6;
		return {
			id: p.id,
			label: `${p.label} (shake)`,
			icon: p.icon,
			dmxStart: start,
			dmxEnd: start + 5,
			colors: []
		};
	});
}

export class PatternWheelControl extends WheelControlType {
	constructor() {
		super({
			id: 'pattern-wheel',
			name: 'Pattern',
			staticSlots: buildStaticSlots(),
			modifierSlots: buildModifierSlots(),
			fwdRange: { start: 162, end: 207, ordering: 'fast-to-slow' },
			revRange: { start: 208, end: 255, ordering: 'slow-to-fast' },
			cssPrefix: 'pattern'
		});
	}
}
