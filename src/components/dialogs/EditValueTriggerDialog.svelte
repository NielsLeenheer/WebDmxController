<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditValueTriggerDialog - Promise-based dialog for editing value-based triggers
	 *
	 * Usage:
	 *   const result = await editValueTriggerDialog.open(trigger, availableInputs, devices);
	 *   if (result.action === 'save') { ... }
	 *   if (result.action === 'delete') { ... }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let trigger = $state(null);
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

	/**
	 * Open the dialog
	 * @param {Object} trig - Existing trigger to edit
	 * @param {Array} inputs - Available inputs
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{action: 'save'|'delete'|'cancel', data: Object}>}
	 */
	export function open(trig, inputs, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			trigger = trig;
			availableInputs = inputs;
			devices = devs;

			// Initialize form state from existing trigger
			selectedInputId = trig.inputId;
			selectedValueKey = trig.inputValueKey || 'value';
			selectedDeviceId = trig.deviceId;
			selectedControlId = trig.controlId;
			selectedValueId = trig.controlValueId;
			invert = trig.invert || false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInputId || !selectedDeviceId || !selectedControlId) {
			resolvePromise({ action: 'cancel' });
			closeDialog();
			return;
		}

		// Return updated trigger configuration
		const result = {
			action: 'save',
			data: {
				inputId: selectedInputId,
				inputValueKey: selectedValueKey,
				deviceId: selectedDeviceId,
				controlId: selectedControlId,
				controlValueId: needsValueSelection ? selectedValueId : null,
				invert
			}
		};

		resolvePromise(result);
		closeDialog();
	}

	function confirmDelete() {
		if (confirm('Are you sure you want to delete this trigger?')) {
			resolvePromise({ action: 'delete' });
			closeDialog();
		}
	}

	function handleCancel() {
		resolvePromise({ action: 'cancel' });
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
	}

	// Get description of the selected input value
	function getInputValueDescription() {
		const value = exportedValues.find(v => v.key === selectedValueKey);
		return value?.description || '';
	}

	// Get description of the selected control
	function getControlDescription() {
		if (!selectedControlDef) return '';
		const meta = selectedControlDef.type.getValueMetadata(
			selectedControlId,
			needsValueSelection ? selectedValueId : null
		);
		return meta?.description || '';
	}
</script>

<Dialog bind:dialogRef={dialogRef} title="Edit Value Trigger" onclose={handleCancel}>
	<form id="edit-value-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Input Configuration -->
			<div class="trigger-column">
				<div class="dialog-input-group">
					<label for="edit-value-trigger-input">Input:</label>
					<select id="edit-value-trigger-input" bind:value={selectedInputId}>
						{#each availableInputs as input}
							<option value={input.id}>{input.name}</option>
						{/each}
					</select>
				</div>

				{#if exportedValues.length > 0}
					<div class="dialog-input-group">
						<label for="edit-value-trigger-value">Value:</label>
						<select id="edit-value-trigger-value" bind:value={selectedValueKey}>
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
					<label for="edit-value-trigger-device">Device:</label>
					<select id="edit-value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssIdentifier}</option>
						{/each}
					</select>
				</div>

				{#if controls.length > 0}
					<div class="dialog-input-group">
						<label for="edit-value-trigger-control">Control:</label>
						<select id="edit-value-trigger-control" bind:value={selectedControlId}>
							{#each controls as control}
								<option value={control.id}>{control.type.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if needsValueSelection}
					<div class="dialog-input-group">
						<label for="edit-value-trigger-value-id">Component:</label>
						<select id="edit-value-trigger-value-id" bind:value={selectedValueId}>
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

	{#snippet tools()}
		<Button onclick={confirmDelete} variant="secondary">
			{@html removeIcon}
			Delete
		</Button>
	{/snippet}

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-value-trigger-form" variant="primary">Save</Button>
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
