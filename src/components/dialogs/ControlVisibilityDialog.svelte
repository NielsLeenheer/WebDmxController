<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { isControlVisible } from '../../lib/outputs/controls.js';

	/**
	 * ControlVisibilityDialog - Promise-based dialog for toggling which
	 * controls appear on a device card.
	 *
	 * Usage:
	 *   const result = await dialog.open(device);
	 *   if (result) { deviceLibrary.update(device.id, { controlVisibility: result }); }
	 */

	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	let deviceRef = $state(null);
	let visibility = $state({});

	export function open(device) {
		return new Promise((resolve) => {
			resolvePromise = resolve;
			deviceRef = device;
			visibility = { ...(device.controlVisibility ?? {}) };
			requestAnimationFrame(() => dialogRef?.showModal());
		});
	}

	function controls() {
		if (!deviceRef) return [];
		const deviceType = DEVICE_TYPES[deviceRef.type];
		return (deviceType?.controls ?? []).filter(c => !c.separator);
	}

	function isVisible(control) {
		return isControlVisible(control, visibility);
	}

	// At least one control must remain visible — an all-hidden device card
	// would have nothing to show, so we block the save.
	let canSave = $derived.by(() => controls().some(c => isVisible(c)));

	function toggle(control) {
		const next = !isVisible(control);
		const defaultVisible = !control.hidden;
		if (next === defaultVisible) {
			// Back to default — remove the override.
			const { [control.id]: _discard, ...rest } = visibility;
			visibility = rest;
		} else {
			visibility = { ...visibility, [control.id]: next };
		}
	}

	function handleSave() {
		if (!canSave) return;
		resolvePromise(visibility);
		close();
	}

	function handleCancel() {
		resolvePromise(null);
		close();
	}

	function close() {
		dialogRef?.close();
		deviceRef = null;
		visibility = {};
	}
</script>

{#if deviceRef}
<Dialog
	bind:dialogRef={dialogRef}
	title="Controls"
	onclose={handleCancel}
>
	<div class="visibility-content">
		<p class="dialog-description">Choose which controls to show on this device:</p>
		<div class="visibility-list">
			{#each controls() as control (control.id)}
				<label class="visibility-row">
					<input
						type="checkbox"
						checked={isVisible(control)}
						onchange={() => toggle(control)}
					/>
					<span>{control.type.name}</span>
				</label>
			{/each}
		</div>
	</div>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleSave} variant="primary" disabled={!canSave}>Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
	.visibility-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dialog-description {
		margin: 0;
		color: #666;
		font-size: 10pt;
	}

	.visibility-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.visibility-row {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
	}

	.visibility-row input[type="checkbox"] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.visibility-row span {
		font-size: 10pt;
		color: #333;
	}
</style>
