<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Preview from '../common/Preview.svelte';

	/**
	 * AddSceneDeviceDialog - Promise-based dialog for adding a device to a scene
	 *
	 * Usage:
	 *   const result = await addSceneDeviceDialog.open(devices);
	 *   if (result) {
	 *     // Add device with result.deviceId to scene
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let availableDevices = $state([]);

	// Form state
	let selectedDeviceId = $state(null);

	/**
	 * Open the dialog
	 * @param {Array} devices - All devices from DeviceLibrary
	 * @returns {Promise<{deviceId: string}|null>}
	 */
	export function open(devices) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// All devices are available (same device can be added multiple times)
			availableDevices = devices;

			// Select first available device
			selectedDeviceId = availableDevices[0]?.id || null;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleAdd() {
		if (!selectedDeviceId) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		const result = {
			deviceId: selectedDeviceId
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
		availableDevices = [];
		selectedDeviceId = null;
	}

	let selectedDevice = $derived(availableDevices.find(d => d.id === selectedDeviceId));
</script>

<Dialog
	bind:dialogRef={dialogRef}
	title="Add Device to Scene"
	onclose={handleCancel}
>
	{#if availableDevices.length === 0}
		<p class="no-devices">All devices have already been added to this scene.</p>
	{:else}
		<form id="add-scene-device-form" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
			<div class="dialog-input-group">
				<label for="device-select">Device:</label>
				<div class="device-select-row">
					{#if selectedDevice}
						<Preview
							type="device"
							size="medium"
							data={selectedDevice}
						/>
					{/if}
					<select id="device-select" bind:value={selectedDeviceId}>
						{#each availableDevices as device}
							<option value={device.id}>{device.name}</option>
						{/each}
					</select>
				</div>
			</div>
		</form>
	{/if}

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button
			type="submit"
			form="add-scene-device-form"
			variant="primary"
			disabled={availableDevices.length === 0}
		>Add</Button>
	{/snippet}
</Dialog>

<style>
	.no-devices {
		color: #666;
		font-size: 10pt;
		margin: 0;
	}

	.device-select-row {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.device-select-row select {
		flex: 1;
	}
</style>
