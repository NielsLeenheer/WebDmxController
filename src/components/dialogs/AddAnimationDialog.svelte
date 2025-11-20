<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { toCSSIdentifier } from '../../lib/css/utils.js';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';

	/**
	 * AddAnimationDialog - Promise-based dialog for creating new animations
	 *
	 * Usage:
	 *   const result = await addAnimationDialog.open();
	 *   if (result) {
	 *     // Create animation with result.name and result.target
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Form state
	let animationName = $state('');
	let selectedTarget = $state('control|Color');

	/**
	 * Open the dialog
	 * @returns {Promise<{name: string, target: string}|null>}
	 */
	export function open() {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Reset form
			animationName = '';
			selectedTarget = 'control|Color';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	// Build complete list of animation targets (controls + device types)
	function getAllAnimationTargets() {
		const targets = [];

		// First, collect all unique control names across all device types
		const controlNamesSet = new Set();
		for (const deviceDef of Object.values(DEVICE_TYPES)) {
			for (const control of deviceDef.controls) {
				controlNamesSet.add(control.name);
			}
		}

		// Add individual controls (device-agnostic)
		const sortedControlNames = Array.from(controlNamesSet).sort();
		for (const controlName of sortedControlNames) {
			targets.push({
				type: 'control',
				value: `control|${controlName}`,
				label: controlName
			});
		}

		// Add separator
		targets.push({ type: 'separator' });

		// Add device types (all controls)
		for (const [deviceKey, deviceDef] of Object.entries(DEVICE_TYPES)) {
			targets.push({
				type: 'device',
				value: `device|${deviceKey}`,
				label: deviceDef.name
			});
		}

		return targets;
	}

	function handleCreate() {
		if (!animationName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return animation data
		const result = {
			name: animationName.trim(),
			target: selectedTarget
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
		animationName = '';
		selectedTarget = 'control|Color';
	}
</script>

<Dialog
	bind:dialogRef={dialogRef}
	title="Create New Animation"
	onclose={handleCancel}
>
	<form id="new-animation-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
		<div class="dialog-input-group">
			<label for="animation-name">Animation Name:</label>
			<input
				id="animation-name"
				type="text"
				bind:value={animationName}
				placeholder="e.g., rainbow, pulse, sweep"
				autofocus
			/>
			<div class="css-identifiers">
				<code class="css-identifier">@keyframes {toCSSIdentifier(animationName)}</code>
			</div>
		</div>

		<div class="dialog-input-group">
			<label for="animation-target">Target:</label>
			<select id="animation-target" bind:value={selectedTarget} class="animation-target-select">
				{#each getAllAnimationTargets() as target}
					{#if target.type === 'separator'}
						<option disabled>──────────</option>
					{:else}
						<option value={target.value}>{target.label}</option>
					{/if}
				{/each}
			</select>
			<small class="help-text">Select a specific control or entire device type</small>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="new-animation-form" variant="primary">Create</Button>
	{/snippet}
</Dialog>

<style>
	.animation-target-select {
		width: 100%;
	}

	.help-text {
		display: block;
		margin-top: 4px;
		color: #666;
		font-size: 9pt;
	}
</style>
