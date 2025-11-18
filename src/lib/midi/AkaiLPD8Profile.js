import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Akai LPD8
 * Note: LPD8 has limited LED feedback - mainly red LEDs
 */
export class AkaiLPD8Profile extends MIDIDeviceProfile {
	constructor() {
		super('Akai LPD8', [/lpd\s*8/i, /lpd8/i]);
	}

	_getColorMap() {
		// LPD8 has simple red LEDs - on/off only
		return {
			'off': 0,
			'red': 127,
			'on': 127,
			// Map all colors to red
			'green': 127,
			'blue': 127,
			'yellow': 127,
			'orange': 127,
			'cyan': 127,
			'purple': 127,
			'pink': 127,
			'white': 127
		};
	}
}
