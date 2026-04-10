<script>
	import { onDestroy } from 'svelte';
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { DEFAULT_BANDS, BAND_LIMITS } from '../../lib/inputs/devices/AudioInputDevice.js';
	import SelectField from '../common/form/SelectField.svelte';

	const ZONE_COLORS = {
		bass: { bar: '#e85d4a', active: '#ff7a6a', label: 'Bass' },
		mid:  { bar: '#4aad8b', active: '#6ad4ab', label: 'Mid' },
		high: { bar: '#4a8ae8', active: '#6aacff', label: 'High' },
	};

	const ZONE_IDS = ['bass', 'mid', 'high'];

	// 48 log-spaced visualization bars covering 20 Hz – 20 kHz
	const BAR_COUNT = 48;
	const VIS_BARS = [];
	{
		const logLo = Math.log2(20);
		const logHi = Math.log2(20000);
		for (let i = 0; i < BAR_COUNT; i++) {
			VIS_BARS.push({
				lo: Math.pow(2, logLo + (logHi - logLo) * i / BAR_COUNT),
				hi: Math.pow(2, logLo + (logHi - logLo) * (i + 1) / BAR_COUNT),
			});
		}
	}

	const GRAY_BAR = '#555555';
	const GRAY_ACTIVE = '#888888';

	let dialogRef = $state(null);
	let canvasRef = $state(null);
	let audioDevice = $state(null);
	let inputController = null;
	let rafId = null;
	let freqData = null;

	// Audio input source selection
	let availableInputs = $state([]);
	let selectedDeviceId = $state('');
	let switching = $state(false);

	// Per-band slider state: sensitivity, lo, hi
	let bandConfig = $state(DEFAULT_BANDS.map(b => ({
		sensitivity: 1.0,
		lo: b.lo,
		hi: b.hi,
	})));

	// Meter bar definitions (matches zones + volume)
	const METER_DEFS = [
		{ key: 'bass',   color: '#e85d4a', label: 'B' },
		{ key: 'mid',    color: '#4aad8b', label: 'M' },
		{ key: 'high',   color: '#4a8ae8', label: 'H' },
		{ key: 'volume', color: '#aaaaaa', label: 'V' },
	];

	// Beat state tracking
	let beatActive = { bass: false, mid: false, high: false };

	// Live energy levels (0–1) for meter bars
	let levels = { bass: 0, mid: 0, high: 0, volume: 0 };

	function onTrigger({ controlId }) {
		beatActive[controlId] = true;
	}

	function onRelease({ controlId }) {
		beatActive[controlId] = false;
	}

	function onChange({ controlId, value }) {
		if (controlId in levels) {
			levels[controlId] = value;
		}
	}

	function handleSliderChange(bandIndex) {
		if (!audioDevice) return;
		const cfg = bandConfig[bandIndex];
		audioDevice.configureBand(bandIndex, {
			sensitivity: cfg.sensitivity,
			lo: cfg.lo,
			hi: cfg.hi,
		});
		// Persist settings
		inputController?.saveAudioSettings(audioDevice, selectedDeviceId || undefined);
	}

	/**
	 * Determine which zone (if any) a frequency falls into based on current band config.
	 * Returns the zone id, or null if outside all detection ranges.
	 */
	function getBarZone(barLo, barHi) {
		const mid = (barLo + barHi) / 2;
		for (let i = 0; i < 3; i++) {
			const cfg = bandConfig[i];
			if (mid >= cfg.lo && mid <= cfg.hi) {
				return ZONE_IDS[i];
			}
		}
		return null;
	}

	export function show(device, controller) {
		audioDevice = device;
		inputController = controller;
		const deviceBands = device.bands;
		bandConfig = deviceBands.map(b => ({
			sensitivity: b.sensitivity,
			lo: b.lo,
			hi: b.hi,
		}));
		beatActive = { bass: false, mid: false, high: false };
		levels = { bass: 0, mid: 0, high: 0, volume: 0 };
		device.on('trigger', onTrigger);
		device.on('release', onRelease);
		device.on('change', onChange);
		enumerateInputDevices();
		requestAnimationFrame(() => {
			dialogRef?.showModal();
			startRendering();
		});
	}

	async function enumerateInputDevices() {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			availableInputs = devices.filter(d => d.kind === 'audioinput');
			// Try to match the currently active device
			if (audioDevice?._stream) {
				const activeTrack = audioDevice._stream.getAudioTracks()[0];
				const settings = activeTrack?.getSettings();
				selectedDeviceId = settings?.deviceId || '';
			}
		} catch {
			availableInputs = [];
		}
	}

	async function handleDeviceSwitch() {
		if (!inputController || switching) return;
		switching = true;
		try {
			// Detach from old device
			stopRendering();
			if (audioDevice) {
				audioDevice.off('trigger', onTrigger);
				audioDevice.off('release', onRelease);
				audioDevice.off('change', onChange);
			}
			// Keep current band config across the switch
			const savedBandConfig = bandConfig.map(c => ({ ...c }));
			// Switch to new device
			const newDevice = await inputController.switchAudioDevice(selectedDeviceId || undefined);
			audioDevice = newDevice;
			// Re-apply the band config to the new device
			for (let i = 0; i < savedBandConfig.length; i++) {
				newDevice.configureBand(i, savedBandConfig[i]);
			}
			bandConfig = savedBandConfig;
			beatActive = { bass: false, mid: false, high: false };
			levels = { bass: 0, mid: 0, high: 0, volume: 0 };
			newDevice.on('trigger', onTrigger);
			newDevice.on('release', onRelease);
			newDevice.on('change', onChange);
			startRendering();
			// Persist source + settings
			inputController.saveAudioSettings(newDevice, selectedDeviceId || undefined);
		} catch (error) {
			console.error('Failed to switch audio device:', error);
		} finally {
			switching = false;
		}
	}

	function startRendering() {
		if (!audioDevice?.analyser || !canvasRef) return;

		const analyser = audioDevice.analyser;
		freqData = new Uint8Array(analyser.frequencyBinCount);

		function render() {
			rafId = requestAnimationFrame(render);
			if (!canvasRef) return;

			analyser.getByteFrequencyData(freqData);

			const ctx = canvasRef.getContext('2d');
			const w = canvasRef.width;
			const h = canvasRef.height;
			const dpr = window.devicePixelRatio || 1;

			if (canvasRef.width !== canvasRef.clientWidth * dpr) {
				canvasRef.width = canvasRef.clientWidth * dpr;
				canvasRef.height = canvasRef.clientHeight * dpr;
				return;
			}

			ctx.clearRect(0, 0, w, h);

			// Inner padding
			const padL = 60 * dpr;
			const padR = 60 * dpr;
			const padT = 30 * dpr;
			const padB = 44 * dpr; // 30px + room for freq labels

			const gap = 2 * dpr;
			const meterSep = 60 * dpr; // gap between spectrum and meters
			const meterBarArea = 120 * dpr;
			const meterAreaWidth = meterSep + meterBarArea;
			const innerW = w - padL - padR;
			const spectrumWidth = innerW - meterAreaWidth;
			const barWidth = (spectrumWidth - gap * (BAR_COUNT - 1)) / BAR_COUNT;
			const sampleRate = audioDevice.sampleRate;
			const nyquist = sampleRate / 2;
			const binCount = analyser.frequencyBinCount;
			const barAreaTop = padT;
			const barAreaBottom = h - padB;
			const barAreaH = barAreaBottom - barAreaTop;

			// Draw spectrum bars
			for (let i = 0; i < BAR_COUNT; i++) {
				const bar = VIS_BARS[i];
				const binLo = Math.max(0, Math.round((bar.lo / nyquist) * binCount));
				const binHi = Math.min(binCount - 1, Math.round((bar.hi / nyquist) * binCount));

				let sum = 0;
				const count = Math.max(1, binHi - binLo + 1);
				for (let b = binLo; b <= binHi; b++) {
					const v = freqData[b] / 255;
					sum += v * v;
				}
				const energy = Math.sqrt(sum / count);

				const x = padL + i * (barWidth + gap);
				const barH = energy * barAreaH;
				const y = barAreaBottom - barH;

				const zone = getBarZone(bar.lo, bar.hi);
				const isActive = energy > 0.3;

				if (zone) {
					const colors = ZONE_COLORS[zone];
					ctx.fillStyle = isActive ? colors.active : colors.bar;
				} else {
					ctx.fillStyle = isActive ? GRAY_ACTIVE : GRAY_BAR;
				}

				const radius = Math.min(barWidth / 2, 2 * dpr);
				ctx.beginPath();
				ctx.moveTo(x + radius, y);
				ctx.lineTo(x + barWidth - radius, y);
				ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
				ctx.lineTo(x + barWidth, barAreaBottom);
				ctx.lineTo(x, barAreaBottom);
				ctx.lineTo(x, y + radius);
				ctx.quadraticCurveTo(x, y, x + radius, y);
				ctx.fill();
			}

			// Beat indicators at top — span the bars within each zone's detection range
			const indicatorH = 4 * dpr;
			for (let z = 0; z < 3; z++) {
				const zone = ZONE_IDS[z];
				if (!beatActive[zone]) continue;

				const cfg = bandConfig[z];
				let startX = null, endX = null;
				for (let i = 0; i < BAR_COUNT; i++) {
					const bar = VIS_BARS[i];
					const mid = (bar.lo + bar.hi) / 2;
					if (mid >= cfg.lo && mid <= cfg.hi) {
						const x = padL + i * (barWidth + gap);
						if (startX === null) startX = x;
						endX = x + barWidth;
					}
				}
				if (startX !== null) {
					const colors = ZONE_COLORS[zone];
					ctx.fillStyle = colors.active;
					ctx.beginPath();
					const r = indicatorH / 2;
					ctx.roundRect(startX, padT - indicatorH - 4 * dpr, endX - startX, indicatorH, r);
					ctx.fill();
				}
			}

			// Frequency labels at bottom
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			ctx.font = `${8 * dpr}px system-ui, -apple-system, sans-serif`;
			ctx.fillStyle = '#666';

			const freqLabels = [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000];
			for (const freq of freqLabels) {
				const logPos = (Math.log2(freq) - Math.log2(20)) / (Math.log2(20000) - Math.log2(20));
				const barIdx = Math.round(logPos * BAR_COUNT);
				if (barIdx >= 0 && barIdx < BAR_COUNT) {
					const x = padL + barIdx * (barWidth + gap) + barWidth / 2;
					const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
					ctx.fillText(label, x, barAreaBottom + 4 * dpr);
				}
			}

			// --- Level meter bars (right side, same height as spectrum bars) ---
			const meterGap = 8 * dpr;
			const meterW = 18 * dpr;
			const metersTotal = METER_DEFS.length * (meterW + meterGap) - meterGap;
			const meterStartX = padL + spectrumWidth + meterSep + (meterBarArea - metersTotal) / 2;

			for (let m = 0; m < METER_DEFS.length; m++) {
				const def = METER_DEFS[m];
				const val = levels[def.key];
				const mx = meterStartX + m * (meterW + meterGap);

				// Track background (same top/bottom as spectrum bars)
				ctx.fillStyle = '#252540';
				ctx.beginPath();
				ctx.roundRect(mx, barAreaTop, meterW, barAreaH, 3 * dpr);
				ctx.fill();

				// Filled portion (solid color)
				const fillH = val * barAreaH;
				if (fillH > 0) {
					const fy = barAreaBottom - fillH;
					ctx.fillStyle = def.color;
					ctx.beginPath();
					ctx.roundRect(mx, fy, meterW, fillH, 3 * dpr);
					ctx.fill();
				}

				// Beat flash for band meters
				if (beatActive[def.key]) {
					ctx.save();
					ctx.shadowColor = def.color;
					ctx.shadowBlur = 10 * dpr;
					ctx.strokeStyle = def.color;
					ctx.lineWidth = 2 * dpr;
					ctx.beginPath();
					ctx.roundRect(mx, barAreaTop, meterW, barAreaH, 3 * dpr);
					ctx.stroke();
					ctx.restore();
				}

				// Value text (0-255)
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';
				ctx.font = `${8 * dpr}px system-ui, -apple-system, sans-serif`;
				ctx.fillStyle = '#888';
				ctx.fillText(Math.round(val * 255), mx + meterW / 2, barAreaBottom + 4 * dpr);
			}
		}

		rafId = requestAnimationFrame(render);
	}

	function stopRendering() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function handleClose() {
		stopRendering();
		if (audioDevice) {
			audioDevice.off('trigger', onTrigger);
			audioDevice.off('release', onRelease);
			audioDevice.off('change', onChange);
		}
		dialogRef?.close();
		audioDevice = null;
		inputController = null;
	}

	function formatFreq(hz) {
		return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
	}

	onDestroy(() => {
		stopRendering();
	});
