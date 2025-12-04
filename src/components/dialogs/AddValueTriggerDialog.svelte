<script>
	import Dialog from '../common/Dialog.svelte';
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
		<div class="trigger-columns">
			<!-- Column 1: Input Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="value-trigger-input">Input:</label>
					<select id="value-trigger-input" bind:value={selectedInputId}>
						{#each availableInputs as input}
							<option value={input.id}>{input.name}</option>
						{/each}
					</select>
				</div>

				{#if exportedValues.length > 0}
					<div class="dialog-input-group">
						<label for="value-trigger-value">Value:</label>
						<select id="value-trigger-value" bind:value={selectedValueKey}>
							{#each exportedValues as value}
								<option value={value.key}>{value.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<!-- Column 2: Device Configuration -->
			<div class="trigger-column with-divider">
				<div class="dialog-input-group">
					<label for="value-trigger-device">Device:</label>
					<select id="value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssIdentifier}</option>
						{/each}
					</select>
				</div>

				{#if controls.length > 0}
					<div class="dialog-input-group">
						<label for="value-trigger-control">Control:</label>
						<select id="value-trigger-control" bind:value={selectedControlId}>
							{#each controls as control}
								<option value={control.id}>{control.type.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if needsValueSelection}
					<div class="dialog-input-group">
						<label for="value-trigger-value-id">Component:</label>
						<select id="value-trigger-value-id" bind:value={selectedValueId}>
							{#each controlValues as value}
								<option value={value.id}>{value.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<!-- Column 3: Options -->
			<div class="trigger-column">
				<div class="trigger-card">
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
				</div>
			</div>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="value-trigger-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

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
		min-height: 100px;
	}

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
