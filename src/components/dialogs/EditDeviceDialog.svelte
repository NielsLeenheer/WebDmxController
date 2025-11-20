<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import CustomizeControlsDialog from './CustomizeControlsDialog.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { canLinkDevices, getAvailableSyncControls } from '../../lib/channelMapping.js';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditDeviceDialog - Promise-based dialog for editing DMX device settings
	 *
	 * Usage:
	 *   const result = await editDeviceDialog.open(device, allDevices);
	 *   if (result) {
	 *     if (result.delete) {
	 *       // Handle delete
	 *     } else {
	 *       // Update device with result.name, result.startChannel, result.linkedTo, etc.
	 *     }
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);
	let customizeControlsDialog = $state(null);

	// Edit state
	let editingDevice = $state(null);
	let allDevices = $state([]);
	let dialogName = $state('');
	let dialogChannel = $state(1);
	let selectedLinkTarget = $state(null);
	let selectedSyncControls = $state(null);
	let mirrorPan = $state(false);

	/**
	 * Open the dialog with a device
	 * @param {Device} device - The device to edit
	 * @param {Device[]} devices - All devices (for link validation)
	 * @returns {Promise<{name, startChannel, linkedTo, syncedControls, mirrorPan}|{delete: true}|null>}
	 */
	export function open(device, devices) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Copy device data to edit state
			editingDevice = device;
			allDevices = devices;
			dialogName = device.name;
			dialogChannel = device.startChannel + 1; // Convert to 1-indexed
			selectedLinkTarget = device.linkedTo || null;
			selectedSyncControls = device.syncedControls;
			mirrorPan = device.mirrorPan || false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function getPreviewCssId() {
		const name = dialogName.trim() || editingDevice?.name || '';
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '');
	}

	function isChannelValid(device, startChannel0indexed) {
		if (!device) return false;

		const deviceChannels = DEVICE_TYPES[device.type].channels;
		const endChannel = startChannel0indexed + deviceChannels;

		// Check if device would exceed channel 512
		if (endChannel > 512 || startChannel0indexed < 0) return false;

		// Check for overlaps with other devices
		for (let otherDevice of allDevices) {
			if (otherDevice.id === device.id) continue;

			const otherChannels = DEVICE_TYPES[otherDevice.type].channels;
			const otherStart = otherDevice.startChannel;
			const otherEnd = otherStart + otherChannels;

			// Check if ranges overlap
			if (startChannel0indexed < otherEnd && endChannel > otherStart) {
				return false;
			}
		}

		return true;
	}

	function getLinkableDevices(device) {
		if (!device) return [];
		return allDevices.filter(d =>
			d.id !== device.id &&
			!d.isLinked() && // Can't link to a device that's already linked
			canLinkDevices(device.type, d.type) &&
			d.linkedTo !== device.id // Don't allow circular links
		);
	}

	function getAvailableControlsForLink() {
		if (!selectedLinkTarget || !editingDevice) return [];

		const sourceDevice = allDevices.find(d => d.id === selectedLinkTarget);
		if (!sourceDevice) return [];

		return getAvailableSyncControls(sourceDevice.type, editingDevice.type);
	}

	async function openCustomizeControlsDialog() {
		// Open customize controls dialog (will stack on top of edit dialog)
		const result = await customizeControlsDialog.open(
			getAvailableControlsForLink(),
			selectedSyncControls,
			mirrorPan
		);

		// If user saved, update our state
		if (result) {
			selectedSyncControls = result.syncedControls;
			mirrorPan = result.mirrorPan;
		}
	}

	function handleSave() {
		if (!editingDevice || !dialogName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Validate channel
		if (!isChannelValid(editingDevice, dialogChannel - 1)) {
			return;
		}

		// Return modified data
		const result = {
			name: dialogName.trim(),
			startChannel: Math.max(0, Math.min(511, dialogChannel - 1)),
			linkedTo: selectedLinkTarget,
			syncedControls: selectedLinkTarget !== null ? selectedSyncControls : null,
			mirrorPan: selectedLinkTarget !== null ? mirrorPan : false
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function confirmDelete() {
		if (!editingDevice) return;

		if (confirm(`Are you sure you want to remove "${editingDevice.name}"?`)) {
			// Return special delete signal
			resolvePromise({ delete: true });
			closeDialog();
		}
	}

	function closeDialog() {
		dialogRef?.close();
		editingDevice = null;
		allDevices = [];
		dialogName = '';
		selectedLinkTarget = null;
		selectedSyncControls = null;
		mirrorPan = false;
	}
</script>

{#if editingDevice}
<Dialog
	bind:dialogRef={dialogRef}
	title="Device"
	onclose={handleCancel}
>
	<form id="device-settings-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="dialog-input-group">
			<label for="name-input">Name:</label>
			<input
				id="name-input"
				type="text"
				bind:value={dialogName}
				placeholder="Device name"
				autofocus
			/>

			<div class="css-identifiers">
				<code class="css-identifier">#{getPreviewCssId()}</code>
			</div>
		</div>

		<div class="dialog-input-group">
			<label for="channel-input">Starting channel (1-512):</label>
			<div>
				<input
					id="channel-input"
					type="number"
					min="1"
					max="512"
					bind:value={dialogChannel}
					class:valid={isChannelValid(editingDevice, dialogChannel - 1)}
					class:invalid={!isChannelValid(editingDevice, dialogChannel - 1)}
				/>
				<small class="channel-range">
					Device uses {DEVICE_TYPES[editingDevice.type].channels} channels:
					{dialogChannel}-{dialogChannel + DEVICE_TYPES[editingDevice.type].channels - 1}
				</small>
			</div>
		</div>

		<div class="dialog-input-group">
			<label for="link-select">Link to device:</label>
			{#if getLinkableDevices(editingDevice).length > 0 || editingDevice.isLinked()}
				<div class="link-select-row">
					<select id="link-select" bind:value={selectedLinkTarget}>
						<option value={null}>None</option>
						{#each getLinkableDevices(editingDevice) as linkableDevice}
							<option value={linkableDevice.id}>
								{linkableDevice.name} ({DEVICE_TYPES[linkableDevice.type].name})
							</option>
						{/each}
					</select>
					{#if selectedLinkTarget !== null && getAvailableControlsForLink().length > 0}
						<Button onclick={openCustomizeControlsDialog} variant="secondary">
							Customize
						</Button>
					{/if}
				</div>
			{:else}
				<p class="no-devices">No compatible devices available to link</p>
			{/if}
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
		<Button
			type="submit"
			form="device-settings-form"
			variant="primary"
			disabled={!isChannelValid(editingDevice, dialogChannel - 1)}
		>
			Save
		</Button>
	{/snippet}
</Dialog>
{/if}

<!-- Customize Controls Dialog (separate component) -->
<CustomizeControlsDialog bind:this={customizeControlsDialog} />

<style>
	.channel-range {
		display: block;
		margin-top: 4px;
		color: #666;
		font-size: 9pt;
	}

	.link-select-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.link-select-row select {
		flex: 1;
	}

	.no-devices {
		color: #666;
		font-size: 10pt;
		margin: 0;
	}
</style>
