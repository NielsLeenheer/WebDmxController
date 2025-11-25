<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';

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
	let selectedControlName = $state(null);
	let selectedChannel = $state(null);
	let invert = $state(false);

	// Derived values
	let selectedInput = $derived(availableInputs.find(i => i.id === selectedInputId));
	let exportedValues = $derived(selectedInput ? getInputExportedValues(selectedInput) : []);
	let selectedDevice = $derived(devices.find(d => d.id === selectedDeviceId));
	let deviceType = $derived(selectedDevice ? DEVICE_TYPES[selectedDevice.type] : null);
	let controls = $derived(deviceType ? deviceType.controls : []);

	// Get control channels for selected control
	let selectedControlDef = $derived(controls.find(c => c.name === selectedControlName));
	let controlChannels = $derived(selectedControlDef ? selectedControlDef.type.getChannels() : []);
	let needsChannelSelection = $derived(controlChannels.length > 1);

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
			selectedControlName = trig.controlName;
			selectedChannel = trig.controlChannel;
			invert = trig.invert || false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInputId || !selectedDeviceId || !selectedControlName) {
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
				controlName: selectedControlName,
				controlChannel: needsChannelSelection ? selectedChannel : null,
				invert
			}
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleDelete() {
		resolvePromise({ action: 'delete' });
		closeDialog();
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
			selectedControlName,
			needsChannelSelection ? selectedChannel : null
		);
		return meta?.description || '';
	}
</script>

<Dialog bind:dialogRef={dialogRef} title="Edit Value Trigger" onclose={handleCancel}>
	<form id="edit-value-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="trigger-columns">
			<!-- Column 1: Input Source -->
			<div class="trigger-column">
				<h4>Input Source</h4>

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

				{#if getInputValueDescription()}
					<p class="description">{getInputValueDescription()}</p>
				{/if}
			</div>

			<!-- Arrow -->
			<div class="arrow-column">
				<span class="arrow">→</span>
			</div>

			<!-- Column 2: Output Target -->
			<div class="trigger-column">
				<h4>Output Target</h4>

				<div class="dialog-input-group">
					<label for="edit-value-trigger-device">Device:</label>
					<select id="edit-value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssId}</option>
						{/each}
					</select>
				</div>

				{#if controls.length > 0}
					<div class="dialog-input-group">
						<label for="edit-value-trigger-control">Control:</label>
						<select id="edit-value-trigger-control" bind:value={selectedControlName}>
							{#each controls as control}
								<option value={control.name}>{control.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if needsChannelSelection}
					<div class="dialog-input-group">
						<label for="edit-value-trigger-channel">Channel:</label>
						<select id="edit-value-trigger-channel" bind:value={selectedChannel}>
							{#each controlChannels as channel}
								<option value={channel.key}>{channel.label}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if getControlDescription()}
					<p class="description">{getControlDescription()}</p>
				{/if}
			</div>

			<!-- Column 3: Options -->
			<div class="trigger-column options-column">
				<h4>Options</h4>

				<div class="checkbox-field">
					<label>
						<input
							type="checkbox"
							bind:checked={invert}
						/>
						Invert
					</label>
					<p class="description">Reverse the mapping direction</p>
				</div>
			</div>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleDelete} variant="danger">Delete</Button>
		<div class="spacer"></div>
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-value-trigger-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>

<style>
	.trigger-columns {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	.trigger-column {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 180px;
	}

	.trigger-column h4 {
		margin: 0 0 5px 0;
		font-size: 11pt;
		color: #666;
		font-weight: 500;
	}

	.arrow-column {
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: 40px;
	}

	.arrow {
		font-size: 24px;
		color: #888;
	}

	.options-column {
		border-left: 1px solid #ddd;
		padding-left: 20px;
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

	.spacer {
		flex: 1;
	}

	select {
		min-width: 150px;
	}
</style>
