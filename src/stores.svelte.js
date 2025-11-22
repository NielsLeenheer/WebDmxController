/**
 * Centralized library instances
 * All libraries are instantiated here and exported as reactive $state objects
 * Components can import and use them directly without prop drilling
 */

import { DeviceLibrary } from './lib/DeviceLibrary.svelte.js';
import { AnimationLibrary } from './lib/AnimationLibrary.svelte.js';
import { InputLibrary } from './lib/InputLibrary.svelte.js';
import { TriggerLibrary } from './lib/TriggerLibrary.svelte.js';

// Create singleton instances
export const deviceLibrary = new DeviceLibrary();
export const animationLibrary = new AnimationLibrary();
export const inputLibrary = new InputLibrary();
export const triggerLibrary = new TriggerLibrary();
