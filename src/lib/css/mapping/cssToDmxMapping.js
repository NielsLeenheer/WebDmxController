/**
 * CSS to DMX Mapping
 *
 * Maps CSS property names to DMX component names and conversion functions.
 * This is the "reverse" direction - sampling CSS values and converting to DMX.
 */

/**
 * CSS to DMX mapping configuration
 * Maps CSS property names to component names and conversion functions
 */
export const CSS_TO_DMX_MAPPING = {
	// Color property → RGB components
	'color': {
		// Parse RGB color and return multiple component values
		sample: (cssValue) => {
			const match = cssValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (!match) return {};

			return {
				'Red': parseInt(match[1]),
				'Green': parseInt(match[2]),
				'Blue': parseInt(match[3])
			};
		},
		requiredComponents: ['Red', 'Green', 'Blue']
	},

	// Pan custom property
	'--pan': {
		// Convert -50% to +50% → 0-255 DMX (0% = center = 127.5)
		sample: (cssValue) => {
			const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(-50, Math.min(50, percent));
			const dmxValue = Math.round(((clamped + 50) / 100) * 255);

			return { 'Pan': dmxValue };
		},
		requiredComponents: ['Pan']
	},

	// Tilt custom property
	'--tilt': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Tilt': dmxValue };
		},
		requiredComponents: ['Tilt']
	},

	// Intensity (opacity or --intensity)
	'--intensity': {
		// Convert 0.0-1.0 → 0-255 DMX
		sample: (cssValue) => {
			const value = parseFloat(cssValue) || 0;
			const clamped = Math.max(0, Math.min(1, value));
			const dmxValue = Math.round(clamped * 255);

			return { 'Intensity': dmxValue, 'Dimmer': dmxValue };
		},
		requiredComponents: [] // Can be either Intensity or Dimmer
	},

	// Opacity (alternative for intensity/dimmer)
	'opacity': {
		// Convert 0.0-1.0 → 0-255 DMX
		sample: (cssValue) => {
			const value = parseFloat(cssValue) || 1;
			const clamped = Math.max(0, Math.min(1, value));
			const dmxValue = Math.round(clamped * 255);

			return { 'Intensity': dmxValue, 'Dimmer': dmxValue };
		},
		requiredComponents: [] // Can be either Intensity or Dimmer
	},

	// White custom property
	'--white': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'White': dmxValue };
		},
		requiredComponents: ['White']
	},

	// Amber custom property
	'--amber': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Amber': dmxValue };
		},
		requiredComponents: ['Amber']
	},

	// Smoke custom property
	'--smoke': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Smoke': dmxValue };
		},
		requiredComponents: ['Smoke']
	},

	// Flame custom property
	'--flame': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Flame': dmxValue };
		},
		requiredComponents: ['Flame']
	},

	// Safety custom property (special case)
	'--safety': {
		// Convert "none" or "probably" → 0 or 255 DMX
		sample: (cssValue) => {
			const value = cssValue.trim().toLowerCase();
			const dmxValue = value === 'probably' ? 255 : 0;

			return { 'Safety': dmxValue };
		},
		requiredComponents: ['Safety']
	},

	// Pressure custom property (for velocity-sensitive buttons)
	// Note: This is a pattern - actual property names are dynamic (e.g., --button-a-pressure)
	// These are CSS variables available for use in custom CSS rules
	// They do NOT automatically map to device channels - use them explicitly if needed
	// Example: #device-1 { --intensity: var(--button-a-pressure); }
	'--pressure': {
		// Pressure properties don't automatically map to channels
		// They're just CSS variables available for user's custom CSS
		sample: (cssValue) => {
			// Return empty object - no automatic channel mapping
			return {};
		},
		requiredComponents: []
	}
};
