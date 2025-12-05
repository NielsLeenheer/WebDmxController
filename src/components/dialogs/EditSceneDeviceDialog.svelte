<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Controls from '../controls/Controls.svelte';
	import Preview from '../common/Preview.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';

	/**
	 * EditSceneDeviceDialog - Promise-based dialog for editing a device's settings within a scene
	 *
	 * Usage:
	 *   const result = await editSceneDeviceDialog.open(device, deviceEntry, animations);
	 *   if (result) {
	 *     // Update device in scene with result data
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let editingDevice = $state(null);
	let deviceEntry = $state(null);
	let availableAnimations = $state([]);

	// Form state
	let actionType = $state('values');
	let selectedAnimation = $state(null);
	let duration = $state(1000);
	let looping = $state(true);
	let easing = $state('linear');
	let controlValues = $state({});
	let enabledControls = $state([]);

	const ACTION_TYPES = [
		{ value: 'values', label: 'Set Values' },
		{ value: 'animation', label: 'Run Animation' }
	];

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)',
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
	];

	/**
	 * Open the dialog
	 * @param {Object} device - Device object from DeviceLibrary
	 * @param {Object} entry - Device entry from scene (or null for new)
	 * @param {Array} animations - Available animations
	 * @returns {Promise<{type, values, animation}|null>}
	 */
	export function open(device, entry, animations) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			editingDevice = device;
			deviceEntry = entry;
			availableAnimations = animations;

			// Initialize form state from entry or defaults
			if (entry) {
				actionType = entry.type || 'values';

				if (entry.type === 'animation' && entry.animation) {
					selectedAnimation = entry.animation.id;
					duration = entry.animation.duration || 1000;
					looping = entry.animation.iterations === 'infinite';
					easing = entry.animation.easing || 'linear';
					controlValues = {};
					enabledControls = [];
				} else {
					// Values type
					controlValues = { ...(entry.values || {}) };
					// Deep copy object values
					for (const [key, value] of Object.entries(controlValues)) {
						if (typeof value === 'object' && value !== null) {
							controlValues[key] = { ...value };
						}
					}
					enabledControls = Object.keys(controlValues);
					selectedAnimation = animations[0]?.id || null;
					duration = 1000;
					looping = true;
					easing = 'linear';
				}
			} else {
				// New entry - start with values mode and device defaults
				actionType = 'values';
				controlValues = { ...(device.defaultValues || {}) };
				for (const [key, value] of Object.entries(controlValues)) {
					if (typeof value === 'object' && value !== null) {
						controlValues[key] = { ...value };
					}
				}
				const deviceType = DEVICE_TYPES[device.type];
				enabledControls = deviceType ? deviceType.controls.map(c => c.id) : [];
				selectedAnimation = animations[0]?.id || null;
				duration = 1000;
				looping = true;
				easing = 'linear';
			}

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

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

	function handleSave() {
		if (!editingDevice) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		if (actionType === 'animation' && !selectedAnimation) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Build result based on action type
		if (actionType === 'animation') {
			const result = {
				type: 'animation',
				values: null,
				animation: {
					id: selectedAnimation,
					duration,
					easing,
					iterations: looping ? 'infinite' : 1
				}
			};
			resolvePromise(result);
		} else {
			// Filter controlValues to only include enabled controls
			const filteredValues = {};
			for (const controlId of enabledControls) {
				if (controlValues[controlId] !== undefined) {
					if (typeof controlValues[controlId] === 'object' && controlValues[controlId] !== null) {
						filteredValues[controlId] = { ...controlValues[controlId] };
					} else {
						filteredValues[controlId] = controlValues[controlId];
					}
				}
			}

			const result = {
				type: 'values',
				values: filteredValues,
				animation: null
			};
			resolvePromise(result);
		}

		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
		editingDevice = null;
		deviceEntry = null;
	}
</script>

{#if editingDevice}
<Dialog bind:dialogRef={dialogRef} title="Edit Device in Scene" onclose={handleCancel}>
	<form id="edit-scene-device-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="scene-device-columns">
			<!-- Column 1: Device Info -->
			<div class="scene-device-column">
				<div class="device-info">
					<Preview
						type="device"
						size="large"
						data={editingDevice}
					/>
					<div class="device-name">{editingDevice.name}</div>
				</div>

				<div class="dialog-input-group">
					<label for="scene-device-action-type">Mode:</label>
					<select id="scene-device-action-type" bind:value={actionType}>
						{#each ACTION_TYPES as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Column 2: Settings -->
			<div class="scene-device-column with-divider">
				<div class="scene-device-card">
					{#if actionType === 'animation'}
						<div class="dialog-input-group">
							<label for="scene-device-animation">Animation:</label>
							<select id="scene-device-animation" bind:value={selectedAnimation}>
								{#each availableAnimations as animation}
									<option value={animation.id}>{animation.name}</option>
								{/each}
							</select>
						</div>

						<div class="dialog-input-group">
							<label for="scene-device-duration">Duration (ms):</label>
							<div class="duration-with-loop">
								<input
									id="scene-device-duration"
									type="number"
									bind:value={duration}
									min="100"
									step="100"
									disabled={!selectedAnimation}
								/>
								<div class="checkbox-field">
									<label>
										<input
											type="checkbox"
											bind:checked={looping}
											disabled={!selectedAnimation}
										/>
										Loop
									</label>
								</div>
							</div>
						</div>

						<div class="dialog-input-group">
							<label for="scene-device-easing">Easing:</label>
							<select id="scene-device-easing" bind:value={easing} disabled={!selectedAnimation}>
								{#each EASING_FUNCTIONS as easingFn}
									<option value={easingFn}>{easingFn}</option>
								{/each}
							</select>
						</div>
					{:else}
						{@const deviceType = DEVICE_TYPES[editingDevice.type]}
						{#if deviceType}
							<Controls
								controls={deviceType.controls}
								bind:values={controlValues}
								onChange={handleControlValueChange}
								showCheckboxes={true}
								bind:enabledControls={enabledControls}
							/>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-scene-device-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
	.scene-device-columns {
		display: grid;
		grid-template-columns: 180px 400px;
		gap: 20px;
	}

	.scene-device-column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.scene-device-column.with-divider {
		border-left: 1px solid #ddd;
		padding-left: 20px;
	}

	.device-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 15px;
		background: #f6f6f6;
		border-radius: 6px;
	}

	.device-name {
		font-weight: 600;
		font-size: 11pt;
	}

	.scene-device-card {
		background: #f6f6f6;
		padding: 15px;
		border-radius: 6px;
		min-height: 200px;

		display: flex;
		flex-direction: column;
		align-items: start;
	}

	.scene-device-card .dialog-input-group {
		display: flex;
		align-items: baseline;
		margin-bottom: 10px;
	}

	.scene-device-card .dialog-input-group > :global(label) {
		width: 120px;
	}

	.duration-with-loop {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.duration-with-loop input[type="number"] {
		flex: 1;
		max-width: 120px;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10pt;
		cursor: pointer;
	}

	.scene-device-card :global(.controls) {
		margin: 0;
		grid-template-columns: 20px 5em 1fr 3em;
	}

	.scene-device-card :global(.controls .control) {
		margin-bottom: 8px;
	}
</style>
