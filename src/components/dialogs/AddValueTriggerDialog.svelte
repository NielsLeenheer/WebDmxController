<script>
	import Dialog from '../common/Dialog.svelte';
	import DialogColumns from '../common/DialogColumns.svelte';
	import DialogColumnPanel from '../common/DialogColumnPanel.svelte';
	import InputGroup from '../common/InputGroup.svelte';
	import SelectField from '../common/SelectField.svelte';
	import Button from '../common/Button.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';

	/**
	 * AddValueTriggerDialog - Promise-based dialog for creating value-based triggers
	 *
	 * Usage:
	 *   const result = await addValueTriggerDialog.open(availableInputs, devices);
	 *   if (result) {
	 *     // Create trigger with result data
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let availableInputs = $state([]);
	let devices = $state([]);

	// Form state
	let selectedInputId = $state(null);
	let selectedValueKey = $state('value');
	let selectedDeviceId = $state(null);
	let selectedControlId = $state(null);
	let selectedValueId = $state(null);
	let invert = $state(false);

	// Derived values
	let selectedInput = $derived(availableInputs.find(i => i.id === selectedInputId));
	let exportedValues = $derived(selectedInput ? getInputExportedValues(selectedInput) : []);
	let selectedDevice = $derived(devices.find(d => d.id === selectedDeviceId));
	let deviceType = $derived(selectedDevice ? DEVICE_TYPES[selectedDevice.type] : null);
	let controls = $derived(deviceType ? deviceType.controls : []);

	// Get control values for selected control
	let selectedControlDef = $derived(controls.find(c => c.id === selectedControlId));
	let controlValues = $derived(selectedControlDef ? selectedControlDef.type.getValueMetadata().values : []);
	let needsValueSelection = $derived(controlValues.length > 1);

	// Update selected value when input changes
	$effect(() => {
		if (exportedValues.length > 0 && !exportedValues.find(v => v.key === selectedValueKey)) {
			selectedValueKey = exportedValues[0].key;
		}
	});

	// Update selected control when device changes
	$effect(() => {
		if (controls.length > 0 && !controls.find(c => c.id === selectedControlId)) {
			selectedControlId = controls[0].id;
		}
	});

	// Update value when control changes
	$effect(() => {
		if (needsValueSelection && controlValues.length > 0) {
			if (!controlValues.find(v => v.id === selectedValueId)) {
				selectedValueId = controlValues[0].id;
			}
		} else {
			selectedValueId = null;
		}
	});

	/**
	 * Open the dialog
	 * @param {Array} inputs - Available inputs (should be filtered to value-capable inputs)
	 * @param {Array} devs - Available devices
	 * @returns {Promise<Object|null>} Trigger configuration or null if cancelled
	 */
	export function open(inputs, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			availableInputs = inputs;
			devices = devs;

			// Initialize form state
			selectedInputId = inputs[0]?.id || null;
			selectedValueKey = 'value';
			selectedDeviceId = devs[0]?.id || null;
			selectedControlId = null;
			selectedValueId = null;
			invert = false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInputId || !selectedDeviceId || !selectedControlId) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return trigger configuration
		const result = {
			inputId: selectedInputId,
			inputValueKey: selectedValueKey,
			deviceId: selectedDeviceId,
			controlId: selectedControlId,
			controlValueId: needsValueSelection ? selectedValueId : null,
			invert
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

<Dialog bind:dialogRef={dialogRef} title="Create Value Trigger" onclose={handleCancel}>
	<form id="value-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<DialogColumns layout={['180px', 'line', '180px', '350px']}>
			{#snippet column1()}
				<!-- Column 1: Input Configuration -->
				<InputGroup label="Input:" for="value-trigger-input">
					<SelectField id="value-trigger-input" bind:value={selectedInputId}>
						{#each availableInputs as input}
							<option value={input.id}>{input.name}</option>
						{/each}
					</SelectField>
				</InputGroup>

				{#if exportedValues.length > 0}
					<InputGroup label="Value:" for="value-trigger-value">
						<SelectField id="value-trigger-value" bind:value={selectedValueKey}>
							{#each exportedValues as value}
								<option value={value.key}>{value.label}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}
			{/snippet}

			{#snippet column2()}
				<!-- Column 2: Device Configuration -->
				<InputGroup label="Device:" for="value-trigger-device">
					<SelectField id="value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssIdentifier}</option>
						{/each}
					</SelectField>
				</InputGroup>

				{#if controls.length > 0}
					<InputGroup label="Control:" for="value-trigger-control">
						<SelectField id="value-trigger-control" bind:value={selectedControlId}>
							{#each controls as control}
								<option value={control.id}>{control.type.name}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}

				{#if needsValueSelection}
					<InputGroup label="Component:" for="value-trigger-value-id">
						<SelectField id="value-trigger-value-id" bind:value={selectedValueId}>
							{#each controlValues as value}
								<option value={value.id}>{value.label}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}
			{/snippet}

			{#snippet column3()}
				<!-- Column 3: Options -->
				<DialogColumnPanel>
					<div class="checkbox-field">
						<label>
							<input
								type="checkbox"
								bind:checked={invert}
							/>
							Invert mapping
						</label>
						<p class="description">Reverse the input-to-output direction</p>
					</div>
				</DialogColumnPanel>
			{/snippet}
		</DialogColumns>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="value-trigger-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>
	.description {
		font-size: 9pt;
		color: #888;
		margin: 0;
		padding: 0;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 10pt;
		cursor: pointer;
	}

	.checkbox-field .description {
		margin-top: 4px;
		margin-left: 24px;
	}
</style>
