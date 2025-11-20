<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Controls from '../controls/Controls.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';

	/**
	 * AddManualTriggerDialog - Promise-based dialog for creating manual triggers
	 *
	 * Usage:
	 *   const result = await addManualTriggerDialog.open(availableInputs, availableAnimations, devices);
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

	// Form state
	let selectedInput = $state(null);
	let triggerType = $state('pressed');
	let actionType = $state('animation');
	let selectedDevice = $state(null);
	let selectedAnimation = $state(null);
	let duration = $state(1000);
	let looping = $state(false);
	let easing = $state('linear');
	let channelValues = $state({});
	let enabledControls = $state([]);

	const ACTION_TYPES = [
		{ value: 'animation', label: 'Run Animation' },
		{ value: 'setValue', label: 'Set values' }
	];

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Back easing
	];

	// Get trigger type options based on the selected input's button mode
	function getTriggerTypeOptions() {
		if (!selectedInput) {
			return [
				{ value: 'pressed', label: 'Pressed' },
				{ value: 'not-pressed', label: 'Not Pressed' }
			];
		}

		// Parse deviceId_controlId format
		const [deviceId, controlId] = selectedInput.split('_');
		const input = availableInputs.find(i =>
			i.inputDeviceId === deviceId && i.inputControlId === controlId
		);

		if (!input || !input.isButtonInput()) {
			return [
				{ value: 'pressed', label: 'Pressed' },
				{ value: 'not-pressed', label: 'Not Pressed' }
			];
		}

		const buttonMode = input.buttonMode || 'momentary';

		if (buttonMode === 'toggle') {
			return [
				{ value: 'pressed', label: 'On' },
				{ value: 'not-pressed', label: 'Off' }
			];
		} else {
			return [
				{ value: 'pressed', label: 'Down' },
				{ value: 'not-pressed', label: 'Up' }
			];
		}
	}

	// Convert channelValues object to full values array for Controls
	function getValuesArrayForDevice() {
		const device = devices.find(d => d.id === selectedDevice);
		if (!device) return [];

		const numChannels = DEVICE_TYPES[device.type].channels;
		const values = new Array(numChannels).fill(0);

		// Fill in values from channelValues object
		for (let i = 0; i < numChannels; i++) {
			if (channelValues[i] !== undefined) {
				values[i] = channelValues[i];
			}
		}

		return values;
	}

	// Handle device control changes for setValue triggers
	function handleSetValueChange(channelIndex, value) {
		channelValues = {
			...channelValues,
			[channelIndex]: Math.max(0, Math.min(255, parseInt(value) || 0))
		};
	}

	// Handle device change - initialize enabled controls
	function handleDeviceChange() {
		if (actionType === 'setValue' && selectedDevice) {
			const device = devices.find(d => d.id === selectedDevice);
			if (device) {
				const deviceType = DEVICE_TYPES[device.type];
				enabledControls = deviceType.controls.map(c => c.name);
			}
		}
	}

	/**
	 * Open the dialog
	 * @param {Array} inputs - Available input mappings
	 * @param {Array} animations - Available animations
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{input, triggerType, actionType, device, animation, duration, looping, easing, channelValues, enabledControls}|null>}
	 */
	export function open(inputs, animations, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			availableInputs = inputs;
			availableAnimations = animations;
			devices = devs;

			// Initialize form state
			// Format: deviceId_controlId (needed for parsing in TriggersView)
			selectedInput = inputs[0] ? `${inputs[0].inputDeviceId}_${inputs[0].inputControlId}` : null;
			triggerType = 'pressed';
			actionType = 'animation';
			selectedDevice = devs[0]?.id || null;
			selectedAnimation = animations[0]?.cssName || null;
			duration = 1000;
			looping = false;
			easing = 'linear';
			channelValues = {};

			// Initialize enabled controls for setValue
			handleDeviceChange();

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
		const result = {
			input: selectedInput,
			triggerType,
			actionType,
			device: selectedDevice,
			animation: selectedAnimation,
			duration,
			looping,
			easing,
			channelValues: {...channelValues},
			enabledControls: [...enabledControls]
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

<Dialog bind:dialogRef={dialogRef} title="Create Manual Trigger" onclose={handleCancel}>
	<form id="manual-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Trigger Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="trigger-input">Input:</label>
					<select id="trigger-input" bind:value={selectedInput}>
						{#each availableInputs as input}
							<option value={`${input.inputDeviceId}_${input.inputControlId}`}>{input.name}</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="trigger-type">Trigger Type:</label>
					<select id="trigger-type" bind:value={triggerType}>
						{#each getTriggerTypeOptions() as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 2: Device Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="trigger-device">Device:</label>
					<select id="trigger-device" bind:value={selectedDevice} onchange={handleDeviceChange}>
						{#each devices as device}
							<option value={device.id}>{device.name}</option>
						{/each}
					</select>
				</div>

				<div class="dialog-input-group">
					<label for="trigger-action-type">Action:</label>
					<select id="trigger-action-type" bind:value={actionType}>
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
							<label for="trigger-animation">Animation:</label>
							<select id="trigger-animation" bind:value={selectedAnimation}>
								{#each availableAnimations as animation}
									<option value={animation.cssName}>{animation.name}</option>
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
							<label for="trigger-easing">Easing:</label>
							<select id="trigger-easing" bind:value={easing} disabled={!selectedAnimation}>
								{#each EASING_FUNCTIONS as easingFn}
									<option value={easingFn}>{easingFn}</option>
								{/each}
							</select>
						</div>
					{:else if actionType === 'setValue' && selectedDevice}
						{@const device = devices.find(d => d.id === selectedDevice)}
						{#if device}
							<div class="dialog-input-group">
								<Controls
									controls={DEVICE_TYPES[device.type].controls}
									components={DEVICE_TYPES[device.type].components}
									values={getValuesArrayForDevice()}
									onChange={handleSetValueChange}
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

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="manual-trigger-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>
	.trigger-columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		min-width: 900px;
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
