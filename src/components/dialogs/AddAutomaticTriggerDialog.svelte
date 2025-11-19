<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';

	/**
	 * AddAutomaticTriggerDialog - Promise-based dialog for creating automatic triggers
	 *
	 * Usage:
	 *   const result = await addAutomaticTriggerDialog.open(availableAnimations, devices);
	 *   if (result) {
	 *     // Create trigger with result data
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let availableAnimations = $state([]);
	let devices = $state([]);

	// Form state
	let selectedDevice = $state(null);
	let selectedAnimation = $state(null);
	let duration = $state(1000);
	let looping = $state(false);
	let easing = $state('linear');

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Back easing
	];

	/**
	 * Open the dialog
	 * @param {Array} animations - Available animations
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{device, animation, duration, looping, easing}|null>}
	 */
	export function open(animations, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			availableAnimations = animations;
			devices = devs;

			// Initialize form state
			selectedDevice = devs[0]?.id || null;
			selectedAnimation = animations[0]?.cssName || null;
			duration = 1000;
			looping = false;
			easing = 'linear';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedDevice || !selectedAnimation) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return trigger configuration
		const result = {
			device: selectedDevice,
			animation: selectedAnimation,
			duration,
			looping,
			easing
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
	}
</script>

<Dialog bind:dialogRef={dialogRef} title="Create Automatic Trigger" onclose={handleCancel}>
	<form id="automatic-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Device Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="auto-trigger-device">Device:</label>
					<select id="auto-trigger-device" bind:value={selectedDevice}>
						{#each devices as device}
							<option value={device.id}>{device.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 2: Action Configuration -->
			<div class="trigger-column">
				<div class="trigger-card">
					<div class="dialog-input-group">
						<label for="auto-trigger-animation">Animation:</label>
						<select id="auto-trigger-animation" bind:value={selectedAnimation}>
							{#each availableAnimations as animation}
								<option value={animation.cssName}>{animation.name}</option>
							{/each}
						</select>
					</div>

					<div class="dialog-input-group">
						<label for="auto-trigger-duration">Duration (ms):</label>
						<div class="duration-with-loop">
							<input
								id="auto-trigger-duration"
								type="number"
								bind:value={duration}
								min="100"
								step="100"
								disabled={!selectedAnimation}
							/>
							<div class="checkbox-field">
								<label>
									<input
										type="checkbox"
										bind:checked={looping}
										disabled={!selectedAnimation}
									/>
									Loop
								</label>
							</div>
						</div>
					</div>

					<div class="dialog-input-group">
						<label for="auto-trigger-easing">Easing:</label>
						<select id="auto-trigger-easing" bind:value={easing} disabled={!selectedAnimation}>
							{#each EASING_FUNCTIONS as easingFn}
								<option value={easingFn}>{easingFn}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="automatic-trigger-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>
	.trigger-columns {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
		min-width: 600px;
	}

	.trigger-column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.trigger-card {
		background: #f6f6f6;
		padding: 15px;
		border-radius: 6px;
	}

	.duration-with-loop {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.duration-with-loop input[type="number"] {
		flex: 1;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10pt;
		cursor: pointer;
	}
</style>
