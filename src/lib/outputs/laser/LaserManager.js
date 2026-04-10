/**
 * Laser Manager
 *
 * Manages the shared SVG sampler and per-device ILDA DAC connections.
 * Each device with an ILDA control gets its own LaserRenderer (DAC + calibration).
 * The SVG sampler is shared — one SVG world, multiple projectors.
 * Multiple drawings are injected as separate SVG elements, controlled by CSS visibility.
 */

import { LaserRenderer } from './LaserRenderer.js';
import { SVGSampler } from './SVGSampler.js';
import { resolveEnv } from '../../env.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class LaserManager {
	constructor(deviceLibrary, drawingLibrary) {
		this.deviceLibrary = deviceLibrary;
		this.drawingLibrary = drawingLibrary;
		this.sampler = new SVGSampler();

		// Per-device renderers: Map<deviceId, LaserRenderer>
		this.renderers = new Map();

		// Per-device calibration mode: Map<deviceId, boolean>
		this.calibrating = new Map();

		this.container = null;
		this.svgElements = new Map(); // drawingId -> SVG element
		this.animationFrameId = null;
		this.lastSegments = [];

		this._frameLoop = this._frameLoop.bind(this);
	}

	/**
	 * Initialize with the sampler container element
	 */
	initialize(container) {
		this.container = container;

		// Inject all drawings
		this._injectAllDrawings();

		// Restore renderers for devices that have persisted ILDA settings
		this._restoreRenderers();

		this._startFrameLoop();
	}

	/**
	 * Connect a specific device to a Helios DAC via WebUSB picker
	 */
	async connect(deviceId) {
		let renderer = this.renderers.get(deviceId);
		if (!renderer) {
			renderer = new LaserRenderer();
			this.renderers.set(deviceId, renderer);
		}

		const device = this.deviceLibrary.get(deviceId);
		if (device?.ildaSettings) {
			if (device.ildaSettings.settings) {
				renderer.updateSettings(device.ildaSettings.settings);
			}
			if (device.ildaSettings.calibration) {
				renderer.calibration.fromJSON(device.ildaSettings.calibration);
			}
		}

		const result = await renderer.connect();
		if (result) {
			renderer.setEnabled(true);
			renderer.startSendLoop();
		}
		return result;
	}

	/**
	 * Disconnect a specific device's DAC
	 */
	async disconnect(deviceId) {
		const renderer = this.renderers.get(deviceId);
		if (renderer) {
			renderer.stopSendLoop();
			renderer.setEnabled(false);
			await renderer.disconnect();
		}
	}

	/**
	 * Check if a device is connected
	 */
	isDeviceConnected(deviceId) {
		const renderer = this.renderers.get(deviceId);
		return renderer?.device && !renderer.device.closed;
	}

	/**
	 * Get stats for a device
	 */
	getDeviceStats(deviceId) {
		const renderer = this.renderers.get(deviceId);
		return renderer?.stats || { framesPerSecond: 0, pointsPerFrame: 0, inputPoints: 0 };
	}

	/**
	 * Get settings for a device
	 */
	getDeviceSettings(deviceId) {
		const renderer = this.renderers.get(deviceId);
		return renderer?.settings || null;
	}

	/**
	 * Update settings for a device and persist
	 */
	updateDeviceSettings(deviceId, newSettings) {
		let renderer = this.renderers.get(deviceId);
		if (!renderer) {
			renderer = new LaserRenderer();
			this.renderers.set(deviceId, renderer);
		}
		renderer.updateSettings(newSettings);
		this._saveDeviceSettings(deviceId);
	}

	/**
	 * Update calibration for a device and persist
	 */
	updateDeviceCalibration(deviceId, corners, params = null) {
		const renderer = this.renderers.get(deviceId);
		if (renderer) {
			renderer.calibration.setCorners(corners);
		}

		if (params !== null) {
			const device = this.deviceLibrary.get(deviceId);
			const existing = device?.ildaSettings || {};
			this.deviceLibrary.update(deviceId, {
				ildaSettings: { ...existing, calibrationParams: params }
			});
		}

		this._saveDeviceSettings(deviceId);
	}

	/**
	 * Get persisted calibration params for a device
	 */
	getDeviceCalibrationParams(deviceId) {
		const device = this.deviceLibrary.get(deviceId);
		return device?.ildaSettings?.calibrationParams || null;
	}

	/**
	 * Reset calibration for a device
	 */
	resetDeviceCalibration(deviceId) {
		const renderer = this.renderers.get(deviceId);
		if (renderer) {
			renderer.calibration.reset();
			this._saveDeviceSettings(deviceId);
		}
	}

	/**
	 * Enter calibration mode for a device
	 */
	startCalibration(deviceId) {
		this.calibrating.set(deviceId, true);
	}

	/**
	 * Exit calibration mode for a device
	 */
	stopCalibration(deviceId) {
		this.calibrating.set(deviceId, false);
	}

	/**
	 * Get render pipeline stats (from preview renderer)
	 */
	getRendererStats() {
		const renderer = this._getPreviewRenderer();
		if (renderer.stats.pointsPerFrame > 0) {
			return renderer.stats;
		}
		return null;
	}

	/**
	 * Get the last processed frame points for preview
	 */
	getProcessedPoints() {
		const renderer = this._getPreviewRenderer();
		return renderer.lastProcessedPoints;
	}

	/**
	 * Get point budget info
	 */
	getPointBudget() {
		let renderer = this.renderers.values().next().value;
		if (!renderer) renderer = this._previewRenderer;
		if (!renderer) return { target: 0, budget: 0, overhead: 0 };

		const pps = renderer.settings.pps || 30000;
		const fps = renderer.settings.targetFps || 30;
		const targetPoints = Math.min(Math.floor(pps / fps), 4096);
		const segmentCount = this.lastSegments.length;
		const overhead = segmentCount * (renderer.settings.blankingPoints + renderer.settings.blankingDwell * 2 + renderer.settings.cornerDwell * 2);
		const budget = Math.max(20, targetPoints - overhead);

		return { target: targetPoints, budget, overhead };
	}

	/**
	 * Sample a specific drawing by ID for preview.
	 * Uses a separate hidden container so CSS visibility doesn't interfere.
	 * Keeps the SVG injected for continuous sampling (animations).
	 */
	sampleDrawing(drawingId) {
		// Ensure we have a preview container
		if (!this._previewContainer) {
			this._previewContainer = document.createElement('div');
			this._previewContainer.style.position = 'absolute';
			this._previewContainer.style.left = '-9999px';
			this._previewContainer.style.top = '-9999px';
			this._previewContainer.style.pointerEvents = 'none';
			document.body.appendChild(this._previewContainer);
			this._previewSampler = new SVGSampler();
			this._previewSampler.setContainer(this._previewContainer);
			this._previewDrawingId = null;
		}

		// Only re-inject if the drawing changed
		if (this._previewDrawingId !== drawingId) {
			this._previewDrawingId = drawingId;
			this._previewContainer.innerHTML = '';

			const drawing = this.drawingLibrary.get(drawingId);
			if (!drawing || !drawing.content?.trim()) return [];

			const trimmed = resolveEnv(drawing.content.trim());
			let svgMarkup;

			if (trimmed.startsWith('<svg')) {
				svgMarkup = trimmed;
			} else if (trimmed.includes('<')) {
				svgMarkup = `<svg xmlns="${SVG_NS}">${trimmed}</svg>`;
			} else {
				svgMarkup = `<svg xmlns="${SVG_NS}"><path d="${trimmed}" fill="none" stroke="green"/></svg>`;
			}

			try {
				const parser = new DOMParser();
				const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
				if (doc.querySelector('parsererror')) return [];

				const svgElement = document.importNode(doc.documentElement, true);
				this._previewContainer.appendChild(svgElement);

				if (!svgElement.getAttribute('viewBox')) {
					this._autoSetViewBox(svgElement);
				}
			} catch (e) {
				return [];
			}
		}

		// Sample the current state (picks up CSS animations)
		return this._previewSampler.sampleFrame();
	}

	/**
	 * Invalidate the preview cache so it re-injects on next sample.
	 * Called when drawing content changes.
	 */
	invalidatePreviewCache() {
		this._previewDrawingId = null;
	}

	/**
	 * Get reference grid points (square + crosshair) transformed through calibration.
	 * Returns array of {x, y} in DAC 0-1 space for preview rendering.
	 */
	getReferenceGrid() {
		const renderer = this._getPreviewRenderer();

		const segments = [];
		const border = 1.0;
		const steps = 20;

		// Square
		const corners = [
			[-border, -border], [border, -border],
			[border, border], [-border, border], [-border, -border]
		];
		const square = [];
		for (let c = 0; c < corners.length - 1; c++) {
			for (let s = 0; s <= steps; s++) {
				const t = s / steps;
				const x = corners[c][0] + (corners[c + 1][0] - corners[c][0]) * t;
				const y = corners[c][1] + (corners[c + 1][1] - corners[c][1]) * t;
				const dac = renderer.virtualToLaser(x, y);
				square.push({ x: dac.x / 4095, y: dac.y / 4095 });
			}
		}
		segments.push(square);

		// Horizontal cross line
		const hLine = [];
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const x = -border + t * border * 2;
			const dac = renderer.virtualToLaser(x, 0);
			hLine.push({ x: dac.x / 4095, y: dac.y / 4095 });
		}
		segments.push(hLine);

		// Vertical cross line
		const vLine = [];
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const y = -border + t * border * 2;
			const dac = renderer.virtualToLaser(0, y);
			vLine.push({ x: dac.x / 4095, y: dac.y / 4095 });
		}
		segments.push(vLine);

		return segments;
	}

	// ---- Drawing Management ----

	/**
	 * Re-inject all drawings from the library into the container.
	 * Called when drawings are added, removed, or their content changes.
	 */
	updateDrawings() {
		this._injectAllDrawings();
		this.invalidatePreviewCache();
	}

	/**
	 * Inject all drawings from the library as SVG elements
	 */
	_injectAllDrawings() {
		if (!this.container) return;

		// Remove existing SVG elements
		for (const el of this.svgElements.values()) {
			el.remove();
		}
		this.svgElements.clear();

		// Set the sampler's container
		this.sampler.setContainer(this.container);

		// Inject each drawing
		const drawings = this.drawingLibrary.getAll();
		for (const drawing of drawings) {
			this._injectDrawing(drawing);
		}
	}

	/**
	 * Inject a single drawing as an SVG element
	 */
	_injectDrawing(drawing) {
		if (!this.container || !drawing.content?.trim()) return;

		const trimmed = resolveEnv(drawing.content.trim());
		let svgMarkup;

		if (trimmed.startsWith('<svg')) {
			svgMarkup = trimmed;
		} else if (trimmed.includes('<')) {
			svgMarkup = `<svg xmlns="${SVG_NS}">${trimmed}</svg>`;
		} else {
			svgMarkup = `<svg xmlns="${SVG_NS}"><path d="${trimmed}" fill="none" stroke="green"/></svg>`;
		}

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
			const parsedSvg = doc.documentElement;

			const parseError = doc.querySelector('parsererror');
			if (parseError) {
				console.warn(`SVG parse error for drawing "${drawing.name}":`, parseError.textContent);
				return;
			}

			const svgElement = document.importNode(parsedSvg, true);

			// Set id from cssIdentifier
			svgElement.id = drawing.cssIdentifier;

			// Set default class if applicable
			if (drawing.isDefault) {
				svgElement.classList.add('default');
			}

			this.container.appendChild(svgElement);

			// Auto-detect viewBox if not set
			if (!svgElement.getAttribute('viewBox')) {
				this._autoSetViewBox(svgElement);
			}

			this.svgElements.set(drawing.id, svgElement);
		} catch (error) {
			console.warn(`Failed to inject drawing "${drawing.name}":`, error);
		}
	}

	_autoSetViewBox(svgElement) {
		try {
			const bbox = svgElement.getBBox();
			if (bbox.width > 0 && bbox.height > 0) {
				const margin = Math.max(bbox.width, bbox.height) * 0.05;
				const vb = `${(bbox.x - margin).toFixed(2)} ${(bbox.y - margin).toFixed(2)} ${(bbox.width + margin * 2).toFixed(2)} ${(bbox.height + margin * 2).toFixed(2)}`;
				svgElement.setAttribute('viewBox', vb);
			}
		} catch (e) {
			// getBBox can fail if SVG has no renderable content
		}
	}

	// ---- Frame Loop ----

	/**
	 * Frame loop — samples SVG once, runs render pipeline for preview,
	 * and sends to connected DACs.
	 */
	_frameLoop() {
		// Always sample for preview
		this.lastSegments = this.sampler.sampleFrame();

		// Process segments on all renderers (connected or preview-only)
		for (const [deviceId, renderer] of this.renderers) {
			if (renderer.settings.enabled === false) {
				// Disabled — clear output so preview shows nothing
				renderer.processSegments([]);
				continue;
			}

			if (this.calibrating.get(deviceId)) {
				const points = renderer.generateTestPattern();
				const result = renderer.convertTraceToLaserPoints(points, null, {
					velocityDimming: 0, basePower: 1.0
				});
				renderer.lastFrame = result.points.length > 4096
					? result.points.slice(0, 4096) : result.points;
			} else {
				renderer.processSegments(this.lastSegments);
			}
		}

		// If no renderers exist, use standalone preview renderer
		if (this.renderers.size === 0) {
			this._getPreviewRenderer().processSegments(this.lastSegments);
		}

		this.animationFrameId = requestAnimationFrame(this._frameLoop);
	}

	/**
	 * Get or create the renderer used for preview processing
	 */
	_getPreviewRenderer() {
		const first = this.renderers.values().next().value;
		if (first) return first;

		if (!this._previewRenderer) {
			this._previewRenderer = new LaserRenderer();
		}
		return this._previewRenderer;
	}

	_startFrameLoop() {
		if (!this.animationFrameId) {
			this._frameLoop();
		}
	}

	_stopFrameLoop() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	// ---- Persistence ----

	/**
	 * Persist ILDA settings for a device into DeviceLibrary
	 */
	_saveDeviceSettings(deviceId) {
		const renderer = this.renderers.get(deviceId);
		if (!renderer) return;

		const device = this.deviceLibrary.get(deviceId);
		const existing = device?.ildaSettings || {};

		const ildaSettings = {
			...existing,
			settings: { ...renderer.settings },
			calibration: renderer.calibration.toJSON()
		};

		this.deviceLibrary.update(deviceId, { ildaSettings });
	}

	/**
	 * Restore renderers with persisted settings for all ILDA devices
	 */
	_restoreRenderers() {
		if (!this.deviceLibrary) return;

		for (const device of this.deviceLibrary.getAll()) {
			if (device.ildaSettings) {
				const renderer = new LaserRenderer();
				if (device.ildaSettings.settings) {
					renderer.updateSettings(device.ildaSettings.settings);
				}
				if (device.ildaSettings.calibration) {
					renderer.calibration.fromJSON(device.ildaSettings.calibration);
				}
				this.renderers.set(device.id, renderer);
			}
		}
	}

	destroy() {
		this._stopFrameLoop();
		for (const el of this.svgElements.values()) {
			el.remove();
		}
		this.svgElements.clear();
		if (this._previewContainer) {
			this._previewContainer.remove();
			this._previewContainer = null;
		}
		for (const renderer of this.renderers.values()) {
			renderer.destroy();
		}
		this.renderers.clear();
	}
}
