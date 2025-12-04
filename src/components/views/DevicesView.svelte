<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { deviceLibrary } from '../../stores.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import DeviceCard from '../cards/DeviceCard.svelte';
    import Button from '../common/Button.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import EditDeviceDialog from '../dialogs/EditDeviceDialog.svelte';

    import newIcon from '../../assets/icons/new.svg?raw';
    import editIcon from '../../assets/icons/edit.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let { dmxController, isActive = false } = $props();

    // Get devices
    let devices = $derived(deviceLibrary.getAll());

    // Device type selection
    let selectedType = $state('rgb');

    // Dialog reference
    let editDeviceDialog;

    // Context menu state
    let contextMenuRef = $state(null);

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => devices,
        onReorder: (orderedIds) => { deviceLibrary.reorder(orderedIds); },
        orientation: 'horizontal',
        dragByHeader: true
    });

    async function startEditing(device) {
        const result = await editDeviceDialog.open(device, devices);

        if (!result) return; // User cancelled

        deviceLibrary.update(device.id, {
            startChannel: result.startChannel,
            name: result.name,
            linkedTo: result.linkedTo,
            syncedControls: result.syncedControls,
            mirrorPan: result.mirrorPan
        });
    }

    function deleteDevice(deviceId) {
        const device = deviceLibrary.get(deviceId);
        if (!device) return;

        if (!confirm(`Are you sure you want to delete "${device.name}"?`)) return;

        deviceLibrary.remove(deviceId);
    }

    function addDevice() {
        deviceLibrary.create(selectedType);
    }

    function handleDeviceValueChange(device, controlId, value) {
        deviceLibrary.updateValue(device.id, controlId, value);
    }

    // Reactively update DMX controller when device values change
    // This runs when: controller changes, tab becomes active, or device values change
    $effect(() => {
        if (dmxController && isActive) {
            for (const device of devices) {
                dmxController.updateDevice(device);
            }
        }
    });
</script>

<div class="devices-container">
    <div class="add-device-section">
        <select bind:value={selectedType}>
            {#each Object.entries(DEVICE_TYPES) as [key, type]}
                <option value={key}>{type.name}</option>
            {/each}
        </select>
        <Button onclick={addDevice} variant="secondary">
            {@html newIcon}
            Add Device
        </Button>
    </div>

    <div class="devices-list">
        {#if devices.length === 0}
            <div class="empty-state">
                <p>No devices added yet. Add a device to get started!</p>
            </div>
        {/if}

        {#each devices as device (device.id)}
            <DeviceCard
                {device}
                {dnd}
                {devices}
                onEdit={(device, anchor) => contextMenuRef?.show(device, anchor)}
                onValueChange={handleDeviceValueChange}
            />
        {/each}
    </div>

    <!-- Edit Device Dialog -->
    <EditDeviceDialog
        bind:this={editDeviceDialog}
        {deviceLibrary}
    />

    <!-- Context Menu -->
    <ContextMenu bind:contextRef={contextMenuRef}>
        <ContextAction onclick={(device) => startEditing(device)}>
            {@html editIcon}
            Edit
        </ContextAction>
        <ContextAction onclick={(device) => deleteDevice(device?.id)} variant="danger">
            {@html removeIcon}
            Delete
        </ContextAction>
    </ContextMenu>
</div>

<style>
    .devices-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .add-device-section {
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
    }

    .add-device-section select {
        min-width: 200px;
        border: 2px solid #f0f0f0;
        cursor: pointer;
    }

    .add-device-section select:focus {
        outline: none;
        border-color: #2196F3;
    }

    .devices-list {
        overflow-y: auto;
        padding: 20px 40px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(16em, 1fr));
        gap: 15px;
    }

    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        min-height: 50vh;
        align-content: center;
        color: #999;
        font-size: 0.9em;
    }
</style>
