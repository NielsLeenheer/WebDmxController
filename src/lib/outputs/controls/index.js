/**
 * Control Definitions
 *
 * This module exports all control classes and a registry of singleton instances.
 *
 * Architecture:
 * - Control Type Classes (in types/) define the base behavior for each control pattern
 * - Control Classes (in this directory) extend the types and provide specific customization
 * - CONTROL_TYPES registry contains singleton instances used throughout the app
 *
 * Control types provide:
 * - Reusable control patterns (RGB, Slider, XYPad, etc.)
 * - Conversion between control values and DMX arrays
 * - Default values for each control type
 * - Room for future control-specific customization
 */

// Import control classes for instantiation
import { ColorControl } from './ColorControl.js';
import { DimmerControl } from './DimmerControl.js';
import { StrobeControl } from './StrobeControl.js';
import { SpeedControl } from './SpeedControl.js';
import { WhiteControl } from './WhiteControl.js';
import { AmberControl } from './AmberControl.js';
import { VolumeControl } from './VolumeControl.js';
import { SmokeControl } from './OutputControl.js';
import { FanControl } from './FanControl.js';
import { FlameControl } from './FlameControl.js';
import { SafetyControl } from './SafetyControl.js';
import { PanTiltControl } from './PanTiltControl.js';
import { PanTilt16Control } from './PanTilt16Control.js';

/**
 * Control Type Registry
 * Singleton instances of all controls
 * These are the ONLY instances - used for lookups throughout the app
 */
export const CONTROL_TYPES = {
	// Color control
	Color: new ColorControl(),

	// Single-channel controls
	Dimmer: new DimmerControl(),
	Strobe: new StrobeControl(),
	Speed: new SpeedControl(),
	White: new WhiteControl(),
	Amber: new AmberControl(),
	Volume: new VolumeControl(),
	Smoke: new SmokeControl(),
	Fan: new FanControl(),
	Flame: new FlameControl(),

	// Toggle controls
	Safety: new SafetyControl(),

	// Position controls
	PanTilt: new PanTiltControl(),
	PanTilt16: new PanTilt16Control()
};
