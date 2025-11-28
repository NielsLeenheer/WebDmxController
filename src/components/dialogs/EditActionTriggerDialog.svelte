<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Controls from '../controls/Controls.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditActionTriggerDialog - Promise-based dialog for editing action triggers
	 *
	 * Usage:
	 *   const result = await editActionTriggerDialog.open(trigger, availableInputs, availableAnimations, devices);
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
	let availableInputs = $state([]);
	let availableAnimations = $state([]);
	let devices = $state([]);

	// Form state
	let selectedInput = $state(null);
	let inputState = $state('down');
	let actionType = $state('animation');
	let selectedDevice = $state(null);
	let selectedAnimation = $state(null);
	let duration = $state(1000);
	let looping = $state(false);
	let easing = $state('linear');
	let controlValues = $state({});
	let enabledControls = $state([]);

	const ACTION_TYPES = [
		{ value: 'animation', label: 'Run Animation' },
		{ value: 'values', label: 'Set values' }
	];

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Back easing
	];

	// Get input state options based on the selected input's button mode
	function getInputStateOptions() {
		if (!selectedInput) return [
			{ value: 'down', label: 'Down' },
			{ value: 'up', label: 'Up' }
		];

		const [deviceId, controlId] = selectedInput.split('_');
		const input = availableInputs.find(i =>
			i.deviceId === deviceId && i.controlId === controlId
		);

		if (!input || !isButton(input)) {
			return [
				{ value: 'down', label: 'Down' },
				{ value: 'up', label: 'Up' }
			];
		}

		const buttonMode = input.buttonMode || 'momentary';

		if (buttonMode === 'toggle') {
			return [
				{ value: 'on', label: 'On' },
				{ value: 'off', label: 'Off' }
			];
		} else {
			return [
				{ value: 'down', label: 'Down' },
				{ value: 'up', label: 'Up' }
			];
		}
	}

	// Handle device control changes for setValue triggers
	function handleControlValueChange(controlId, value) {
		if (typeof value === 'object' && value !== null) {
			controlValues = {
				...controlValues,
				[controlId]: { ...value }
			};
		} else {
			controlValues = {
				...controlValues,
				[controlId]: Math.max(0, Math.min(255, parseInt(value) || 0))
			};
		}
	}

	/**
	 * Open the dialog
	 * @param {Object} trigger - The trigger to edit
	 * @param {Array} inputs - Available input mappings
	 * @param {Array} animations - Available animations
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{input, inputState, actionType, device, animation, duration, looping, easing, values}|{delete: true}|null>}
	 */
	export function open(trigger, inputs, animations, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			editingTrigger = trigger;
			availableInputs = inputs;
			availableAnimations = animations;
			devices = devs;

			// Initialize form state from trigger
			// Find the input matching trigger.input.id
			const input = inputs.find(i => i.id === trigger.input?.id);
			selectedInput = input ? `${input.deviceId}_${input.controlId}` : null;
			inputState = trigger.input?.state || 'down';
			actionType = trigger.action?.type === 'setValue' ? 'values' : trigger.action?.type || 'animation';

			if (actionType === 'values') {
				selectedDevice = trigger.output?.id;
				controlValues = {...(trigger.action?.values || {})};
				enabledControls = Object.keys(controlValues);

				// If enabledControls is empty, initialize with all controls
				if (enabledControls.length === 0 && selectedDevice) {
					const device = devs.find(d => d.id === selectedDevice);
					if (device) {
						const deviceType = DEVICE_TYPES[device.type];
						enabledControls = deviceType.controls.map(c => c.name);
					}
				}
			} else {
				selectedDevice = trigger.output?.id;
				selectedAnimation = trigger.action?.animation?.id;
				enabledControls = [];
			}

			duration = trigger.action?.animation?.duration || 1000;
			looping = trigger.action?.animation?.iterations === 'infinite';
			easing = trigger.action?.animation?.easing || 'linear';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInput || !selectedDevice) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		if (actionType === 'animation' && !selectedAnimation) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return trigger configuration
		// Filter controlValues to only include enabled controls
		const filteredValues = {};
		for (const controlId of enabledControls) {
			if (controlValues[controlId] !== undefined) {
				filteredValues[controlId] = controlValues[controlId];
			}
		}

		const result = {
			input: selectedInput,
			inputState,
			actionType,
			device: selectedDevice,
			animation: selectedAnimation,
			duration,
			looping,
			easing,
			values: filteredValues
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
<Dialog bind:dialogRef={dialogRef} title="Edit Action Trigger" onclose={handleCancel}>
	<form id="edit-action-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Trigger Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="edit-trigger-input">Input:</label>
					<select id="edit-trigger-input" bind:value={selectedInput}>
						{#each availableInputs as input}
							<option value={input.deviceId + '_' + input.controlId}>
								{input.name}
							</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="edit-trigger-state">Trigger State:</label>
					<select id="edit-trigger-state" bind:value={inputState}>
						{#each getInputStateOptions() as state}
							<option value={state.value}>{state.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 2: Device Configuration -->
			<div class="trigger-column with-divider">
				<div class="dialog-input-group">
					<label for="edit-trigger-device">Device:</label>
					<select id="edit-trigger-device" bind:value={selectedDevice}>
						{#each devices as device}
							<option value={device.id}>{device.name}</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="edit-trigger-action-type">Action:</label>
					<select id="edit-trigger-action-type" bind:value={actionType}>
						{#each ACTION_TYPES as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 3: Action Configuration -->
			<div class="trigger-column">
				<div class="trigger-card">
					{#if actionType === 'animation'}
						<div class="dialog-input-group">
							<label for="edit-trigger-animation">Animation:</label>
							<select id="trigger-animation" bind:value={selectedAnimation}>
								{#each availableAnimations as animation}
									<option value={animation.id}>{animation.name}</option>
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
							<label for="animation-easing">Easing:</label>
							<select id="animation-easing" bind:value={easing} disabled={!selectedAnimation}>
								{#each EASING_FUNCTIONS as easingFn}
									<option value={easingFn}>{easingFn}</option>
								{/each}
							</select>
						</div>
					{:else if actionType === 'values' && selectedDevice}
						{@const device = devices.find(d => d.id === selectedDevice)}
						{#if device}
							<div class="dialog-input-group">
								<Controls
									controls={DEVICE_TYPES[device.type].controls}
									bind:values={controlValues}
									onChange={handleControlValueChange}
									showCheckboxes={true}
									bind:enabledControls={enabledControls}
								/>
							</div>
						{/if}
					{/if}
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
		<Button type="submit" form="edit-action-trigger-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
	.trigger-columns {
		display: grid;
		grid-template-columns: 180px 200px 350px;
		gap: 20px;
	}

	.trigger-column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.trigger-column.with-divider {
		border-left: 1px solid #ddd;
		padding-left: 20px;
	}

	.trigger-card {
		background: #f6f6f6;
		padding: 15px;
		border-radius: 6px;
		min-height: 200px;

		display: flex;
		flex-direction: column;
		align-items: start;
	}

	.trigger-card .dialog-input-group {
		display: flex;
	    align-items: baseline;
		margin-bottom: 0;
	}

	.trigger-card .dialog-input-group :global(> label) {
		width: 120px;
	}

	#trigger-animation {
		min-width: 120px;
		max-width: 200px;
	}

	.duration-with-loop {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.duration-with-loop input[type="number"] {
		flex: 1;
		max-width: 120px;
	}

	#animation-easing {
		max-width: 160px;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10pt;
		cursor: pointer;
	}

	.trigger-card .dialog-input-group :global(.controls) {
		margin: 8px 8px 0;
		grid-template-columns: 20px 5em 1fr 3em;
	}

	.trigger-card .dialog-input-group :global(.controls .control) {
		margin-bottom: 8px;
	}

</style>
