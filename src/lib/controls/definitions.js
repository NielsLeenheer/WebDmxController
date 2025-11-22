/**
 * Control Type Definitions
 *
 * This module defines the shared control type system that provides:
 * - Reusable control patterns (RGB, Slider, XYPad, etc.)
 * - Conversion between control values and DMX arrays
 * - Default values for each control type
 *
 * Key Architecture Points:
 * - Control types are CLASSES (definitions, not data)
 * - They work with PLAIN OBJECTS and ARRAYS (not class instances)
 * - These are singletons - created once, shared across the app
 * - They provide methods for conversion, validation, defaults
 * - They are NOT stored in $state or localStorage
 */

/**
 * Base Control Type
 * All control types extend this class
 */
export class ControlType {
	constructor(id, name, type, defaultValue) {
		this.id = id;          // Unique identifier string
		this.name = name;      // Display name
		this.type = type;      // UI type: 'rgb', 'slider', 'xypad', etc.
		this.defaultValue = defaultValue;  // Default control value
	}

	/**
	 * Get channel count for this control
	 * @returns {number} Number of DMX channels this control uses
	 */
	getChannelCount() {
		throw new Error('Must implement getChannelCount()');
	}

	/**
	 * Convert control value (plain object/number) to DMX array
	 * @param {*} value - Control value (plain object, number, etc.)
	 * @returns {Array<number>} DMX values for this control's channels (0-255)
	 */
	valueToDMX(value) {
		throw new Error('Must implement valueToDMX()');
	}

	/**
	 * Convert DMX array to control value (plain object/number)
	 * @param {Array<number>} dmxValues - DMX values starting at this control
	 * @returns {*} Control value (plain object/number)
	 */
	dmxToValue(dmxValues) {
		throw new Error('Must implement dmxToValue()');
	}

	/**
	 * Get default value as plain object/number
	 * Returns a copy to avoid shared references
	 * @returns {*} Default value (plain object/number, safe for $state)
	 */
	getDefaultValue() {
		// Return a copy to avoid shared references
		if (typeof this.defaultValue === 'object' && this.defaultValue !== null) {
			return { ...this.defaultValue };
		}
		return this.defaultValue;
	}
}

/**
 * RGB Control Type (3 channels: red, green, blue)
 */
export class RGBControl extends ControlType {
	constructor() {
		super('rgb', 'RGB', 'rgb', { r: 0, g: 0, b: 0 });
	}

	getChannelCount() {
		return 3;
	}

	// Input: plain object { r, g, b }
	// Output: plain array [r, g, b]
	valueToDMX(value) {
		return [
			value?.r ?? 0,
			value?.g ?? 0,
			value?.b ?? 0
		];
	}

	// Input: plain array [r, g, b, ...]
	// Output: plain object { r, g, b }
	dmxToValue(dmxValues) {
		return {
			r: dmxValues[0] ?? 0,
			g: dmxValues[1] ?? 0,
			b: dmxValues[2] ?? 0
		};
	}
}

/**
 * RGBA Control Type (4 channels: red, green, blue, amber/white)
 */
export class RGBAControl extends ControlType {
	constructor() {
		super('rgba', 'RGBA', 'rgba', { r: 0, g: 0, b: 0, a: 0 });
	}

	getChannelCount() {
		return 4;
	}

	// Input: plain object { r, g, b, a }
	// Output: plain array [r, g, b, a]
	valueToDMX(value) {
		return [
			value?.r ?? 0,
			value?.g ?? 0,
			value?.b ?? 0,
			value?.a ?? 0
		];
	}

	// Input: plain array [r, g, b, a, ...]
	// Output: plain object { r, g, b, a }
	dmxToValue(dmxValues) {
		return {
			r: dmxValues[0] ?? 0,
			g: dmxValues[1] ?? 0,
			b: dmxValues[2] ?? 0,
			a: dmxValues[3] ?? 0
		};
	}
}

/**
 * Slider Control Type (1 channel: single value 0-255)
 */
