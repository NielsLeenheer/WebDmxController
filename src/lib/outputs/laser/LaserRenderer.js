/**
 * Laser Renderer for SVG-to-laser output
 *
 * Converts normalized SVG geometry segments to ILDA laser format and sends to Helios DAC.
 * Ported from WebAudioOscilloscope, adapted for segment-based input.
 */

import { HeliosPoint, connectHeliosDevice, getHeliosDevices, HELIOS } from './HeliosDac.js';

/**
 * Trapezoid calibration for keystone correction
 * Transforms a unit square to an arbitrary quadrilateral using bilinear interpolation
 */
export class TrapezoidCalibration {
	constructor() {
		this.corners = {
			topLeft: { x: 0, y: 0 },
			topRight: { x: 1, y: 0 },
			bottomLeft: { x: 0, y: 1 },
			bottomRight: { x: 1, y: 1 }
		};

		this.coefficients = null;
		this.computeCoefficients();
	}

	setCorners(corners) {
		this.corners = { ...this.corners, ...corners };
		this.computeCoefficients();
	}

	computeCoefficients() {
		const { topLeft, topRight, bottomLeft, bottomRight } = this.corners;

		this.coefficients = {
			ax: topLeft.x,
			bx: topRight.x - topLeft.x,
			cx: bottomLeft.x - topLeft.x,
			dx: topLeft.x - topRight.x - bottomLeft.x + bottomRight.x,
			ay: topLeft.y,
			by: topRight.y - topLeft.y,
			cy: bottomLeft.y - topLeft.y,
			dy: topLeft.y - topRight.y - bottomLeft.y + bottomRight.y
		};
	}

	transform(x, y) {
		const { ax, bx, cx, dx, ay, by, cy, dy } = this.coefficients;

		return {
			x: ax + bx * x + cx * y + dx * x * y,
			y: ay + by * x + cy * y + dy * x * y
		};
	}

	reset() {
		this.corners = {
			topLeft: { x: 0, y: 0 },
			topRight: { x: 1, y: 0 },
			bottomLeft: { x: 0, y: 1 },
			bottomRight: { x: 1, y: 1 }
		};
		this.computeCoefficients();
	}

	toJSON() {
		return { corners: this.corners };
	}

	fromJSON(data) {
		if (data && data.corners) {
			this.setCorners(data.corners);
		}
	}
}

/**
 * Laser output renderer
 */
export class LaserRenderer {
	constructor() {
		this.device = null;
		this.calibration = new TrapezoidCalibration();

		this.calibrationParams = {
			rotate: 0,
			scale: 1.0,
			topBottom: 0,
			leftRight: 0
		};

		// Frame pacing
		this.lastFrameTime = 0;
		this.minFrameInterval = 20;
		this.pendingFrame = null;
		this.isSending = false;
		this._lastKeepaliveTime = 0;

		// Stats tracking
		this.framesSentThisSecond = 0;
		this.framesSkippedThisSecond = 0;
		this.lastStatsTime = 0;

		// Laser output settings
		this.settings = {
			pps: 30000,
			targetFps: 30,
			intensity: 1.0,
			color: { r: 0, g: 255, b: 0 },
			blankingPoints: 8,
			blankingDwell: 3,
			cornerDwell: 2,
			anchorDwell: 2,
			invertX: true,
			invertY: true,
			swapXY: false,
			safetyBorder: 0.05,
			pincushionH: 0.0,
			pincushionV: 0.0,
			offsetX: 0.0,
			offsetY: 0.0,
			// Moving-window rendering. When windowWidth < 1, each frame only
			// draws a sub-section of the path; the entire point budget is spent
			// on that slice, so detail goes up at the cost of flicker. The
			// window advances along the path by windowSpeed every frame and
			// wraps at the end.
			windowWidth: 1.0,
			windowSpeed: 0.0,
			// Galvo compensation techniques (all independently toggleable).
			//   cornerMode: how to handle sharp corners.
			//     'off'      — no extra dwell; fastest but rounded corners
			//     'binary'   — dwell `cornerDwell` samples when angle > 45°
			//     'weighted' — dwell scales continuously with angle sharpness
			//   velocityCap: split edges that exceed maxStepDac DAC units so
			//     the galvo's slew rate is never exceeded.
			cornerMode: 'binary',
			velocityCap: false,
			maxStepDac: 400,
			// Resampling-time corner bias. Controls how strongly sharp corners
			// attract sample points away from straight runs during the
			// resample step — independent of the DAC-level `cornerDwell`.
			//   cornerBias: weight multiplier for corner attraction (0 = pure
			//     arc-length sampling; higher values concentrate budget at
			//     corners at the expense of straight lines).
			//   cornerSharpness: exponent applied to the sharpness metric
			//     sin²(θ/2). At 1 it's linear — any bend matters. At 2+, only
			//     sharp corners matter; shallow bends are treated like straight.
			cornerBias: 3,
			cornerSharpness: 1
		};

		this._windowOffset = 0;

		// Latest SVG segments handed in from LaserManager's rAF loop; the send
		// loop picks these up just-in-time so the pipeline runs at DAC rate.
		this.pendingSegments = null;
		this.calibrationActive = false;

		// Where the galvo ends up after the most recently sent frame (in DAC
		// coordinates). Used to prepend blanking travel when the next frame
		// starts somewhere else, avoiding unintended lit strokes between frames.
		// Initialized to the DAC center which is where `reset()` leaves things
		// and where the idle-keepalive blank frame parks the mirror.
		this._lastFrameEndpoint = { x: 2048, y: 2048 };

		// The virtual-space position the galvo is at when the next frame
		// starts drawing. Used by the second-pass segment reordering below so
		// the first drawn segment is the one nearest the current beam position.
		this._lastVirtualStartPoint = { x: 0, y: 0 };

		this.enabled = false;
		this.lastFrame = [];
		this.frameCount = 0;
		this.onStatusChange = null;

		this.stats = {
			framesPerSecond: 0,
			pointsPerFrame: 0,
			inputPoints: 0,
			resampledPoints: 0,
			totalBeforeClamp: 0,
			drawingPoints: 0,
			blankingPoints: 0,
			cornerDwellPoints: 0,
			anchorDwellPoints: 0,
			targetPoints: 0,
			processMs: 0,
			sendMs: 0,
			statusMs: 0
		};

		// Last resampled points in virtual space (for preview)
		this.lastResampledPoints = [];
		// Last processed frame points in virtual space (includes blanking/dwell)
		this.lastProcessedPoints = [];
		// Parallel virtual-space point list for the settings-dialog preview —
		// same sample order as the DAC output, but without the per-device
		// calibration transform (so keystone doesn't warp the visualization).
		this.lastVirtualPlan = [];
		// Cached overhead from previous frame for single-pass optimization
		this._lastOverhead = 0;
	}

