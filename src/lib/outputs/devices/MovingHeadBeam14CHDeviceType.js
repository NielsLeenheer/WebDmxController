import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Moving Head Beam (14-channel)
 *
 * Channels:
 *  0: Color wheel (white / 9 colors / 9 half-colors / rotate fwd / rotate rev)
 *  1: Strobe
 *  2: LED total dimming
 *  3: Pattern disk (circular / 13 patterns / shakes / rotate fwd / rotate rev)
 *  4: Prism (off / on / rotating)
 *  5: Various colors (macro open/closed)
 *  6: Focus
 *  7: Pan
 *  8: Pan fine
 *  9: Tilt
 * 10: Tilt fine
 * 11: X/Y speed
 * 12: Auto/Sound (unwired)
 * 13: Reset (unwired)
 *
 * UI order mirrors the other moving heads (pantilt, speed, dimmer, strobe, color, …)
 * — channel assignments are unchanged; only the render order differs.
 *
 * Tilt is restricted to DMX 128–255 (upper half of the physical range)
 * to avoid the head spinning through the full rotation on vertical movement.
 * Set `invertTilt: true` on the pantilt control definition to flip the tilt direction.
 */
export class MovingHeadBeam14CHDeviceType extends DeviceType {
	constructor() {
		super({
			id: 'moving-head-beam-14ch',
			name: 'Moving Head Beam (14ch)',
			channels: 14,
			//                           col str dim pat prm mac foc  pan panF tilt tltF spd aut rst
			defaultValues: [0, 0, 255, 0, 0, 64, 0, 128, 0, 192, 0, 0, 0, 0],
			controls: [
				{
					id: 'pantilt',
					type: CONTROL_TYPES.PanTilt16,
					startChannel: 7,
					tiltMin: 128,  // Restrict to upper half — avoids full rotation on tilt
					invertTilt: true,  // Uncomment to invert the tilt axis
					// invertPan: true,   // Uncomment to invert the pan axis
				},
				{
					id: 'speed',
					type: CONTROL_TYPES.Speed,
					startChannel: 11,
					hidden: true
				},
				{ separator: true },
				{
					id: 'dimmer',
					type: CONTROL_TYPES.Dimmer,
					startChannel: 2,
					inverted: true
				},
				{
					id: 'strobe',
					type: CONTROL_TYPES.Strobe,
					startChannel: 1,
                    hidden: true
				},
				{ separator: true },
				{
					id: 'color-wheel',
					type: CONTROL_TYPES.ColorWheel,
					startChannel: 0
				},
				{
					id: 'pattern-wheel',
					type: CONTROL_TYPES.PatternWheel,
					startChannel: 3,
					hidden: true
				},
				{ separator: true },
				{
					id: 'prism',
					type: CONTROL_TYPES.Prism,
					startChannel: 4
				},
				{
					id: 'macro',
					type: CONTROL_TYPES.Macro,
					startChannel: 5,
					hidden: true
				},
				{
					id: 'focus',
					type: CONTROL_TYPES.Focus,
					startChannel: 6
				}
			]
		});
	}
}
