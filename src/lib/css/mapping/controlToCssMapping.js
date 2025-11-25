/**
 * DMX to CSS Mapping
 *
 * Defines how DMX control types map to CSS properties and value conversions.
 * This is the "forward" direction - generating CSS from DMX values.
 */

/**
 * Control to CSS mapping configuration
 * Defines how each control type maps to CSS properties and how values are converted
 */
export const CONTROL_CSS_MAPPING = {
	// XY Pad controls (Pan/Tilt for moving heads)
	xypad: {
		properties: {
			x: {
				name: '--pan',
				// Convert DMX 0-255 to -50% to +50%
				convert: (value) => `${((value / 255) * 100 - 50).toFixed(1)}%`
			},
			y: {
				name: '--tilt',
				// Convert DMX 0-255 to 0% to 100%
				convert: (value) => `${((value / 255) * 100).toFixed(1)}%`
			}
		}
	},
	// RGB Color controls
	rgb: {
		properties: {
			// Uses all RGB values together to generate color
			color: {
				name: 'color',
				// Special case: uses getDeviceColor with all values
				convert: 'color'
			}
		}
	},
	// Slider controls (Dimmer, Intensity, White, Amber, etc.)
	slider: {
		properties: {
			value: {
				// Property name depends on control name
				getName: (controlName) => {
					if (controlName === 'Dimmer' || controlName === 'Intensity') {
						return '--intensity';
					}
					if (controlName === 'White') {
						return '--white';
					}
					if (controlName === 'Amber') {
						return '--amber';
					}
					// Default for other sliders
					return `--${controlName.toLowerCase().replace(/\s+/g, '-')}`;
				},
				// Convert DMX 0-255 based on control type
				convert: (value, controlName) => {
					if (controlName === 'Dimmer' || controlName === 'Intensity') {
						// Convert to 0.0-1.0 for intensity
						return (value / 255).toFixed(3);
					}
					if (controlName === 'White' || controlName === 'Amber' || controlName === 'Flame') {
						// Convert to percentage 0% to 100%
						return `${((value / 255) * 100).toFixed(1)}%`;
					}
					// For other sliders, use raw DMX value
					return value.toString();
				}
			}
		}
	},
	// Toggle controls (Safety, etc.)
	toggle: {
		properties: {
			value: {
				// Property name depends on control name
				getName: (controlName) => {
					return `--${controlName.toLowerCase().replace(/\s+/g, '-')}`;
				},
				// Convert DMX value based on control type
				convert: (value, controlName, control) => {
					if (controlName === 'Safety') {
						// Special case: Safety uses "none" or "probably"
						return value >= 255 ? 'probably' : 'none';
					}
					// For other toggles, use on/off based on onValue threshold
					if (control && control.onValue !== undefined) {
						return value >= control.onValue ? 'on' : 'off';
					}
					// Default: treat any value >= 128 as on
					return value >= 128 ? 'on' : 'off';
				}
			}
		}
	}
};
