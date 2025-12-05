<script>
	import { sceneLibrary, deviceLibrary, animationLibrary } from '../../stores.svelte.js';
	import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
	import SceneCard from '../cards/SceneCard.svelte';
	import SceneDeviceCard from '../cards/SceneDeviceCard.svelte';
	import Button from '../common/Button.svelte';
	import ContextMenu from '../common/ContextMenu.svelte';
	import ContextAction from '../common/ContextAction.svelte';
	import AddSceneDialog from '../dialogs/AddSceneDialog.svelte';
	import EditSceneDialog from '../dialogs/EditSceneDialog.svelte';
	import AddSceneDeviceDialog from '../dialogs/AddSceneDeviceDialog.svelte';
	import EditSceneDeviceDialog from '../dialogs/EditSceneDeviceDialog.svelte';

	import newIcon from '../../assets/icons/new.svg?raw';
	import editIcon from '../../assets/icons/edit.svg?raw';
	import removeIcon from '../../assets/icons/remove.svg?raw';
	import activeIcon from '../../assets/icons/active.svg?raw';

	let {
		sceneController
	} = $props();

	// Get data reactively from libraries
	let scenes = $derived(sceneLibrary.getAll());
	let devices = $derived(deviceLibrary.getAll());
	let animations = $derived(animationLibrary.getAll());

	// Get active scene
	let activeSceneId = $derived(sceneController?.getActiveSceneId() || 'default');

	// Selected scene (for showing devices)
	let selectedSceneId = $state('default');
	let selectedScene = $derived(sceneLibrary.get(selectedSceneId));

	// Get devices in selected scene with full device data
	let sceneDevices = $derived.by(() => {
		if (!selectedScene) return [];
		return selectedScene.devices.map(entry => {
			const device = deviceLibrary.get(entry.deviceId);
			const animation = entry.type === 'animation' && entry.animation?.id
				? animationLibrary.get(entry.animation.id)
				: null;
			return { device, entry, animation };
		}).filter(item => item.device); // Filter out devices that no longer exist
	});

	// Dialog references
	let addSceneDialog;
	let editSceneDialog;
	let addSceneDeviceDialog;
	let editSceneDeviceDialog;

	// Context menu references
	let sceneContextMenuRef = $state(null);
	let deviceContextMenuRef = $state(null);

	// Drag and drop for scenes
	const sceneDnd = createDragDrop({
		items: () => scenes.filter(s => !sceneLibrary.isDefault(s.id)),
		onReorder: (orderedIds) => {
			// Keep default scene at position -1, reorder others
			sceneLibrary.reorder(['default', ...orderedIds]);
		},
		orientation: 'vertical',
		type: 'scene'
	});

	// Drag and drop for devices within selected scene
	const deviceDnd = createDragDrop({
		items: () => selectedScene?.devices || [],
		onReorder: (orderedEntryIds) => {
			if (selectedSceneId) {
				sceneLibrary.reorderDevices(selectedSceneId, orderedEntryIds);
			}
		},
		orientation: 'vertical',
		type: 'scene-device',
		getItemId: (entry) => entry.entryId
	});

	// Scene actions
	async function openAddSceneDialog() {
		const result = await addSceneDialog.open();
		if (!result) return;

		const newScene = sceneLibrary.create({ name: result.name });
		selectedSceneId = newScene.id;
	}

	function selectScene(scene) {
		selectedSceneId = scene.id;
	}

	function activateScene(scene) {
		sceneController?.setScene(scene.id);
	}

	async function editScene(scene) {
		const result = await editSceneDialog.open(scene);
		if (!result) return;

		sceneLibrary.update(scene.id, { name: result.name });
	}

	function deleteScene(scene) {
		if (sceneLibrary.isDefault(scene.id)) return;

		if (confirm(`Are you sure you want to delete "${scene.name}"?`)) {
			// If deleting selected scene, switch to default
			if (selectedSceneId === scene.id) {
				selectedSceneId = 'default';
			}
			sceneLibrary.remove(scene.id);
			sceneController?.handleSceneDeleted(scene.id);
		}
	}

	// Device actions
	async function openAddDeviceDialog() {
		if (!selectedScene) return;

		const result = await addSceneDeviceDialog.open(devices);
		if (!result) return;

		// Add device with default values
		const device = deviceLibrary.get(result.deviceId);
		if (!device) return;

		sceneLibrary.addDevice(selectedSceneId, {
			deviceId: result.deviceId,
			type: 'values',
			values: { ...device.defaultValues }
		});
	}

	async function editDeviceInScene(device, deviceEntry) {
		const result = await editSceneDeviceDialog.open(device, deviceEntry, animations);
		if (!result) return;

		sceneLibrary.updateDevice(selectedSceneId, deviceEntry.entryId, result);
	}

	function removeDeviceFromScene(deviceEntry) {
		const device = deviceLibrary.get(deviceEntry.deviceId);
		const deviceName = device?.name || 'this device';
		if (confirm(`Remove "${deviceName}" entry from this scene?`)) {
			sceneLibrary.removeDevice(selectedSceneId, deviceEntry.entryId);
		}
	}

	// Check if a scene is the default
	function isDefaultScene(scene) {
		return sceneLibrary.isDefault(scene.id);
	}
