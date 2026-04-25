import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../controls/index.js';

/**
 * Spark Machine (3CH mode)
 *
 * Channels:
 *  0: Heating      (0-99 off / 100-255 on)  — ~4 min preheat
 *  1: Spray Height (Off / 4 gears / Clean)  — 90s per run, indoor max 3.5m
 *  2: Safety       (0 = off/safe / 255 = armed/sparks)
 *
 * Defaults start the device safe: heating off, spray off, safety off.
 */
export class SparkMachineDeviceType extends DeviceType {
	constructor() {
		super({
			id: 'spark-machine',
			name: 'Spark Machine',
			channels: 3,
			defaultValues: [50, 0, 0],
			controls: [
				{
					id: 'sparks',
					type: CONTROL_TYPES.Sparks,
					startChannel: 1
				},
				{
					id: 'heating',
					type: CONTROL_TYPES.Heating,
					startChannel: 0
				},
				{
					id: 'safety',
					type: CONTROL_TYPES.Safety,
					startChannel: 2
				}
			]
		});
	}
}
