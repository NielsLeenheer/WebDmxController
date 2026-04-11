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
	import { getInputType } from '../../lib/inputs/types/index.js';
	import { drawingLibrary } from '../../stores.svelte.js';

	/**
	 * EditActionTriggerDialog - Promise-based dialog for editing action triggers
	 *
	 * Usage:
	 *   const result = await editActionTriggerDialog.open(trigger, availableInputs, availableAnimations, devices, scenes);
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
	let availableScenes = $state([]);
	let devices = $state([]);

	// Form state
	let selectedInput = $state(null);
	let inputState = $state('down');
	let actionType = $state('animation');
	let selectedDevice = $state(null);
	let selectedAnimation = $state(null);
	let selectedScene = $state(null);
	let selectedDrawing = $state(null);
	let drawings = $derived(drawingLibrary.getAll());

	// Group inputs by device for optgroup rendering
	let inputsByDevice = $derived.by(() => {
		const groups = new Map();
		for (const input of availableInputs) {
			const key = input.deviceId || 'unknown';
			if (!groups.has(key)) {
				groups.set(key, { label: input.deviceName || key, inputs: [] });
			}
			groups.get(key).inputs.push(input);
		}
		return [...groups.values()];
	});
	let duration = $state(1000);
	let looping = $state(false);
	let easing = $state('linear');
	let controlValues = $state({});
	let enabledControls = $state([]);

	// Dynamic action types based on input state (scene/drawing only for trigger-on states)
	let actionTypes = $derived(
		inputState !== 'up' && inputState !== 'off'
			? [
				{ value: 'animation', label: 'Run Animation' },
				{ value: 'values', label: 'Set values' },
				{ value: 'scene', label: 'Change Scene' },
				...(drawings.length > 0 ? [{ value: 'drawing', label: 'Change Drawing' }] : [])
			]
			: [
				{ value: 'animation', label: 'Run Animation' },
				{ value: 'values', label: 'Set values' }
			]
	);

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
		} else if (buttonMode === 'select') {
			return [
				{ value: 'select', label: 'Select' }
			];
		} else if (buttonMode === 'beat') {
			const inputType = getInputType(input.type);
			if (inputType?.getBeatStates) {
				return inputType.getBeatStates();
			}
			return [
				{ value: 'beat', label: 'Beat' }
			];
		} else {
			return [
				{ value: 'down', label: 'Down' },
				{ value: 'up', label: 'Up' }
			];
		}
	}

	// Handle input selection change - reset inputState to first available option
	function handleInputChange() {
		const options = getInputStateOptions();
		if (options.length > 0 && !options.some(o => o.value === inputState)) {
			inputState = options[0].value;
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
	 * @param {Array} scenes - Available scenes
	 * @returns {Promise<{input, inputState, actionType, device, animation, duration, looping, easing, values, scene}|{delete: true}|null>}
	 */
	export function open(trigger, inputs, animations, devs, scenes = []) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			editingTrigger = trigger;
			availableInputs = inputs;
			availableAnimations = animations;
			availableScenes = scenes;
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
			} else if (actionType === 'scene') {
				selectedScene = trigger.action?.scene?.id || null;
				selectedDevice = null;
				enabledControls = [];
			} else if (actionType === 'drawing') {
				selectedDrawing = trigger.action?.drawing?.id || null;
				selectedDevice = null;
				enabledControls = [];
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
		if (!selectedInput) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Scene/drawing actions don't require device
		if (actionType === 'scene') {
			if (!selectedScene) {
				resolvePromise(null);
				closeDialog();
				return;
			}
		} else if (actionType === 'drawing') {
			if (!selectedDrawing) {
				resolvePromise(null);
				closeDialog();
				return;
			}
		} else if (!selectedDevice) {
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
			values: filteredValues,
			scene: selectedScene,
			drawing: selectedDrawing
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
		editingTrigger = null;
	}
</script>

{#if editingTrigger}
<Dialog bind:dialogRef={dialogRef} title="Edit Action Trigger" onclose={handleCancel}>
	<form id="edit-action-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<DialogColumns layout={['180px', 'line', '180px', '350px']}>
			{#snippet column1()}
				<!-- Column 1: Input Configuration -->
				<Group label="Input:" for="edit-trigger-input">
					<SelectField id="edit-trigger-input" bind:value={selectedInput} onchange={handleInputChange}>
						{#each inputsByDevice as group}
							<optgroup label={group.label}>
								{#each group.inputs as input}
									<option value={input.deviceId + '_' + input.controlId}>{input.name}</option>
								{/each}
							</optgroup>
						{/each}
					</SelectField>
				</Group>

				<Group label="Trigger State:" for="edit-trigger-state">
					<SelectField id="edit-trigger-state" bind:value={inputState}>
						{#each getInputStateOptions() as state}
							<option value={state.value}>{state.label}</option>
						{/each}
					</SelectField>
				</Group>
			{/snippet}

			{#snippet column2()}
				<!-- Column 2: Action & Device -->
				<Group label="Action:" for="edit-trigger-action-type">
					<SelectField id="edit-trigger-action-type" bind:value={actionType}>
						{#each actionTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</SelectField>
				</Group>

				{#if actionType !== 'scene' && actionType !== 'drawing'}
					<Group label="Device:" for="edit-trigger-device">
						<SelectField id="edit-trigger-device" bind:value={selectedDevice} onchange={() => { controlValues = {}; enabledControls = []; }}>
							{#each devices.filter(d => DEVICE_TYPES[d.type]?.channels > 0) as device}
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
					{:else if actionType === 'scene'}
						<Group label="Scene:" for="edit-trigger-scene">
							<SelectField id="edit-trigger-scene" bind:value={selectedScene}>
								{#each availableScenes as scene}
									<option value={scene.id}>{scene.name}</option>
								{/each}
							</SelectField>
						</Group>
					{:else if actionType === 'drawing'}
						<Group label="Drawing:" for="edit-trigger-drawing">
							<SelectField id="edit-trigger-drawing" bind:value={selectedDrawing}>
								{#each drawings as drawing}
									<option value={drawing.id}>{drawing.name}</option>
								{/each}
							</SelectField>
						</Group>
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
					{/if}
				</DialogColumnPanel>
			{/snippet}
		</DialogColumns>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleSave} variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}
