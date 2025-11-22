/**
 * CSS Manager
 *
 * Centralized service for managing CSS-based DMX control:
 * - Creates and manages animation target elements
 * - Generates and applies CSS to DOM
 * - Samples CSS computed styles in a continuous loop
 * - Publishes sampled values to subscribers
 */

import './properties.css';
import { CSSGenerator } from './generator.js';
import { CSSSampler } from './sampler.js';

export class CSSManager {
	// Reactive devices array
	devices = $state.raw([]);

	constructor(deviceLibrary, animationLibrary, inputLibrary, triggerLibrary, triggerManager) {
		this.deviceLibrary = deviceLibrary;
		this.animationLibrary = animationLibrary;
		this.inputLibrary = inputLibrary;
		this.triggerLibrary = triggerLibrary;
		this.triggerManager = triggerManager;

		this.cssGenerator = new CSSGenerator(animationLibrary, inputLibrary, triggerLibrary, deviceLibrary);
		this.cssSampler = new CSSSampler();

		// DOM elements
		this.animationTargetsContainer = null;
		this.triggerClassesContainer = null;
		this.styleElement = null;

		// CSS content
		this._generatedCSS = '';
		this._customCSS = this.loadCustomCSS();

		// Sampling loop
		this.animationFrameId = null;
		this.subscribers = new Set();

		// Bind methods
		this.sampleLoop = this.sampleLoop.bind(this);
	}

	/**
	 * Initialize the CSS manager and attach to DOM
	 */
	initialize(parentElement) {
		if (!parentElement) {
			throw new Error('CSSManager requires a parent element');
		}

		// Create animation-targets container
		this.animationTargetsContainer = document.createElement('div');
		this.animationTargetsContainer.className = 'animation-targets';
		this.animationTargetsContainer.style.position = 'absolute';
		this.animationTargetsContainer.style.left = '-9999px';
		this.animationTargetsContainer.style.top = '-9999px';
		this.animationTargetsContainer.style.pointerEvents = 'none';
		parentElement.appendChild(this.animationTargetsContainer);

		// Create inner trigger-classes container
		this.triggerClassesContainer = document.createElement('div');
		this.triggerClassesContainer.className = 'trigger-classes';
		this.animationTargetsContainer.appendChild(this.triggerClassesContainer);

		// Initialize CSS sampler
		this.cssSampler.initialize(this.triggerClassesContainer);

		// Set trigger manager container
		if (this.triggerManager) {
			this.triggerManager.setContainer(this.triggerClassesContainer);
		}

		// Create style element for animations/mappings/custom CSS
		this.styleElement = document.createElement('style');
		this.styleElement.id = 'css-animation-styles';
		document.head.appendChild(this.styleElement);

		// Watch device library changes
		$effect(() => {
			const devices = this.deviceLibrary.getAll();
			this.updateDevices(devices);
		});

		// Watch input library changes
		$effect(() => {
			this.inputLibrary.getAll(); // Track reactivity
			this.regenerateCSS();
			this.updateStyleElement();
		});

		// Watch trigger library changes
		$effect(() => {
			this.triggerLibrary.getAll(); // Track reactivity
			this.regenerateCSS();
			this.updateStyleElement();
		});

		// Watch animation library changes
		$effect(() => {
			this.animationLibrary.getAll(); // Track reactivity
			this.regenerateCSS();
			this.updateStyleElement();
		});

		// Start sampling loop
		this.startSampling();
	}

	/**
	 * Update devices and regenerate device elements
	 */
	updateDevices(devices) {
		this.devices = devices;
		this.cssSampler.updateDevices(devices);
		this.regenerateCSS();
		this.updateStyleElement();
	}

	/**
	 * Update custom CSS
	 */
	updateCustomCSS(css) {
		this._customCSS = css;
		localStorage.setItem('dmx-custom-css', css);
		this.updateStyleElement();
	}

	/**
	 * Get generated CSS (read-only)
	 * Dynamically generates CSS from current library state
	 */
	get generatedCSS() {
		return this.cssGenerator.generate(this.devices);
	}

	/**
	 * Get custom CSS (read-only)
	 */
	get customCSS() {
		return this._customCSS;
	}

	/**
	 * Subscribe to sampled CSS values
	 * @param {Function} callback - Called with sampledValues Map on each frame
	 * @returns {Function} Unsubscribe function
	 */
	subscribe(callback) {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	/**
	 * Load custom CSS from localStorage
	 */
	loadCustomCSS() {
		const saved = localStorage.getItem('dmx-custom-css');
		return saved || '/* Add your custom CSS here to override device defaults and apply animations */\n';
	}

	/**
	 * Regenerate CSS from current state
	 */
	regenerateCSS() {
		this._generatedCSS = this.cssGenerator.generate(this.devices);
	}

	/**
	 * Update style element with combined CSS
	 */
	updateStyleElement() {
		if (this.styleElement) {
			const combinedCSS = this._generatedCSS + '\n\n' + this._customCSS;
			this.styleElement.textContent = `@scope (.animation-targets) {\n${combinedCSS}\n}`;
		}
	}

	/**
	 * Start the CSS sampling loop
	 */
	startSampling() {
		if (!this.animationFrameId) {
			this.sampleLoop();
		}
	}

	/**
	 * Stop the CSS sampling loop
	 */
	stopSampling() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/**
	 * Sampling loop - runs continuously and publishes to subscribers
	 */
	sampleLoop() {
		// Sample all devices
		const sampledValues = this.cssSampler.sampleAll(this.devices);

		// Publish to all subscribers
		for (const callback of this.subscribers) {
			callback(sampledValues);
		}

		// Continue loop
		this.animationFrameId = requestAnimationFrame(this.sampleLoop);
	}

	/**
	 * Destroy the CSS manager and clean up
	 */
	destroy() {
		// Stop sampling
		this.stopSampling();

		// Remove DOM elements
		if (this.animationTargetsContainer && this.animationTargetsContainer.parentNode) {
			this.animationTargetsContainer.parentNode.removeChild(this.animationTargetsContainer);
		}

		if (this.styleElement && this.styleElement.parentNode) {
			this.styleElement.parentNode.removeChild(this.styleElement);
		}

		// Clear subscribers
		this.subscribers.clear();
	}
}
