/**
 * MIDI Device Profiles
 *
 * Device-specific color mappings and configurations for MIDI controllers
 * with LED feedback. Each profile defines how colors map to MIDI velocity values.
 */

// Import device profiles
import { MIDIDeviceProfile } from './midi/MIDIDeviceProfile.js';
import { APCMiniMK2Profile } from './midi/APCMiniMK2Profile.js';
import { AkaiLPD8MK2Profile } from './midi/AkaiLPD8MK2Profile.js';
import { DonnerStarrypadProfile } from './midi/DonnerStarrypadProfile.js';

/**
 * Device Profile Manager
 * Automatically matches MIDI devices to their profiles
 */
export class MIDIDeviceProfileManager {
	constructor() {
		this.profiles = [
			new APCMiniMK2Profile(),
			new AkaiLPD8MK2Profile(),
			new DonnerStarrypadProfile()
		];
	}

	/**
	 * Get profile for a device name
	 */
	getProfile(deviceName) {
		for (const profile of this.profiles) {
			if (profile.matches(deviceName)) {
				return profile;
			}
		}
		// Return generic profile if no match
		return new MIDIDeviceProfile('Generic MIDI Device');
	}

	/**
	 * Add a custom profile
	 */
	addProfile(profile) {
		this.profiles.unshift(profile); // Add at beginning for priority
	}
}
