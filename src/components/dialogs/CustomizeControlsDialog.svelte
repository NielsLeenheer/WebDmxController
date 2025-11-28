<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';

	/**
	 * CustomizeControlsDialog - Promise-based dialog for customizing synced controls
	 *
	 * Usage:
	 *   const result = await customizeControlsDialog.open(availableControls, selectedControls, mirrorPan);
	 *   if (result) {
	 *     // Update with result.syncedControls, result.mirrorPan
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Edit state
	let availableControls = $state([]);
	let selectedSyncControls = $state(null);
	let mirrorPan = $state(false);

	/**
	 * Open the dialog
	 * @param {Array} controls - Available controls for syncing
	 * @param {Array|null} currentSelected - Currently selected controls (null = all)
	 * @param {boolean} currentMirrorPan - Current mirror pan setting
	 * @returns {Promise<{syncedControls, mirrorPan}|null>}
	 */
	export function open(controls, currentSelected, currentMirrorPan) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Copy data to edit state
			availableControls = controls;
			selectedSyncControls = currentSelected;
			mirrorPan = currentMirrorPan || false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function isSyncControlSelected(controlId) {
		if (selectedSyncControls === null) return true; // All controls selected
		return selectedSyncControls.includes(controlId);
	}

	function toggleSyncControl(controlId) {
		if (selectedSyncControls === null) {
			// If currently syncing all, create array with all except this one
			selectedSyncControls = availableControls
				.map(c => c.controlId)
				.filter(id => id !== controlId);
		} else if (selectedSyncControls.includes(controlId)) {
			// Remove from array
			selectedSyncControls = selectedSyncControls.filter(id => id !== controlId);
		} else {
			// Add to array
			selectedSyncControls = [...selectedSyncControls, controlId];
		}
	}

	function handleDone() {
		// Return modified data
		const result = {
			syncedControls: selectedSyncControls,
			mirrorPan: mirrorPan
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
		availableControls = [];
		selectedSyncControls = null;
		mirrorPan = false;
	}
</script>

<Dialog
	bind:dialogRef={dialogRef}
	title="Synced controls"
	onclose={handleCancel}
>
	<div class="customize-controls-content">
		<p class="dialog-description">Select which controls to sync from the linked device:</p>
		<div class="sync-controls-vertical">
			{#each availableControls as control}
				<div class="sync-control-row">
					<label class="sync-control-item">
						<input
							type="checkbox"
							checked={isSyncControlSelected(control.controlId)}
							onchange={() => toggleSyncControl(control.controlId)}
						/>
						<span>{control.sourceControl.type.name}</span>
					</label>
					{#if control.controlId === 'pantilt'}
						<label class="mirror-option">
							—
							<input
								type="checkbox"
								bind:checked={mirrorPan}
								disabled={!isSyncControlSelected('pantilt')}
							/>
							<span>Mirror</span>
						</label>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#snippet buttons()}
		<Button onclick={handleDone} variant="primary">Done</Button>
	{/snippet}
</Dialog>

<style>
	.customize-controls-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dialog-description {
		margin: 0;
		color: #666;
		font-size: 10pt;
	}

	.sync-controls-vertical {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sync-control-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sync-control-item {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
	}

	.sync-control-item input[type="checkbox"] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.sync-control-item span {
		font-size: 10pt;
		color: #333;
	}

	.mirror-option {
		display: flex;
		align-items: center;
		gap: 4px;
		color: #666;
		font-size: 9pt;
		cursor: pointer;
		user-select: none;
	}

	.mirror-option input[type="checkbox"] {
		cursor: pointer;
		width: 14px;
		height: 14px;
	}

	.mirror-option input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
