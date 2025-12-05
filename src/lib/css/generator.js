/**
 * CSS Generator
 *
 * Generates a complete CSS stylesheet from animations, inputs, triggers, devices, and scenes
 */

export class CSSGenerator {
	constructor(animationLibrary, inputLibrary, triggerLibrary, deviceLibrary, sceneLibrary) {
		this.animationLibrary = animationLibrary;
		this.inputLibrary = inputLibrary;
		this.triggerLibrary = triggerLibrary;
		this.deviceLibrary = deviceLibrary;
		this.sceneLibrary = sceneLibrary;
	}

	/**
	 * Generate complete CSS stylesheet
	 */
	generate(devices = []) {
		const parts = [];

		// Default device values
		const deviceDefaultsCSS = this.deviceLibrary.toCSS();
		if (deviceDefaultsCSS) {
			parts.push('/* Default values ================== */');
			parts.push('');
			parts.push(deviceDefaultsCSS);
			parts.push('');
		}

		// Animations (@keyframes)
		const animationsCSS = this.animationLibrary.toCSS();
		if (animationsCSS) {
			parts.push('/* Animations ================== */');
			parts.push('');
			parts.push(animationsCSS);
			parts.push('');
		}

		// Scenes (before triggers so triggers can override scene values)
		if (this.sceneLibrary) {
			const scenesCSS = this.sceneLibrary.toCSS(devices, this.animationLibrary);
			if (scenesCSS) {
				parts.push('/* Scenes ================== */');
				parts.push('');
				parts.push(scenesCSS);
				parts.push('');
			}
		}

		// Triggers (after scenes so they can override scene values)
		const triggersCSS = this.triggerLibrary.toCSS(devices, this.animationLibrary, this.inputLibrary);
		if (triggersCSS) {
			parts.push('/* Triggers ================== */');
			parts.push('');
			parts.push(triggersCSS);
			parts.push('');
		}

		// User customization section
		parts.push('/* Add your custom CSS below to override device defaults and apply animations */');
		return parts.join('\n');
	}
}
