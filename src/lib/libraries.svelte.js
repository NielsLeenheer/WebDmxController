/**
 * Centralized library instances
 * All libraries are instantiated here and exported as reactive $state objects
 * Components can import and use them directly without prop drilling
 */

import { DeviceLibrary } from './outputs/DeviceLibrary.svelte.js';
import { AnimationLibrary } from './animations/AnimationLibrary.svelte.js';
import { InputLibrary } from './inputs/InputLibrary.svelte.js';
import { TriggerLibrary } from './triggers/TriggerLibrary.svelte.js';

// Create singleton instances
export const deviceLibrary = new DeviceLibrary();
export const animationLibrary = new AnimationLibrary();
export const inputLibrary = new InputLibrary();
export const triggerLibrary = new TriggerLibrary();