	static isSupported() {
		return 'usb' in navigator && window.isSecureContext;
	}

	async connect() {
		return this._connectWith(() => connectHeliosDevice());
	}

	/**
	 * Reconnect silently to a previously-authorized Helios device.
	 * Uses navigator.usb.getDevices() — no user picker.
	 * @returns {Promise<boolean>} True when a device was found and opened.
	 */
	async reconnectSilent() {
		return this._connectWith(async () => {
			const devices = await getHeliosDevices();
			return devices.length > 0 ? devices[0] : null;
		});
	}

	async _connectWith(acquireDevice) {
		try {
			this.emitStatus('connecting');
			this.device = await acquireDevice();

			if (!this.device) {
				console.log('[LaserRenderer] connect: no paired Helios device found');
				return false;
			}

			// Fresh connection: USB reset parks the galvo at center, and we
			// have no prior endpoint to travel from. Reset the tracker so the
			// first frame prepends blanking from center.
			this._lastFrameEndpoint = { x: 2048, y: 2048 };

			this.device.pps = this.settings.pps;
			this.device.onStatusChange = (status) => {
				if (this.onStatusChange) {
					this.onStatusChange(status);
				}
			};

			const result = await this.device.connect();
			if (result !== HELIOS.SUCCESS) {
				console.warn('[LaserRenderer] Device connect returned non-success:', result);
				try { await this.device.close(); } catch {}
				this.device = null;
				return false;
			}

			this.emitStatus('connected', {
				name: this.device.name,
				firmware: this.device.firmwareVersion
			});
			return true;
		} catch (error) {
			console.error('[LaserRenderer] Failed to connect:', error);
			this.emitStatus('error', { error: error.message });
			this.device = null;
			return false;
		}
	}

	async getAvailableDevices() {
		return getHeliosDevices();
	}

	async disconnect() {
		if (this.device) {
			await this.device.close();
			this.device = null;
			this.enabled = false;
			this.emitStatus('disconnected');
		}
	}

