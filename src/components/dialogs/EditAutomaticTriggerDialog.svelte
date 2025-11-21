<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditAutomaticTriggerDialog - Promise-based dialog for editing automatic triggers
	 *
	 * Usage:
	 *   const result = await editAutomaticTriggerDialog.open(trigger, availableAnimations, devices);
	 *   if (result) {
	 *     if (result.delete) {
	 *       // Handle delete
	 *     } else {
	 *       // Update trigger with result data
	 *     }
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let editingTrigger = $state(null);
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
	 * @param {Object} trigger - The trigger to edit
	 * @param {Array} animations - Available animations
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{device, animation, duration, looping, easing}|{delete: true}|null>}
	 */
	export function open(trigger, animations, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			editingTrigger = trigger;
			availableAnimations = animations;
			devices = devs;

			// Initialize form state from trigger
			selectedDevice = trigger.deviceId;
			selectedAnimation = trigger.animation?.id;
			duration = trigger.animation?.duration || 1000;
			looping = trigger.animation?.iterations === 'infinite';
			easing = trigger.animation?.easing || 'linear';

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

	function confirmDelete() {
		if (!editingTrigger) return;

		if (confirm(`Are you sure you want to delete this trigger?`)) {
			resolvePromise({ delete: true });
			closeDialog();
		}
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
		editingTrigger = null;
	}
</script>

{#if editingTrigger}
<Dialog bind:dialogRef={dialogRef} title="Trigger" onclose={handleCancel}>
	<form id="edit-automatic-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Device Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="edit-trigger-device">Device:</label>
					<select id="edit-trigger-device" bind:value={selectedDevice}>
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
						<label for="edit-trigger-animation">Animation:</label>
						<select id="edit-trigger-animation" bind:value={selectedAnimation}>
							{#each availableAnimations as animation}
								<option value={animation.cssName}>{animation.name}</option>
							{/each}
						</select>
					</div>

					<div class="dialog-input-group">
						<label for="edit-trigger-duration">Duration (ms):</label>
						<div class="duration-with-loop">
							<input
								id="edit-trigger-duration"
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
						<label for="edit-trigger-easing">Easing:</label>
						<select id="edit-trigger-easing" bind:value={easing} disabled={!selectedAnimation}>
							{#each EASING_FUNCTIONS as easingFn}
								<option value={easingFn}>{easingFn}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
		</div>
	</form>

	{#snippet tools()}
		<Button onclick={confirmDelete} variant="secondary">
			{@html removeIcon}
			Delete
		</Button>
	{/snippet}

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-automatic-trigger-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

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
