<script>
	import Button from '../common/Button.svelte';
	import ToggleSwitch from '../common/ToggleSwitch.svelte';

	import connectIcon from '../../assets/icons/connect.svg?raw';
	import disconnectIcon from '../../assets/icons/disconnect.svg?raw';

	let {
		device,
		laserManager,
		enabled = $bindable(true),
		power = $bindable(255)
	} = $props();

	let connected = $state(false);
	let stats = $state(null);
	let canvasRef = $state(null);

	// Load initial settings
	$effect(() => {
		if (!laserManager) return;
		const settings = laserManager.getDeviceSettings(device.id);
		if (settings) {
			enabled = settings.enabled !== false;
			power = Math.round((settings.intensity ?? 1.0) * 255);
		}
	});

	function handleEnabledChange() {
		enabled = !enabled;
		laserManager?.updateDeviceSettings(device.id, { enabled });
	}

	function handlePowerChange(e) {
		power = parseInt(e.target.value);
		laserManager?.updateDeviceSettings(device.id, { intensity: power / 255 });
	}

	// Poll connection status and stats
	$effect(() => {
		if (!laserManager) return;
		const interval = setInterval(() => {
			connected = laserManager.isDeviceConnected(device.id);
			stats = connected ? laserManager.getDeviceStats(device.id) : null;
		}, 500);
		return () => clearInterval(interval);
	});

	// Draw output preview
	$effect(() => {
		if (!canvasRef || !laserManager) return;

		const ctx = canvasRef.getContext('2d');
		const w = canvasRef.width;
		const h = canvasRef.height;
		let animId;

		function drawFrame() {
			ctx.fillStyle = '#444';
			ctx.fillRect(0, 0, w, h);

			const dacX = (x) => (1 - x) * (w - 8) + 4;
			const dacY = (y) => (1 - y) * (h - 8) + 4;

			// Reference grid
			const refSegments = laserManager.getReferenceGrid();
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
			ctx.lineWidth = 0.5;
			for (const segment of refSegments) {
				if (segment.length < 2) continue;
				ctx.beginPath();
				ctx.moveTo(dacX(segment[0].x), dacY(segment[0].y));
				for (let i = 1; i < segment.length; i++) {
					ctx.lineTo(dacX(segment[i].x), dacY(segment[i].y));
				}
				ctx.stroke();
			}

			// Content
			const points = laserManager.getProcessedPoints();
			if (points && points.length > 0) {
				ctx.globalCompositeOperation = 'screen';
				let prevX = null, prevY = null, prevBlank = true;

				for (let i = 0; i < points.length; i++) {
					const pt = points[i];
					const px = dacX(pt.x);
					const py = dacY(pt.y);

					if (prevX !== null && !pt.blank && !prevBlank) {
						ctx.strokeStyle = `rgb(${pt.r}, ${pt.g}, ${pt.b})`;
						ctx.lineWidth = 2;
						ctx.beginPath();
						ctx.moveTo(prevX, prevY);
						ctx.lineTo(px, py);
						ctx.stroke();
					}

					prevX = px; prevY = py; prevBlank = pt.blank;
				}
				ctx.globalCompositeOperation = 'source-over';
			}

			animId = requestAnimationFrame(drawFrame);
		}

		drawFrame();
		return () => { if (animId) cancelAnimationFrame(animId); };
	});

	async function handleConnect() {
		await laserManager?.connect(device.id);
		connected = laserManager?.isDeviceConnected(device.id);
	}

	async function handleDisconnect() {
		await laserManager?.disconnect(device.id);
		connected = false;
	}

</script>

<div class="laser-control">
	<div class="laser-settings">
		<div class="laser-setting">
			<span class="laser-setting-label">Enabled</span>
			<div class="laser-setting-widget">
				<ToggleSwitch
					checked={enabled}
					onchange={handleEnabledChange}
					label="Enabled"
				/>
			</div>
			<span class="laser-setting-value"></span>
		</div>
		<div class="laser-setting">
			<span class="laser-setting-label">Power</span>
			<div class="laser-setting-widget">
				<input
					type="range"
					min="0"
					max="255"
					value={power}
					oninput={handlePowerChange}
					class="laser-slider"
					style="--slider-gradient: linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%); --thumb-color: rgb({power}, {power}, {power})"
				/>
			</div>
			<span class="laser-setting-value">{power}</span>
		</div>
	</div>

	<div class="laser-preview-wrapper">
		<canvas
			bind:this={canvasRef}
			width="200"
			height="200"
			class="laser-preview"
		></canvas>

		{#if stats}
			<div class="laser-stats">
				<span class="laser-stat">{stats.framesPerSecond} fps</span>
				<span class="laser-stat">{stats.pointsPerFrame} pts</span>
			</div>
		{/if}
	</div>

	<div class="laser-connect">
		{#if connected}
			<Button onclick={handleDisconnect} variant="secondary" size="small">
				{@html disconnectIcon}
				Disconnect ILDA
			</Button>
		{:else}
			<Button onclick={handleConnect} variant="secondary" size="small">
				{@html connectIcon}
				Connect ILDA
			</Button>
		{/if}
	</div>
</div>

<style>
	.laser-control {
		display: flex;
		flex-direction: column;
	}

	.laser-settings {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.laser-setting {
		display: grid;
		grid-template-columns: 4em 1fr 3em;
		gap: 8px;
		align-items: center;
	}

	.laser-setting-label {
		font-size: 9pt;
		font-weight: 500;
		color: #555;
	}

	.laser-setting-value {
		font-size: 9pt;
		font-family: var(--font-stack-mono);
		text-align: right;
		color: #555;
	}

	.laser-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 7px;
		border-radius: 3.5px;
		background: var(--slider-gradient);
		cursor: pointer;
		outline: none;
	}

	.laser-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--thumb-color, #888);
		outline: 2px solid rgba(255,255,255,0.6);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}

	.laser-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--thumb-color, #888);
		outline: 2px solid rgba(255,255,255,0.6);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		border: none;
	}

	.laser-preview-wrapper {
		margin-top: 18px;
		border-radius: 8px;
		background: #888;
		overflow: hidden;
		padding-bottom: 6px;
	}

	.laser-preview {
		width: 100%;
		aspect-ratio: 1;
		background: #444;
		border-radius: 8px;
		display: block;
	}

	.laser-stats {
		display: flex;
		justify-content: center;
		gap: 12px;
		padding: 4px 0 0;
	}

	.laser-stat {
		font-size: 7pt;
		font-family: var(--font-stack-mono);
		color: #ddd;
	}

	.laser-connect {
		display: flex;
		justify-content: center;
		margin-top: 12px;
	}
</style>