	setEnabled(enabled) {
		this.enabled = enabled && this.device && !this.device.closed;
		this.emitStatus(enabled ? 'enabled' : 'disabled');
	}

	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings };
		if (this.device) {
			this.device.pps = this.settings.pps;
		}
	}

	emitStatus(status, data = {}) {
		if (this.onStatusChange) {
			this.onStatusChange({ status, ...data });
		}
	}

	isReady() {
		return this.device && !this.device.closed && this.enabled;
	}

	/**
	 * Convert virtual coordinates (-1 to 1) to laser DAC coordinates (0-4095)
	 * Applies calibration transformation
	 */
	virtualToLaser(x, y) {
		const { invertX, invertY, swapXY, safetyBorder, pincushionH, pincushionV, offsetX, offsetY } = this.settings;

		x += offsetX;
		y += offsetY;

		let nx = (x + 1) / 2;
		let ny = (y + 1) / 2;

		if (pincushionH !== 0 || pincushionV !== 0) {
			const cx = nx - 0.5;
			const cy = ny - 0.5;
			const r2 = cx * cx + cy * cy;
			nx = 0.5 + cx * (1 + pincushionH * r2 * 0.4);
			ny = 0.5 + cy * (1 + pincushionV * r2 * 0.4);
		}

		if (invertX) nx = 1 - nx;
		if (invertY) ny = 1 - ny;

		if (swapXY) {
			[nx, ny] = [ny, nx];
		}

		const range = 1 - 2 * safetyBorder;
		nx = safetyBorder + nx * range;
		ny = safetyBorder + ny * range;

		const calibrated = this.calibration.transform(nx, ny);

		return {
			x: Math.max(0, Math.min(4095, Math.round(calibrated.x * 4095))),
			y: Math.max(0, Math.min(4095, Math.round(calibrated.y * 4095)))
		};
	}

	/**
	 * Generate blanking points to travel from one position to another.
	 * Travel-point count and dwell scale down for short hops (e.g. clipping-induced
	 * sub-segment breaks), keeping the per-break overhead from dominating the budget.
	 *
	 * If virtual-space from/to are provided via `virtualFrom`/`virtualTo`, a
	 * parallel virtual-space blanking sequence is also built and returned
	 * alongside the DAC one — used for the dialog visualization which needs
	 * pre-calibration coordinates.
	 */
	generateBlanking(fromX, fromY, toX, toY, virtualFrom = null, virtualTo = null) {
		const points = [];
		const virtualPoints = (virtualFrom && virtualTo) ? [] : null;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		const maxCount = this.settings.blankingPoints;
		const fullDwell = this.settings.blankingDwell;

		const count = dist < 400
			? Math.max(1, Math.round(dist / 100))
			: Math.max(0, maxCount);
		const shortHop = dist < 200;
		// Dwell can be 0 — the user is telling us not to pad before/after
		// blanking travel. For short hops we still force 1 so the laser has
		// a beat to turn off and arrive.
		const turnOffDwell = shortHop ? 1 : Math.max(0, Math.floor(fullDwell / 2));
		const endDwell = shortHop ? 1 : Math.max(0, fullDwell);

		const vdx = virtualPoints ? virtualTo.x - virtualFrom.x : 0;
		const vdy = virtualPoints ? virtualTo.y - virtualFrom.y : 0;
		const pushVirt = (x, y, kind) => { virtualPoints.push({ x, y, r: 0, g: 0, b: 0, blank: true, kind }); };

		for (let i = 0; i < turnOffDwell; i++) {
			points.push(HeliosPoint.blank(fromX, fromY));
			if (virtualPoints) pushVirt(virtualFrom.x, virtualFrom.y, 'bdwell');
		}

		// Skip the interpolation loop entirely when count=0 (user explicitly
		// opted out of blanking travel) — t = i/0 would otherwise be NaN.
		if (count > 0) {
			// Accel-then-decel blanking profile: all available samples are
			// spent ramping velocity up from rest over a fixed physical
			// distance at the start, and ramping back down to rest over the
			// same distance at the end. The cruise region between them gets
			// no samples — the galvo is already moving at peak velocity and
			// drifts across it in a single DAC sample period. For travels
			// shorter than 2 × ACCEL_DIST the two ramps meet in the middle
			// with no gap.
			const ACCEL_DIST = 250;
			const easeFrac = Math.min(0.5, ACCEL_DIST / Math.max(dist, 1));

			const nTotal = count + 1;
			const nAccel = Math.ceil(nTotal / 2);
			const nDecel = nTotal - nAccel;

			for (let i = 0; i < nAccel; i++) {
				const tLocal = nAccel > 1 ? i / (nAccel - 1) : 0;
				// Quadratic position with zero starting velocity — position
				// grows like tLocal² up to easeFrac by the end of the ramp.
				const s = easeFrac * tLocal * tLocal;
				points.push(HeliosPoint.blank(fromX + dx * s, fromY + dy * s));
				if (virtualPoints) pushVirt(virtualFrom.x + vdx * s, virtualFrom.y + vdy * s, 'travel');
			}
			for (let j = 0; j < nDecel; j++) {
				const tLocal = nDecel > 1 ? j / (nDecel - 1) : 1;
				// Mirror of the accel ramp: position starts at 1 − easeFrac,
				// decelerates to 1 with zero velocity.
				const u = 1 - tLocal;
				const s = 1 - easeFrac * u * u;
				points.push(HeliosPoint.blank(fromX + dx * s, fromY + dy * s));
				if (virtualPoints) pushVirt(virtualFrom.x + vdx * s, virtualFrom.y + vdy * s, 'travel');
			}
		}

		for (let i = 0; i < endDwell; i++) {
			points.push(HeliosPoint.blank(toX, toY));
			if (virtualPoints) pushVirt(virtualTo.x, virtualTo.y, 'bdwell');
		}

		return virtualPoints ? { points, virtualPoints } : points;
	}

	/**
	 * Convert normalized point segments to laser points
	 * Each point: { x, y, r?, g?, b?, opacity?, segmentStart? }
	 * Coordinates in virtual space (-1 to 1)
	 */
	convertTraceToLaserPoints(points, params = {}) {
		if (!points || points.length < 2) return { points: [], counts: { drawing: 0, blanking: 0, cornerDwell: 0, anchorDwell: 0 }, virtualPlan: [] };

		const { basePower = 1.0, startFromPoint = null, startFromVirtualPoint = null } = params;

		const laserPoints = [];
		// Parallel virtual-space point list for the dialog visualization. Each
		// entry mirrors its DAC counterpart in laserPoints, but without the
		// per-device calibration transform applied. Coordinates are in the
		// same [-1, 1] virtual frame the SVG sampler uses.
		const virtualPlan = [];
		const { color, intensity, cornerDwell } = this.settings;
		const counts = { drawing: 0, blanking: 0, cornerDwell: 0, anchorDwell: 0 };

		let prevLaserPoint = null;
		let prevVirtualXY = null; // { x, y } in virtual space of last drawing position
		let prevVirtColor = { r: color.r, g: color.g, b: color.b };
		let prevVirtual = null;
		let lastWasBlank = true;
		let lastBlankWasShort = false;

		// If the previous frame left the galvo somewhere other than this
		// frame's first drawing position, prepend blanking travel so the
		// mirror moves with the laser off. The closing blanking at the end
		// of the frame naturally loops back to laserPoints[0] — which, after
		// the prepend, is the blank-travel start point — so re-plays of the
		// looped frame stay in sync with the mirror position.
		if (startFromPoint && points.length > 0) {
			const firstCoords = this.virtualToLaser(points[0].x, points[0].y);
			if (startFromPoint.x !== firstCoords.x || startFromPoint.y !== firstCoords.y) {
				const virtStart = startFromVirtualPoint || { x: 0, y: 0 };
				const virtEnd = { x: points[0].x, y: points[0].y };
				const travel = this.generateBlanking(
					startFromPoint.x, startFromPoint.y,
					firstCoords.x, firstCoords.y,
					virtStart, virtEnd
				);
				laserPoints.push(...travel.points);
				virtualPlan.push(...travel.virtualPoints);
				counts.blanking += travel.points.length;
				prevLaserPoint = travel.points[travel.points.length - 1];
				prevVirtualXY = virtEnd; // galvo ends at first-draw-virtual after prepend
				lastWasBlank = true;
			}
		}

		for (let i = 0; i < points.length; i++) {
			const pt = points[i];

			const laserCoords = this.virtualToLaser(pt.x, pt.y);

			const opacityFactor = pt.opacity !== undefined ? pt.opacity : 1;
			const pointIntensity = intensity * basePower * opacityFactor * 255;

			// segmentStart is already set correctly by the SVG sampler (including
			// for sub-segments produced by viewport clipping), so we only blank
			// on explicit breaks — never on large legitimate L-to-L moves inside
			// one continuous path.
			const needsBlanking = pt.segmentStart || i === 0;

			if (needsBlanking && prevLaserPoint && !lastWasBlank) {
				// Short hops (e.g. clipping-induced sub-segment breaks) barely move
				// the galvo, so the anchor dwell can shrink to a single point.
				const hopDx = laserCoords.x - prevLaserPoint.x;
				const hopDy = laserCoords.y - prevLaserPoint.y;
				const shortHop = Math.sqrt(hopDx * hopDx + hopDy * hopDy) < 200;

				const anchorCount = shortHop ? 1 : this.settings.anchorDwell;
				for (let d = 0; d < anchorCount; d++) {
					laserPoints.push(prevLaserPoint);
					if (prevVirtualXY) virtualPlan.push({ x: prevVirtualXY.x, y: prevVirtualXY.y, r: prevVirtColor.r, g: prevVirtColor.g, b: prevVirtColor.b, blank: false, kind: 'anchor' });
					counts.anchorDwell++;
				}
				// Blanking travel
				const fromV = prevVirtualXY || { x: 0, y: 0 };
				const toV = { x: pt.x, y: pt.y };
				const blanking = this.generateBlanking(
					prevLaserPoint.x, prevLaserPoint.y,
					laserCoords.x, laserCoords.y,
					fromV, toV
				);
				laserPoints.push(...blanking.points);
				virtualPlan.push(...blanking.virtualPoints);
				counts.blanking += blanking.points.length;
				lastWasBlank = true;
				lastBlankWasShort = shortHop;
			}

			// Corner detection — angle between incoming and outgoing edges.
			let cornerAngle = 0;
			if (i > 0 && i < points.length - 1 && !lastWasBlank) {
				const prev = points[i - 1];
				const next = points[i + 1];
				const raw = Math.abs(
					Math.atan2(next.y - pt.y, next.x - pt.x) -
					Math.atan2(pt.y - prev.y, pt.x - prev.x)
				);
				cornerAngle = Math.min(raw, Math.PI);
			}
			const cornerMode = this.settings.cornerMode || 'binary';
			const isCorner = cornerMode !== 'off' && cornerAngle > Math.PI / 4;

			const ptColor = pt.r !== undefined ? pt : color;
			const laserPoint = new HeliosPoint(
				laserCoords.x,
				laserCoords.y,
				Math.round(ptColor.r * pointIntensity / 255),
				Math.round(ptColor.g * pointIntensity / 255),
				Math.round(ptColor.b * pointIntensity / 255),
				Math.round(pointIntensity)
			);

			let dwellCount;
			let dwellKind;
			if (lastWasBlank) {
				dwellCount = lastBlankWasShort ? 1 : this.settings.anchorDwell;
				dwellKind = 'anchor';
			} else if (cornerMode === 'weighted') {
				// sin²(θ/2) = (1 − cos θ) / 2: 0 for straight, 1 for reversal.
				const weight = (1 - Math.cos(cornerAngle)) / 2;
				dwellCount = Math.max(1, Math.round(cornerDwell * weight));
				dwellKind = dwellCount > 1 ? 'corner' : 'draw';
			} else if (cornerMode === 'binary') {
				dwellCount = isCorner ? cornerDwell : 1;
				dwellKind = isCorner ? 'corner' : 'draw';
			} else {
				dwellCount = 1;
				dwellKind = 'draw';
			}
			// Always emit at least one drawing sample — settings like
			// cornerDwell=0 are legal for dwell purposes but would otherwise
			// drop the drawing point entirely.
			dwellCount = Math.max(1, dwellCount);
			const virtColor = { r: ptColor.r, g: ptColor.g, b: ptColor.b };
			for (let d = 0; d < dwellCount; d++) {
				laserPoints.push(laserPoint);
				virtualPlan.push({ x: pt.x, y: pt.y, r: virtColor.r, g: virtColor.g, b: virtColor.b, blank: false, kind: dwellKind });
				if (d === 0) {
					counts.drawing++;
				} else if (lastWasBlank) {
					// Start-after-blanking dwell (galvo arrival settling) —
					// independent of corner handling, always anchor dwell.
					counts.anchorDwell++;
				} else if (cornerAngle > 0) {
					// Mid-segment extras only exist at a bend, so these are
					// genuine corner-dwell samples (binary mode only triggers
					// above 45°; weighted mode triggers at any non-zero angle).
					counts.cornerDwell++;
				} else {
					counts.anchorDwell++;
				}
			}

			prevLaserPoint = laserPoint;
			prevVirtual = pt;
			prevVirtualXY = { x: pt.x, y: pt.y };
			prevVirtColor = virtColor;
			lastWasBlank = laserPoint.isBlank();
		}

		// Close the frame
		if (laserPoints.length > 0 && prevLaserPoint) {
			const closingAnchor = this.settings.anchorDwell;
			for (let d = 0; d < closingAnchor; d++) {
				laserPoints.push(prevLaserPoint);
				if (prevVirtualXY) virtualPlan.push({ x: prevVirtualXY.x, y: prevVirtualXY.y, r: prevVirtColor.r, g: prevVirtColor.g, b: prevVirtColor.b, blank: false, kind: 'anchor' });
				counts.anchorDwell++;
			}
			const firstPoint = laserPoints[0];
			const firstVirt = virtualPlan[0] || { x: 0, y: 0 };
			const blanking = this.generateBlanking(
				prevLaserPoint.x, prevLaserPoint.y,
				firstPoint.x, firstPoint.y,
				prevVirtualXY || { x: 0, y: 0 }, firstVirt
			);
			laserPoints.push(...blanking.points);
			virtualPlan.push(...blanking.virtualPoints);
			counts.blanking += blanking.points.length;
		}

		return { points: laserPoints, counts, virtualPlan };
	}

	/**
	 * Process segments through the full render pipeline (resample + convert).
	 * Updates stats and lastResampledPoints. Returns the final HeliosPoints array.
	 */
	processSegments(segments) {
		if (!segments || segments.length === 0) {
			this.lastFrame = [];
			this.lastProcessedPoints = [];
			this.lastResampledPoints = [];
			this.lastVirtualPlan = [];
			// Zero the point-count stats so the dialog reflects "idle" rather
			// than whatever the last rendered frame happened to contain. The
			// keepalive send path will fill in the blanking count when it fires.
			this.stats.pointsPerFrame = 0;
			this.stats.inputPoints = 0;
			this.stats.resampledPoints = 0;
			this.stats.totalBeforeClamp = 0;
			this.stats.drawingPoints = 0;
			this.stats.blankingPoints = 0;
			this.stats.cornerDwellPoints = 0;
			this.stats.anchorDwellPoints = 0;
			this.stats.processMs = 0;
			return null;
		}
		const _t0 = performance.now();

		// Flatten segments into a single point array with segmentStart markers
		const points = [];
		for (const segment of segments) {
			for (let i = 0; i < segment.length; i++) {
				const pt = { ...segment[i] };
				if (i === 0) pt.segmentStart = true;
				points.push(pt);
			}
		}

		if (points.length < 2) return null;

		// Apply moving-window slicing before resampling so the whole point
		// budget concentrates on the visible slice.
		const windowed = this._applyWindow(points);
		if (windowed.length < 2) return null;

		// Second-pass beam-travel optimization: reorder the segments that
		// survived the window using nearest-neighbor from the current beam
		// position. The SVG sampler's first pass gives broad spatial coherence
		// (so the window tends to contain nearby segments); this pass uses the
		// actual galvo position at frame start to pick the starting segment
		// and minimize inter-segment jumps within the window.
		const reordered = this._reorderByBeamPosition(windowed, this._lastVirtualStartPoint);

		// Remember where this frame starts drawing — that's where the galvo
		// will be when the next frame begins (after the DAC's closing-blanking
		// loops back to it).
		if (reordered.length > 0) {
			this._lastVirtualStartPoint = { x: reordered[0].x, y: reordered[0].y };
		}

		const targetPoints = Math.min(Math.floor(this.settings.pps / (this.settings.targetFps || 30)), HELIOS.MAX_POINTS);
		this.stats.inputPoints = points.length;

		// Use cached overhead from previous frame for budget estimation.
		// This avoids a costly two-pass pipeline every frame.
		// The overhead is recalculated after conversion and cached for the next frame.
		const drawingBudget = Math.max(20, Math.floor((targetPoints - this._lastOverhead) * 0.98));
		const resampledPoints = this.resampleInputPoints(reordered, drawingBudget);
		this.lastResampledPoints = resampledPoints;

		const result = this.convertTraceToLaserPoints(resampledPoints, {
			basePower: 1.0,
			startFromPoint: this._lastFrameEndpoint,
			startFromVirtualPoint: this._lastVirtualStartPoint
		});

		if (result.points.length === 0) return null;

		this.lastVirtualPlan = result.virtualPlan || [];

		// Galvo compensation post-processing: velocity cap (insert
		// intermediate points so slew rate isn't exceeded).
		const finalPoints = this._applyVelocityCap(result.points);

		// Remember where this frame leaves the galvo so the next frame's
		// startFromPoint can prepend blanking if the start position differs.
		if (finalPoints.length > 0) {
			const tail = finalPoints[finalPoints.length - 1];
			this._lastFrameEndpoint = { x: tail.x, y: tail.y };
		}

		// Cache actual overhead for next frame's budget estimation
		this._lastOverhead = finalPoints.length - resampledPoints.length;

		this.lastFrame = finalPoints;
		this.stats.pointsPerFrame = finalPoints.length;
		this.stats.targetPoints = targetPoints;
		this.stats.resampledPoints = resampledPoints.length;
		this.stats.totalBeforeClamp = finalPoints.length;
		this.stats.drawingPoints = result.counts.drawing;
		this.stats.blankingPoints = result.counts.blanking;
		this.stats.cornerDwellPoints = result.counts.cornerDwell;
		this.stats.anchorDwellPoints = result.counts.anchorDwell;

		this.stats.processMs = performance.now() - _t0;

		// Build preview from DAC coordinates mapped to 0-1 range
		this.lastProcessedPoints = finalPoints.map(pt => ({
			x: pt.x / 4095,
			y: pt.y / 4095,
			r: pt.r, g: pt.g, b: pt.b,
			blank: pt.isBlank()
		}));

		return finalPoints;
	}

	/**
	 * Slice the point list to only what falls inside the current moving window.
	 * Does NOT advance the offset — that's done by `_advanceWindowOffset()`
	 * from the send loop, so each window position maps to exactly one frame
	 * that actually reaches the DAC. If the window covers the full path
	 * (width >= 1) this is a no-op passthrough. Inter-segment jumps contribute
	 * zero to the path length so window width is in terms of actually-drawn
	 * distance.
	 */
	_applyWindow(points) {
		const width = Math.max(0, Math.min(1, this.settings.windowWidth ?? 1));

		if (width >= 1) {
			this._windowOffset = 0;
			return points;
		}
		if (width <= 0) return [];

		// Cumulative arc length per input point; inter-segment jumps add zero.
		const cum = new Array(points.length);
		cum[0] = 0;
		for (let i = 1; i < points.length; i++) {
			if (points[i].segmentStart) {
				cum[i] = cum[i - 1];
			} else {
				const dx = points[i].x - points[i - 1].x;
				const dy = points[i].y - points[i - 1].y;
				cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dy * dy);
			}
		}
		const total = cum[cum.length - 1];
		if (total <= 0) return points;

		const offset = this._windowOffset % 1;
		const startLen = offset * total;
		const endLen = startLen + width * total;

		if (endLen <= total) {
			return this._sliceByLength(points, cum, startLen, endLen);
		}
		// Window wraps past the end: emit two sub-windows with a pen-up between.
		const head = this._sliceByLength(points, cum, startLen, total);
		const tail = this._sliceByLength(points, cum, 0, endLen - total);
		if (head.length === 0) return tail;
		if (tail.length === 0) return head;
		// First point of the second slice must mark a new segment so the
		// converter blanks across the wrap.
		tail[0] = { ...tail[0], segmentStart: true };
		return head.concat(tail);
	}

	/**
	 * Advance the moving-window offset. Called by the send loop after a
	 * successful frame so the offset steps once per DAC frame, not once per
	 * rAF tick (which is faster than the DAC can consume and would drop
	 * intermediate window positions).
	 */
	_advanceWindowOffset() {
		const width = Math.max(0, Math.min(1, this.settings.windowWidth ?? 1));
		if (width >= 1) return;
		const speed = Math.max(0, this.settings.windowSpeed ?? 0);
		if (speed <= 0) return;
		this._windowOffset = (this._windowOffset + speed) % 1;
		if (!Number.isFinite(this._windowOffset)) this._windowOffset = 0;
	}

	/**
	 * Greedy nearest-neighbor reordering of the segments in `points`, using
	 * `startPoint` (virtual space) as the starting beam position. At each
	 * step we pick the unvisited segment whose nearer endpoint is closest to
	 * the current beam position; if that endpoint is the segment's tail we
	 * reverse it in place so the path joins cleanly.
	 *
	 * Complements the broader spatial ordering done in SVGSampler — that pass
	 * ensures the window slice contains spatially-coherent segments; this
	 * pass minimizes inter-segment jumps within the slice given the beam's
	 * actual starting position.
	 */
	_reorderByBeamPosition(points, startPoint) {
		if (points.length < 2) return points;

		// Split the flat point array back into segments by segmentStart markers.
		const segments = [];
		let current = null;
		for (const pt of points) {
			if (pt.segmentStart || current === null) {
				if (current && current.length >= 2) segments.push(current);
				current = [];
			}
			current.push(pt);
		}
		if (current && current.length >= 2) segments.push(current);
		if (segments.length <= 1) return points;

		// Greedy nearest-neighbor with optional segment reversal.
		const ordered = [];
		const remaining = segments.slice();
		let curX = startPoint?.x ?? 0;
		let curY = startPoint?.y ?? 0;

		while (remaining.length > 0) {
			let bestIdx = 0;
			let bestDist = Infinity;
			let bestReverse = false;
			for (let i = 0; i < remaining.length; i++) {
				const seg = remaining[i];
				const head = seg[0];
				const tail = seg[seg.length - 1];
				const dHead = (head.x - curX) ** 2 + (head.y - curY) ** 2;
				const dTail = (tail.x - curX) ** 2 + (tail.y - curY) ** 2;
				if (dHead < bestDist) { bestDist = dHead; bestIdx = i; bestReverse = false; }
				if (dTail < bestDist) { bestDist = dTail; bestIdx = i; bestReverse = true; }
			}
			let picked = remaining.splice(bestIdx, 1)[0];
			if (bestReverse) picked = picked.slice().reverse();
			ordered.push(picked);
			const last = picked[picked.length - 1];
			curX = last.x;
			curY = last.y;
		}

		// Flatten back to a single point array with segmentStart markers on
		// the first point of each segment.
		const result = [];
		for (const seg of ordered) {
			for (let i = 0; i < seg.length; i++) {
				result.push({ ...seg[i], segmentStart: i === 0 });
			}
		}
		return result;
	}

	/**
	 * Return the slice of `points` whose cumulative arc length falls in
	 * [loLen, hiLen], interpolating entry and exit points to hit the
	 * boundaries exactly. The returned first point is marked segmentStart so
	 * the converter draws the slice as its own stroke. Inner segment breaks
	 * are preserved so the converter blanks across them too.
	 */
	_sliceByLength(points, cum, loLen, hiLen) {
		if (hiLen <= loLen) return [];

		const interp = (a, b, t) => {
			const pt = {
				x: a.x + (b.x - a.x) * t,
				y: a.y + (b.y - a.y) * t
			};
			if (a.r !== undefined) {
				pt.r = Math.round(a.r + ((b.r ?? a.r) - a.r) * t);
				pt.g = Math.round(a.g + ((b.g ?? a.g) - a.g) * t);
				pt.b = Math.round(a.b + ((b.b ?? a.b) - a.b) * t);
			}
			if (a.opacity !== undefined) {
				pt.opacity = a.opacity + ((b.opacity ?? a.opacity) - a.opacity) * t;
			}
			return pt;
		};

		const out = [];
		for (let i = 0; i < points.length; i++) {
			const c = cum[i];

			if (c < loLen) continue;

			if (c <= hiLen) {
				// First in-range point — interpolate entry if the window
				// started partway through the edge leading to this point.
				if (out.length === 0 && i > 0) {
					const prev = cum[i - 1];
					const edgeLen = c - prev;
					if (!points[i].segmentStart && edgeLen > 0 && loLen > prev) {
						const t = (loLen - prev) / edgeLen;
						const entry = interp(points[i - 1], points[i], t);
						entry.segmentStart = true;
						out.push(entry);
					}
				}
				const copy = { ...points[i] };
				if (out.length === 0) copy.segmentStart = true;
				out.push(copy);
				continue;
			}

			// c > hiLen: window ended on the edge leading into this point.
			if (out.length > 0) {
				const prev = cum[i - 1];
				const edgeLen = c - prev;
				if (!points[i].segmentStart && edgeLen > 0 && prev < hiLen) {
					const t = (hiLen - prev) / edgeLen;
					out.push(interp(points[i - 1], points[i], t));
				}
			}
			break;
		}
		return out;
	}

	/**
	 * Velocity cap: if any two consecutive laser points are further apart than
	 * `maxStepDac` DAC units, insert evenly-spaced intermediate points between
	 * them so the galvo's slew rate is never exceeded. Intermediate points
	 * inherit the colour/intensity of the destination point.
	 */
	_applyVelocityCap(laserPoints) {
		if (!this.settings.velocityCap || laserPoints.length < 2) return laserPoints;
		const maxStep = Math.max(50, this.settings.maxStepDac || 400);

		const result = [laserPoints[0]];
		for (let i = 1; i < laserPoints.length; i++) {
			const prev = laserPoints[i - 1];
			const cur = laserPoints[i];
			const dx = cur.x - prev.x;
			const dy = cur.y - prev.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist > maxStep) {
				const steps = Math.ceil(dist / maxStep);
				for (let s = 1; s < steps; s++) {
					const t = s / steps;
					result.push(new HeliosPoint(
						prev.x + dx * t,
						prev.y + dy * t,
						cur.r, cur.g, cur.b, cur.i
					));
				}
			}
			result.push(cur);
		}
		return result;
	}

	/**
	 * Start the async send loop.
	 * Runs independently from rAF, polling the DAC as fast as it can accept frames.
	 * Reads the latest processed frame from lastFrame.
	 */
	startSendLoop() {
		if (this._sendLoopRunning) return;
		this._sendLoopRunning = true;
		this._runSendLoop();
	}

	stopSendLoop() {
		this._sendLoopRunning = false;
	}

	async _runSendLoop() {
		const MAX_CONSECUTIVE_ERRORS = 10;
		let consecutiveErrors = 0;

		const recordError = (msg) => {
			consecutiveErrors++;
			if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
				this.emitStatus('error', { error: msg });
				return true;
			}
			return false;
		};

		while (this._sendLoopRunning && this.isReady()) {
			try {
				const _ts0 = performance.now();
				const status = await this.device.getStatus();
				this.stats.statusMs = performance.now() - _ts0;

				if (status === -1) {
					if (recordError('Too many consecutive device errors')) break;
					await new Promise(r => setTimeout(r, 50));
					continue;
				}

				if (status !== 1) {
					continue;
				}

				// Run the render pipeline just-in-time so the pipeline rate
				// matches the DAC consumption rate (rather than rAF rate).
				// The LaserManager stashes the latest SVG segments on each
				// rAF tick; we pick them up here.
				if (this.calibrationActive) {
					const testPoints = this.generateTestPattern();
					const testResult = this.convertTraceToLaserPoints(testPoints, { basePower: 1.0 });
					this.lastFrame = testResult.points.length > 4096
						? testResult.points.slice(0, 4096) : testResult.points;
				} else if (this.pendingSegments) {
					this.processSegments(this.pendingSegments);
				}

				const frame = this.lastFrame;
				if (!frame || frame.length === 0) {
					// Idle keep-alive: periodically re-send a blank frame so the
					// DAC keeps receiving bulk traffic and any wedged endpoint
					// surfaces as an error via the normal return-value path.
					const KEEPALIVE_INTERVAL_MS = 500;
					const now = performance.now();
					if (!this._sentBlank || (now - this._lastKeepaliveTime) > KEEPALIVE_INTERVAL_MS) {
						const blankPoints = [];
						for (let i = 0; i < 100; i++) {
							blankPoints.push(HeliosPoint.blank(2048, 2048));
						}
						const blankResult = await this.device.sendFrame(blankPoints, this.settings.pps);
						if (blankResult === -1) {
							if (recordError('Frame send failed')) break;
							continue;
						}
						this._sentBlank = true;
						this._lastKeepaliveTime = now;
						// Keepalive parks the galvo at center; next real frame
						// needs to prepend blanking to move to its first draw.
						this._lastFrameEndpoint = { x: 2048, y: 2048 };
						// Reflect what we actually sent in the stats panel —
						// otherwise the dialog keeps showing stats from the
						// last real frame while we're idle.
						this.stats.pointsPerFrame = blankPoints.length;
						this.stats.blankingPoints = blankPoints.length;
						this.stats.drawingPoints = 0;
						this.stats.cornerDwellPoints = 0;
						this.stats.anchorDwellPoints = 0;
						this.stats.inputPoints = 0;
						this.stats.resampledPoints = 0;
						this.framesSentThisSecond++;
					}
					await new Promise(r => setTimeout(r, 10));
					continue;
				}
				this._sentBlank = false;

				const _ts1 = performance.now();
				const sendResult = await this.device.sendFrame(frame, this.settings.pps);
				this.stats.sendMs = performance.now() - _ts1;

				if (sendResult === -1) {
					// sendFrame catches transfer errors internally and returns HELIOS_ERROR.
					if (recordError('Frame send failed')) break;
					continue;
				}

				this.framesSentThisSecond++;
				consecutiveErrors = 0;
				// Advance the moving window once per frame that actually reached
				// the DAC — otherwise rAF-rate offset advances drop intermediate
				// window positions (e.g. at 50/50 you'd only ever see one half).
				this._advanceWindowOffset();

				const now = performance.now();
				if (now - this.lastStatsTime > 1000) {
					this.stats.framesPerSecond = this.framesSentThisSecond;
					this.framesSentThisSecond = 0;
					this.framesSkippedThisSecond = 0;
					this.lastStatsTime = now;
				}
			} catch (error) {
				console.error('[LaserRenderer] Send loop error:', error);
				if (recordError(error.message || 'Send loop failure')) break;
				await new Promise(r => setTimeout(r, 100));
			}
		}

		this._sendLoopRunning = false;
	}

	/**
	 * Resample raw input points to a target count
	 * Corner-aware: distributes more points near sharp angles
	 */
	resampleInputPoints(points, targetCount) {
		if (points.length === 0) return points;
		if (points.length === targetCount) return points;

		const segments = [];
		let segStart = 0;
		for (let i = 1; i <= points.length; i++) {
			// Only split on explicit segmentStart flags — long legitimate L-to-L
			// moves inside one continuous path must stay in the same segment,
			// otherwise the laser blanks instead of drawing the line.
			const isBreak = i === points.length || points[i].segmentStart;
			if (isBreak) {
				segments.push({ start: segStart, end: i - 1 });
				segStart = i;
			}
		}

		for (const seg of segments) {
			seg.weight = 0;
			for (let i = seg.start; i < seg.end; i++) {
				const dx = points[i + 1].x - points[i].x;
				const dy = points[i + 1].y - points[i].y;
				const edgeLen = Math.sqrt(dx * dx + dy * dy);
				seg.weight += edgeLen;
				seg.weight += this._inputCornerWeight(points, i + 1, seg.start, seg.end);
			}
			seg.weight = Math.max(seg.weight, 0.001);
		}

		const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
		const result = [];

		for (const seg of segments) {
			const segLen = seg.end - seg.start + 1;
			const segBudget = Math.max(2, Math.round(targetCount * seg.weight / totalWeight));

			if (segLen <= 2) {
				for (let i = seg.start; i <= seg.end; i++) {
					const pt = { ...points[i] };
					if (i === seg.start && result.length > 0) pt.segmentStart = true;
					result.push(pt);
				}
			} else {
				// Each edge stores the corner weights at both its endpoints so
				// the sampling loop can split the edge into a depart half
				// (cluster near start vertex, if it's a corner) and an
				// approach half (cluster near end vertex, if it's a corner).
				// The vertex's total corner weight `cw` is split half/half
				// between its incoming edge (contributing to `endCw`) and
				// outgoing edge (contributing to `startCw`), so each corner
				// still contributes `cw` total to the segment's weight but the
				// sample budget it attracts is spread physically across both
				// adjacent edges near the vertex.
				const edgeLens = [];
				const startCws = [];
				const endCws = [];
				const cumWeight = [0];
				for (let i = seg.start; i < seg.end; i++) {
					const dx = points[i + 1].x - points[i].x;
					const dy = points[i + 1].y - points[i].y;
					const edgeLen = Math.sqrt(dx * dx + dy * dy);
					const startCw = this._inputCornerWeight(points, i, seg.start, seg.end);
					const endCw = this._inputCornerWeight(points, i + 1, seg.start, seg.end);
					edgeLens.push(edgeLen);
					startCws.push(startCw);
					endCws.push(endCw);
					cumWeight.push(cumWeight[cumWeight.length - 1] + edgeLen + (startCw + endCw) / 2);
				}
				const totalW = cumWeight[cumWeight.length - 1];

				if (totalW === 0) {
					const pt = { ...points[seg.start] };
					if (result.length > 0) pt.segmentStart = true;
					result.push(pt);
					continue;
				}

				const isUpsampling = segBudget > segLen;

				for (let j = 0; j < segBudget; j++) {
					const targetW = segBudget > 1 ? (j / (segBudget - 1)) * totalW : 0;
					let lo = 0, hi = cumWeight.length - 2;
					while (lo < hi) {
						const mid = (lo + hi) >> 1;
						if (cumWeight[mid + 1] < targetW) lo = mid + 1;
						else hi = mid;
					}

					const relW = targetW - cumWeight[lo];
					const el = edgeLens[lo];
					const startCw = startCws[lo];
					const endCw = endCws[lo];
					const a = points[seg.start + lo];
					const b = points[Math.min(seg.start + lo + 1, seg.end)];

					// Split the edge into a depart half and an approach half
					// at physical frac = 0.5. Each half's weight = half the
					// physical edge length plus half the adjacent corner
					// weight. Inside a half, a quadratic curve maps uniform
					// weight progress to physical frac so samples cluster
					// against the corner without stacking at it.
					const departHalfW = el / 2 + startCw / 2;
					const approachHalfW = el / 2 + endCw / 2;
					let frac;
					if (el <= 0) {
						frac = 0;
					} else if (relW <= departHalfW) {
						const u = departHalfW > 0 ? relW / departHalfW : 0;
						const h = startCw > 0 ? u * u : u;
						frac = 0.5 * h;
					} else {
						const u = approachHalfW > 0 ? (relW - departHalfW) / approachHalfW : 1;
						const h = endCw > 0 ? 1 - (1 - u) * (1 - u) : u;
						frac = 0.5 + 0.5 * h;
					}

					let pt;
					if (isUpsampling) {
						pt = {
							x: a.x + (b.x - a.x) * frac,
							y: a.y + (b.y - a.y) * frac,
						};
						if (a.r !== undefined) {
							pt.r = Math.round(a.r + ((b.r || 0) - a.r) * frac);
							pt.g = Math.round(a.g + ((b.g || 0) - a.g) * frac);
							pt.b = Math.round(a.b + ((b.b || 0) - a.b) * frac);
						}
						if (a.opacity !== undefined) {
							pt.opacity = a.opacity + ((b.opacity !== undefined ? b.opacity : 1) - a.opacity) * frac;
						}
					} else {
						const idx = frac < 0.5 ? seg.start + lo : Math.min(seg.start + lo + 1, seg.end);
						pt = { ...points[idx] };
					}

					if (j === 0 && result.length > 0) pt.segmentStart = true;
					else if (j > 0) pt.segmentStart = false;
					result.push(pt);
				}
			}
		}
		return result;
	}

	_inputCornerWeight(points, idx, segStart, segEnd) {
		if (idx <= segStart || idx >= segEnd) return 0;
		const prev = points[idx - 1], cur = points[idx], next = points[idx + 1];
		const ax = cur.x - prev.x, ay = cur.y - prev.y;
		const bx = next.x - cur.x, by = next.y - cur.y;
		const magA = Math.sqrt(ax * ax + ay * ay);
		const magB = Math.sqrt(bx * bx + by * by);
		if (magA === 0 || magB === 0) return 0;
		const dot = ax * bx + ay * by;
		const cosAngle = dot / (magA * magB);
		const sharpness = Math.max(0, (1 - cosAngle) / 2);
		const avgEdge = (magA + magB) / 2;
		const bias = this.settings.cornerBias ?? 3;
		const power = this.settings.cornerSharpness ?? 1;
		// cornerSharpness raises the per-point sharpness to a power, so at
		// power=1 any bend contributes (linear), at power=2+ only pronounced
		// corners dominate the weight.
		const weightedSharpness = power === 1 ? sharpness : Math.pow(sharpness, power);
		return weightedSharpness * avgEdge * bias;
	}

	/**
	 * Generate a test pattern for calibration
	 */
	generateTestPattern() {
		const points = [];

		const addLine = (x1, y1, x2, y2, r, g, b, steps, segmentStart = false) => {
			for (let s = 0; s <= steps; s++) {
				const t = s / steps;
				points.push({
					x: x1 + (x2 - x1) * t,
					y: y1 + (y2 - y1) * t,
					r, g, b,
					segmentStart: s === 0 && segmentStart
				});
			}
		};

		// Green square
		const border = 0.9;
		const corners = [
			[-border, -border], [border, -border],
			[border, border], [-border, border]
		];
		for (let c = 0; c < 4; c++) {
			const [x1, y1] = corners[c];
			const [x2, y2] = corners[(c + 1) % 4];
			addLine(x1, y1, x2, y2, 0, 255, 0, 50, c === 0);
		}

		// Red circle
		const radius = 0.6;
		const circleSteps = 100;
		for (let s = 0; s <= circleSteps; s++) {
			const angle = (s / circleSteps) * Math.PI * 2;
			points.push({
				x: radius * Math.cos(angle),
				y: radius * Math.sin(angle),
				r: 255, g: 0, b: 0,
				segmentStart: s === 0
			});
		}

		// Blue cross
		addLine(-0.4, 0, 0.4, 0, 0, 0, 255, 30, true);
		addLine(0, -0.4, 0, 0.4, 0, 0, 255, 30, true);

		// Letter markers drawn as laser strokes
		const s = 0.06; // half-size of each letter
		const r = 255, gm = 255, bm = 255; // white

		// N (top center, at y = -border + offset)
		const ny = -border + s + 0.04;
		addLine(-s, ny + s, -s, ny - s, r, gm, bm, 8, true);  // left vertical
		addLine(-s, ny - s, s, ny + s, r, gm, bm, 8, true);    // diagonal
		addLine(s, ny + s, s, ny - s, r, gm, bm, 8, true);     // right vertical

		// S (bottom center, at y = border - offset)
		const sy = border - s - 0.04;
		addLine(s, sy - s, -s, sy - s, r, gm, bm, 8, true);    // top horizontal
		addLine(-s, sy - s, -s, sy, r, gm, bm, 6, true);       // left vertical
		addLine(-s, sy, s, sy, r, gm, bm, 8, true);             // middle horizontal
		addLine(s, sy, s, sy + s, r, gm, bm, 6, true);          // right vertical
		addLine(s, sy + s, -s, sy + s, r, gm, bm, 8, true);    // bottom horizontal

		// E (right center, at x = border - offset)
		const ex = border - s - 0.04;
		addLine(ex + s, -s, ex - s, -s, r, gm, bm, 8, true);   // top horizontal
		addLine(ex - s, -s, ex - s, s, r, gm, bm, 8, true);    // left vertical
		addLine(ex - s, 0, ex + s * 0.5, 0, r, gm, bm, 6, true); // middle horizontal
		addLine(ex - s, s, ex + s, s, r, gm, bm, 8, true);     // bottom horizontal

		// W (left center, at x = -border + offset)
		const wx = -border + s + 0.04;
		addLine(wx - s, -s, wx - s * 0.5, s, r, gm, bm, 8, true);  // left diagonal down
		addLine(wx - s * 0.5, s, wx, 0, r, gm, bm, 8, true);       // left diagonal up
		addLine(wx, 0, wx + s * 0.5, s, r, gm, bm, 8, true);       // right diagonal down
		addLine(wx + s * 0.5, s, wx + s, -s, r, gm, bm, 8, true);  // right diagonal up

		return points;
	}

	/**
	 * Display the test pattern for calibration
	 */
	async showTestPattern() {
		if (!this.isReady()) return;
		if (this.isSending) return;

		this.isSending = true;
		try {
			const status = await this.device.getStatus();
			if (status !== 1) {
				this.isSending = false;
				return;
			}
			const points = this.generateTestPattern();
			const result = this.convertTraceToLaserPoints(points, { basePower: 1.0 });
			if (result.points.length === 0) {
				this.isSending = false;
				return;
			}
			const maxPoints = HELIOS.MAX_POINTS;
			const finalPoints = result.points.length > maxPoints
				? result.points.slice(0, maxPoints)
				: result.points;
			await this.device.sendFrame(finalPoints, this.settings.pps);
		} catch (error) {
			console.error('[LaserRenderer] Error sending test pattern:', error);
		} finally {
			this.isSending = false;
		}
	}

	/**
	 * Clear the laser output (send blank frame)
	 */
	async clear() {
		if (!this.device || this.device.closed) return;

		while (this.isSending) {
			await new Promise(resolve => setTimeout(resolve, 5));
		}

		try {
			let ready = false;
			for (let i = 0; i < 25 && !ready; i++) {
				const status = await this.device.getStatus();
				if (status === 1) {
					ready = true;
				} else {
					await new Promise(resolve => setTimeout(resolve, 20));
				}
			}

			const blankPoints = [];
			for (let i = 0; i < 100; i++) {
				blankPoints.push(HeliosPoint.blank(2048, 2048));
			}
			await this.device.sendFrame(blankPoints, this.settings.pps);
		} catch (error) {
			console.error('[LaserRenderer] Error clearing laser:', error);
		}
	}

	async destroy() {
		await this.disconnect();
	}
}

export default LaserRenderer;