</script>

<div class="scenes-view">
	<!-- Left column: Scenes list -->
	<div class="scenes-column">
		<div class="column-header">
			<Button onclick={openAddSceneDialog} variant="secondary" size="small">
				{@html newIcon}
				Add Scene
			</Button>
		</div>

		<div class="scenes-list">
			{#each scenes as scene (scene.id)}
				<SceneCard
					{scene}
					dnd={isDefaultScene(scene) ? null : sceneDnd}
					isActive={activeSceneId === scene.id}
					isSelected={selectedSceneId === scene.id}
					isDefault={isDefaultScene(scene)}
					onEdit={(item, anchor) => sceneContextMenuRef?.show(item, anchor)}
					onActivate={selectScene}
				/>
			{/each}
		</div>
	</div>

	<!-- Right column: Devices in selected scene -->
	<div class="devices-column">
		<div class="column-header">
			{#if selectedScene}
				<Button
					onclick={openAddDeviceDialog}
					variant="secondary"
					size="small"
					disabled={devices.length === 0}
				>
					{@html newIcon}
					Add Device
				</Button>
			{/if}
		</div>

		<div class="devices-list">
			{#if !selectedScene}
				<div class="empty-state">
					<p>Select a scene to view its devices</p>
				</div>
			{:else if sceneDevices.length === 0}
				<div class="empty-state">
					{#if isDefaultScene(selectedScene)}
						<p>The default scene uses device default values.</p>
						<p>Add devices to customize their values in this scene.</p>
					{:else}
						<p>No devices in this scene yet.</p>
						<p>Click "Add Device" to add devices with custom values or animations.</p>
					{/if}
				</div>
			{:else}
				{#each sceneDevices as { device, entry, animation } (entry.entryId)}
					<SceneDeviceCard
						{device}
						deviceEntry={entry}
						{animation}
						dnd={deviceDnd}
						onEdit={(d, e, anchor) => deviceContextMenuRef?.show({ device: d, entry: e }, anchor)}
					/>
				{/each}
			{/if}
		</div>
	</div>
</div>

<!-- Scene Dialogs -->
<AddSceneDialog bind:this={addSceneDialog} {sceneLibrary} />
<EditSceneDialog bind:this={editSceneDialog} {sceneLibrary} />

<!-- Device Dialogs -->
<AddSceneDeviceDialog bind:this={addSceneDeviceDialog} />
<EditSceneDeviceDialog bind:this={editSceneDeviceDialog} />

<!-- Scene Context Menu -->
<ContextMenu bind:contextRef={sceneContextMenuRef}>
	<ContextAction onclick={(scene) => editScene(scene)}>
		{@html editIcon}
		Edit
	</ContextAction>
	<ContextAction onclick={(scene) => activateScene(scene)}>
		{@html activeIcon}
		Activate
	</ContextAction>
	<ContextAction
		onclick={(scene) => deleteScene(scene)}
		variant="danger"
		disabled={(scene) => isDefaultScene(scene)}
	>
		{@html removeIcon}
		Delete
	</ContextAction>
</ContextMenu>

<!-- Device Context Menu -->
<ContextMenu bind:contextRef={deviceContextMenuRef}>
	<ContextAction onclick={({ device, entry }) => editDeviceInScene(device, entry)}>
		{@html editIcon}
		Edit
	</ContextAction>
	<ContextAction onclick={({ entry }) => removeDeviceFromScene(entry)} variant="danger">
		{@html removeIcon}
		Remove from Scene
	</ContextAction>
</ContextMenu>

<style>
	.scenes-view {
		display: grid;
		grid-template-columns: 320px 1fr;
		height: 100%;
		overflow: hidden;
	}

	.scenes-column,
	.devices-column {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px 40px;
	}

    .scenes-column .column-header {
        padding-right: 16px;
    }
    .devices-column .column-header {
        padding-left: 16px;
    }

	.scenes-list,
	.devices-list {
		flex: 1;
		overflow-y: auto;
		padding: 20px 40px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
    .scenes-column .scenes-list {
        padding-right: 16px;
    }
    .devices-column .devices-list {
        padding-left: 16px;
    }
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		font-size: 10pt;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		padding: 4px;
	}
</style>
