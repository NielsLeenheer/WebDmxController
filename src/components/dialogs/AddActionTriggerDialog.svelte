<script>
	import Dialog from '../common/Dialog.svelte';
	import DialogColumns from '../common/DialogColumns.svelte';
	import DialogColumnPanel from '../common/DialogColumnPanel.svelte';
	import Group from '../common/form/Group.svelte';
	import SelectField from '../common/form/SelectField.svelte';
	import AnimationPicker from '../common/form/AnimationPicker.svelte';
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
</script>

<Dialog bind:dialogRef={dialogRef} title="Create Action Trigger" onclose={handleCancel}>
	<form id="action-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<DialogColumns layout={['180px', 'line', '180px', '350px']}>
			{#snippet column1()}
				<!-- Column 1: Input Configuration -->
				<Group label="Input:" for="trigger-input">
					<SelectField id="trigger-input" bind:value={selectedInput}>
						{#each availableInputs as input}
							<option value={`${input.deviceId}_${input.controlId}`}>{input.name}</option>
						{/each}
					</SelectField>
				</Group>

				<Group label="Trigger State:" for="trigger-state">
					<SelectField id="trigger-state" bind:value={inputState} onchange={handleInputStateChange}>
						{#each getInputStateOptions() as state}
							<option value={state.value}>{state.label}</option>
						{/each}
					</SelectField>
				</Group>
			{/snippet}

			{#snippet column2()}
				<!-- Column 2: Action & Device -->
				<Group label="Action:" for="trigger-action-type">
					<SelectField id="trigger-action-type" bind:value={actionType}>
						{#each availableActionTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</SelectField>
				</Group>

				{#if actionType !== 'scene'}
					<Group label="Device:" for="trigger-device">
						<SelectField id="trigger-device" bind:value={selectedDevice} onchange={handleDeviceChange}>
							{#each devices as device}
								<option value={device.id}>{device.name}</option>
							{/each}
						</SelectField>
					</Group>
				{/if}
			{/snippet}

			{#snippet column3()}
				<!-- Column 3: Action Configuration -->
				<DialogColumnPanel>
					{#if actionType === 'animation'}
						<AnimationPicker
							animations={availableAnimations}
							bind:animation={selectedAnimation}
							bind:duration={duration}
							bind:looping={looping}
							bind:easing={easing}
						/>
					{:else if actionType === 'values' && selectedDevice}
						{@const device = devices.find(d => d.id === selectedDevice)}
						{#if device}
							<Group>
								<Controls
									controls={DEVICE_TYPES[device.type].controls}
									bind:values={controlValues}
									onChange={handleControlValueChange}
									showCheckboxes={true}
									bind:enabledControls={enabledControls}
								/>
							</Group>
						{/if}
					{:else if actionType === 'scene'}
						<Group label="Scene:" for="trigger-scene">
							<SelectField id="trigger-scene" bind:value={selectedScene}>
								{#each scenes as scene}
									<option value={scene.id}>{scene.name}</option>
								{/each}
							</SelectField>
						</Group>
						<p class="scene-hint">When triggered, the scene will be activated.</p>
					{/if}
				</DialogColumnPanel>
			{/snippet}
		</DialogColumns>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleSave} variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>

	.scene-hint {
		color: #666;
		font-size: 9pt;
		margin: 10px 0 0;
	}
</style>