</script>

<Dialog bind:dialogRef title="Audio Settings" onclose={handleClose}>
	<div class="preview-content">
		<div class="source-row">
			<SelectField
				id="audio-source"
				bind:value={selectedDeviceId}
				onchange={handleDeviceSwitch}
				disabled={switching}
			>
				{#each availableInputs as dev}
					<option value={dev.deviceId}>{dev.label || `Microphone (${dev.deviceId.slice(0, 8)}…)`}</option>
				{/each}
			</SelectField>
			{#if switching}
				<span class="switching-indicator">Switching…</span>
			{/if}
		</div>

		<div class="visualizer-row">
			<canvas
				bind:this={canvasRef}
				class="spectrum-canvas"
				width="600"
				height="250"
			></canvas>
		</div>

		<div class="band-controls">
			{#each ZONE_IDS as zone, i}
				{@const colors = ZONE_COLORS[zone]}
				{@const limits = BAND_LIMITS[i]}
				<div class="band-section">
					<div class="band-header">
						<span class="band-swatch" style="background: {colors.bar}"></span>
						<span class="band-name">{colors.label}</span>
					</div>
					<div class="slider-row">
						<label class="slider-label" for="sens-{zone}">Sens</label>
						<input
							id="sens-{zone}"
							type="range"
							min="0.5"
							max="8"
							step="0.1"
							bind:value={bandConfig[i].sensitivity}
							oninput={() => handleSliderChange(i)}
							class="slider"
							style="accent-color: {colors.bar}"
						/>
						<span class="slider-value">{bandConfig[i].sensitivity.toFixed(2)}</span>
					</div>
					<div class="slider-row">
						<label class="slider-label" for="lo-{zone}">Min</label>
						<input
							id="lo-{zone}"
							type="range"
							min={limits.minLo}
							max={limits.maxHi}
							step="1"
							bind:value={bandConfig[i].lo}
							oninput={() => handleSliderChange(i)}
							class="slider"
							style="accent-color: {colors.bar}"
						/>
						<span class="slider-value">{formatFreq(bandConfig[i].lo)} Hz</span>
					</div>
					<div class="slider-row">
						<label class="slider-label" for="hi-{zone}">Max</label>
						<input
							id="hi-{zone}"
							type="range"
							min={limits.minLo}
							max={limits.maxHi}
							step="1"
							bind:value={bandConfig[i].hi}
							oninput={() => handleSliderChange(i)}
							class="slider"
							style="accent-color: {colors.bar}"
						/>
						<span class="slider-value">{formatFreq(bandConfig[i].hi)} Hz</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#snippet buttons()}
		<Button onclick={handleClose} variant="secondary">Close</Button>
	{/snippet}
</Dialog>

<style>
	.preview-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.source-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.switching-indicator {
		font-size: 8pt;
		color: #888;
		flex-shrink: 0;
	}

	.spectrum-canvas {
		width: 720px;
		height: 220px;
		background: #1a1a2e;
		border-radius: 8px;
	}

	.visualizer-row {
		display: flex;
	}

	.band-controls {
		display: flex;
		gap: 12px;
		width: 720px;
	}

	.band-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: #f8f8f8;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.band-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.band-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.band-name {
		font-weight: 600;
		font-size: 10pt;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.slider-label {
		font-size: 8pt;
		color: #666;
		width: 32px;
		flex-shrink: 0;
	}

	.slider {
		flex: 1;
		max-width: 100px;
		height: 4px;
		cursor: pointer;
	}

	.slider-value {
		font-size: 8pt;
		color: #666;
		width: 48px;
		text-align: right;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
</style>
