<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Controls from '../controls/Controls.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { isButton } from '../../lib/inputs/utils.js';

	/**
	 * AddActionTriggerDialog - Promise-based dialog for creating action triggers
	 *
	 * Usage:
	 *   const result = await addActionTriggerDialog.open(availableInputs, availableAnimations, devices, scenes);
	 *   if (result) {
	 *     // Create trigger with result data
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let availableInputs = $state([]);
	let availableAnimations = $state([]);
	let devices = $state([]);
	let scenes = $state([]);

	// Form state
	let selectedInput = $state(null);
	let inputState = $state('down');
	let actionType = $state('animation');
	let selectedDevice = $state(null);
	let selectedAnimation = $state(null);
	let selectedScene = $state(null);
	let duration = $state(1000);
	let looping = $state(true);
	let easing = $state('linear');
	let controlValues = $state({});
	let enabledControls = $state([]);

	// Action types - scene only available for 'down' state
	let availableActionTypes = $derived.by(() => {
		const types = [
			{ value: 'animation', label: 'Run Animation' },
			{ value: 'values', label: 'Set values' }
		];

		// Only allow scene change on 'down' state
		if (inputState === 'down') {
			types.push({ value: 'scene', label: 'Change Scene' });
		}

		return types;
	});

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Back easing
	];

	// Get input state options based on the selected input's button mode
	function getInputStateOptions() {
		if (!selectedInput) {
			return [
				{ value: 'down', label: 'Down' },
				{ value: 'up', label: 'Up' }
			];
		}

		// Parse deviceId_controlId format
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

	// Handle input state change - reset action type if scene is selected but state changed
	function handleInputStateChange() {
		if (actionType === 'scene' && inputState !== 'down') {
			actionType = 'animation';
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

	// Handle device change - initialize enabled controls
	function handleDeviceChange() {
		if (actionType === 'values' && selectedDevice) {
			const device = devices.find(d => d.id === selectedDevice);
			if (device) {
				const deviceType = DEVICE_TYPES[device.type];
				enabledControls = deviceType.controls.map(c => c.id);
			}
		}
	}

	/**
	 * Open the dialog
	 * @param {Array} inputs - Available input mappings
	 * @param {Array} animations - Available animations
	 * @param {Array} devs - Available devices
	 * @param {Array} scns - Available scenes
	 * @returns {Promise<{input, inputState, actionType, device, animation, duration, looping, easing, values, scene}|null>}
	 */
	export function open(inputs, animations, devs, scns = []) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			availableInputs = inputs;
			availableAnimations = animations;
			devices = devs;
			scenes = scns;

			// Initialize form state
			// Format: deviceId_controlId (needed for parsing in TriggersView)
			selectedInput = inputs[0] ? `${inputs[0].deviceId}_${inputs[0].controlId}` : null;
			inputState = 'down';
			actionType = 'animation';
			selectedDevice = devs[0]?.id || null;
			selectedAnimation = animations[0]?.cssIdentifier || null;
			selectedScene = scns[0]?.id || null;
			duration = 1000;
			looping = true;
			easing = 'linear';
			controlValues = {};

			// Initialize enabled controls for values
			handleDeviceChange();

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInput) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Scene action doesn't require device
		if (actionType === 'scene') {
			if (!selectedScene) {
				resolvePromise(null);
				closeDialog();
				return;
			}

			const result = {
				input: selectedInput,
				inputState,
				actionType: 'scene',
				scene: selectedScene
			};

			resolvePromise(result);
			closeDialog();
			return;
		}

		// Other action types require device
		if (!selectedDevice) {
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

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
	}

	// Check if we should show device column
	let showDeviceColumn = $derived(actionType !== 'scene');
</script>

<Dialog bind:dialogRef={dialogRef} title="Create Action Trigger" onclose={handleCancel}>
	<form id="action-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns" class:scene-mode={!showDeviceColumn}>
			<!-- Column 1: Trigger Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="trigger-input">Input:</label>
					<select id="trigger-input" bind:value={selectedInput}>
						{#each availableInputs as input}
							<option value={`${input.deviceId}_${input.controlId}`}>{input.name}</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="trigger-state">Trigger State:</label>
					<select id="trigger-state" bind:value={inputState} onchange={handleInputStateChange}>
						{#each getInputStateOptions() as state}
							<option value={state.value}>{state.label}</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="trigger-action-type">Action:</label>
					<select id="trigger-action-type" bind:value={actionType}>
						{#each availableActionTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 2: Device Configuration (hidden for scene action) -->
			{#if showDeviceColumn}
				<div class="trigger-column with-divider">
					<div class="dialog-input-group">
						<label for="trigger-device">Device:</label>
						<select id="trigger-device" bind:value={selectedDevice} onchange={handleDeviceChange}>
							{#each devices as device}
								<option value={device.id}>{device.name}</option>
							{/each}
						</select>
					</div>
				</div>
			{/if}

			<!-- Column 3: Action Configuration -->
			<div class="trigger-column" class:with-divider={!showDeviceColumn}>
				<div class="trigger-card">
					{#if actionType === 'animation'}
						<div class="dialog-input-group">
							<label for="trigger-animation">Animation:</label>
							<select id="trigger-animation" bind:value={selectedAnimation}>
								{#each availableAnimations as animation}
									<option value={animation.id}>{animation.name}</option>
								{/each}
							</select>
						</div>

						<div class="dialog-input-group">
							<label for="trigger-duration">Duration (ms):</label>
							<div class="duration-with-loop">
								<input
									id="trigger-duration"
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
					{:else if actionType === 'scene'}
						<div class="dialog-input-group">
							<label for="trigger-scene">Scene:</label>
							<select id="trigger-scene" bind:value={selectedScene}>
								{#each scenes as scene}
									<option value={scene.id}>{scene.name}</option>
								{/each}
							</select>
						</div>
						<p class="scene-hint">When triggered, the scene will be activated.</p>
					{/if}
				</div>
			</div>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="action-trigger-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>
	.trigger-columns {
		display: grid;
		grid-template-columns: 180px 200px 350px;
		gap: 20px;
	}

	.trigger-columns.scene-mode {
		grid-template-columns: 180px 350px;
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

	.scene-hint {
		color: #666;
		font-size: 9pt;
		margin: 10px 0 0;
	}
</style>
