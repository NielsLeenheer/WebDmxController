<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { controlValuesToDMX } from '../../lib/outputs/controls.js';
    import { deviceLibrary } from '../../stores.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import DeviceCard from '../cards/DeviceCard.svelte';
    import Button from '../common/Button.svelte';
    import EditDeviceDialog from '../dialogs/EditDeviceDialog.svelte';

    let { dmxController, isActive = false } = $props();

    // Get devices
    let devices = $derived(deviceLibrary.getAll());

    // Device type selection
    let selectedType = $state('RGB');

    // Dialog reference
    let editDeviceDialog;

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => devices,
        onReorder: (orderedIds) => { deviceLibrary.reorder(orderedIds); },
        orientation: 'horizontal',
        dragByHeader: true
    });

    async function openSettingsDialog(device) {
        const result = await editDeviceDialog.open(device, devices);

        if (!result) return; // User cancelled

        if (result.delete) {
            removeDevice(device.id);
            return;
        }

        deviceLibrary.update(device.id, {
            startChannel: result.startChannel,
            name: result.name,
            linkedTo: result.linkedTo,
            syncedControls: result.syncedControls,
            mirrorPan: result.mirrorPan
        });
    }


    function getNextFreeChannel() {
        if (devices.length === 0) return 0; // Channel 1 (0-indexed)

        // Find the highest used channel
        let maxChannel = 0;
        devices.forEach(device => {
            const deviceEndChannel = device.startChannel + DEVICE_TYPES[device.type].channels;
            if (deviceEndChannel > maxChannel) {
                maxChannel = deviceEndChannel;
            }
        });

        // Return next free channel, or wrap to 1 if over 512
        return maxChannel >= 512 ? 0 : maxChannel;
    }

    export function addDevice(type = selectedType) {
        deviceLibrary.create(type, getNextFreeChannel());
    }

    function removeDevice(deviceId) {
        deviceLibrary.remove(deviceId);
    }

    function handleDeviceValueChange(device, controlId, value) {
        deviceLibrary.updateValue(device.id, controlId, value);
    }

    /**
     * Update DMX controller from device control values
     * NEW: Converts control values to DMX array before output
     */
    function updateDeviceToDMX(device) {
        if (!dmxController) return;

        // Get device type definition
        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return;

        // Convert control values to DMX array
        const dmxArray = controlValuesToDMX(deviceType, device.defaultValues);

        // Write DMX array to universe
        dmxArray.forEach((value, index) => {
            const channelIndex = device.startChannel + index;
            dmxController.setChannel(channelIndex, value);
        });
    }

    // Reactively update DMX controller when device values change
    // This runs when: controller changes, tab becomes active, or device values change
    $effect(() => {
        if (dmxController && isActive) {
            devices.forEach(device => {
                updateDeviceToDMX(device);
            });
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
        <Button onclick={() => addDevice(selectedType)} variant="secondary">
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
                onSettings={openSettingsDialog}
                onValueChange={handleDeviceValueChange}
            />
        {/each}
    </div>

    <!-- Edit Device Dialog -->
    <EditDeviceDialog
        bind:this={editDeviceDialog}
    />
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
