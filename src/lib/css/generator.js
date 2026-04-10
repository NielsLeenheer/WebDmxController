/**
 * CSS Generator
 *
 * Generates a complete CSS stylesheet from animations, inputs, triggers, devices, and scenes
 */

export class CSSGenerator {
	constructor(animationLibrary, inputLibrary, triggerLibrary, deviceLibrary, sceneLibrary, drawingLibrary = null) {
		this.animationLibrary = animationLibrary;
		this.inputLibrary = inputLibrary;
		this.triggerLibrary = triggerLibrary;
		this.deviceLibrary = deviceLibrary;
		this.sceneLibrary = sceneLibrary;
		this.drawingLibrary = drawingLibrary;
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

		// Drawings (before scenes and triggers so they can override)
		if (this.drawingLibrary) {
			const drawingsCSS = this.drawingLibrary.toCSS();
			if (drawingsCSS) {
				parts.push('/* Drawings ================== */');
				parts.push('');
				parts.push(drawingsCSS);
				parts.push('');
			}
		}

		// Scenes (before triggers so triggers can override scene values)
		if (this.sceneLibrary) {
			const scenesCSS = this.sceneLibrary.toCSS(devices, this.animationLibrary, this.drawingLibrary);
			if (scenesCSS) {
				parts.push('/* Scenes ================== */');
				parts.push('');
				parts.push(scenesCSS);
				parts.push('');
			}
		}

		// Triggers (after scenes so they can override scene values)
		const triggersCSS = this.triggerLibrary.toCSS(devices, this.animationLibrary, this.inputLibrary, this.drawingLibrary);
		if (triggersCSS) {
			parts.push('/* Triggers ================== */');
			parts.push('');
			parts.push(triggersCSS);
			parts.push('');
		}

		return parts.join('\n');
	}
}