export class SliderControl extends ControlType {
	constructor(id, name = 'Slider') {
		super(id, name, 'slider', 0);
	}

	getChannelCount() {
		return 1;
	}

	// Input: plain number
	// Output: plain array [value]
	valueToDMX(value) {
		return [value ?? 0];
	}

	// Input: plain array [value, ...]
	// Output: plain number
	dmxToValue(dmxValues) {
		return dmxValues[0] ?? 0;
	}
}

/**
 * XY Pad Control Type (2 channels: x, y)
 * Used for Pan/Tilt on 8-bit devices
 */
export class XYPadControl extends ControlType {
	constructor(id, name = 'Pan/Tilt') {
		super(id, name, 'xypad', { x: 128, y: 128 });
	}

	getChannelCount() {
		return 2;
	}

	// Input: plain object { x, y }
	// Output: plain array [x, y]
	valueToDMX(value) {
		return [
			value?.x ?? 128,
			value?.y ?? 128
		];
	}

	// Input: plain array [x, y, ...]
	// Output: plain object { x, y }
	dmxToValue(dmxValues) {
		return {
			x: dmxValues[0] ?? 128,
			y: dmxValues[1] ?? 128
		};
	}
}

/**
 * 16-bit XY Pad Control Type (4 channels: pan, pan fine, tilt, tilt fine)
 * Used for Pan/Tilt on 16-bit devices (moving heads with fine control)
 *
 * Note: The UI works with 8-bit values (0-255) for x and y,
 * but this control expands them to 16-bit for fine control
 */
export class XYPad16Control extends ControlType {
	constructor(id, name = 'Pan/Tilt') {
		super(id, name, 'xypad', { x: 128, y: 128 });
	}

	getChannelCount() {
		return 4;  // Pan, Pan Fine, Tilt, Tilt Fine
	}

	// Input: plain object { x, y } (8-bit values 0-255)
	// Output: plain array [pan, panFine, tilt, tiltFine] (16-bit expanded)
	valueToDMX(value) {
		const x = value?.x ?? 128;
		const y = value?.y ?? 128;

		// Convert 8-bit to 16-bit: value * 257
		// This ensures 0 → 0, 255 → 65535
		const x16 = Math.round(x * 257);
		const y16 = Math.round(y * 257);

		return [
			x16 >> 8,        // Pan coarse (high byte)
			x16 & 0xFF,      // Pan fine (low byte)
			y16 >> 8,        // Tilt coarse (high byte)
			y16 & 0xFF       // Tilt fine (low byte)
		];
	}

	// Input: plain array [pan, panFine, tilt, tiltFine, ...]
	// Output: plain object { x, y } (8-bit values 0-255)
	dmxToValue(dmxValues) {
		// Combine coarse and fine into 16-bit values
		const x16 = ((dmxValues[0] ?? 0) << 8) | (dmxValues[1] ?? 0);
		const y16 = ((dmxValues[2] ?? 0) << 8) | (dmxValues[3] ?? 0);

		// Convert 16-bit back to 8-bit
		return {
			x: Math.round(x16 / 257),
			y: Math.round(y16 / 257)
		};
	}
}

/**
 * Control Type Registry
 * Singleton instances of all control types
 * These are the ONLY instances - used for lookups throughout the app
 */
export const CONTROL_TYPES = {
	// Color controls
	RGB: new RGBControl(),
	RGBA: new RGBAControl(),

	// Single-channel controls
	Dimmer: new SliderControl('dimmer', 'Dimmer'),
	Strobe: new SliderControl('strobe', 'Strobe'),
	Speed: new SliderControl('speed', 'Speed'),
	White: new SliderControl('white', 'White'),
	Volume: new SliderControl('volume', 'Volume'),
	Fan: new SliderControl('fan', 'Fan'),
	Flame: new SliderControl('flame', 'Flame'),

	// Position controls
	PanTilt: new XYPadControl('pantilt', 'Pan/Tilt'),
	PanTilt16: new XYPad16Control('pantilt16', 'Pan/Tilt')
};
