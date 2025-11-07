<script>
    import { Icon } from 'svelte-icon';
    import { DEVICE_TYPES, Device } from '../lib/devices.js';
    import { canLinkDevices, applyLinkedValues, getMappedChannels } from '../lib/channelMapping.js';
    import { getDeviceColor } from '../lib/colorUtils.js';
    import DeviceControls from './DeviceControls.svelte';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';
    import settingsIcon from '../assets/icons/settings.svg?raw';

    let { dmxController, selectedType = $bindable(), devices = $bindable([]) } = $props();

    // Settings dialog state
    let settingsDialog = $state(null);
    let editingDevice = $state(null);
    let dialogName = $state('');
    let dialogChannel = $state(1);
    let selectedLinkTarget = $state(null);

    function openSettingsDialog(device) {
        editingDevice = device;
        dialogName = device.name;
        dialogChannel = device.startChannel + 1;
        selectedLinkTarget = device.linkedTo || null;
        settingsDialog?.showModal();
    }

    function closeSettingsDialog() {
        settingsDialog?.close();
        editingDevice = null;
        dialogName = '';
        selectedLinkTarget = null;
    }

    function saveDeviceSettings() {
        if (!editingDevice) return;

        // Validate channel
        if (!isChannelValid(editingDevice, dialogChannel - 1)) {
            return;
        }

        const newStartChannel = Math.max(0, Math.min(511, dialogChannel - 1));

        // Create new Device instance with all updated properties
        const updatedDevice = new Device(
            editingDevice.id,
            editingDevice.type,
            newStartChannel,
            dialogName.trim() || editingDevice.name,
            selectedLinkTarget
        );
        updatedDevice.defaultValues = [...editingDevice.defaultValues];

        // If linking, apply values from source device
        if (selectedLinkTarget !== null) {
            const sourceDevice = devices.find(d => d.id === selectedLinkTarget);
            if (sourceDevice) {
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    updatedDevice.type,
                    sourceDevice.defaultValues,
                    updatedDevice.defaultValues
                );
                updatedDevice.defaultValues = newValues;
            }
        }

        // Update DMX controller with new channel values
        if (dmxController) {
            updatedDevice.defaultValues.forEach((value, index) => {
                const channelIndex = updatedDevice.startChannel + index;
                dmxController.setChannel(channelIndex, value);
            });
        }

        // Update devices array
        devices = devices.map(d => d.id === editingDevice.id ? updatedDevice : d);

        closeSettingsDialog();
    }

    function isChannelValid(device, startChannel0indexed) {
        const deviceChannels = DEVICE_TYPES[device.type].channels;
        const endChannel = startChannel0indexed + deviceChannels;

        // Check if device would exceed channel 512
        if (endChannel > 512 || startChannel0indexed < 0) return false;

        // Check for overlaps with other devices
        for (let otherDevice of devices) {
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

    // Load initial state from localStorage
    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('dmx-devices');
            if (saved) {
                const data = JSON.parse(saved);
                // Reconstruct Device objects
                const loadedDevices = data.devices.map(d => {
                    const device = new Device(d.id, d.type, d.startChannel, d.name, d.linkedTo);
                    device.defaultValues = d.defaultValues || new Array(DEVICE_TYPES[d.type].channels).fill(0);
                    return device;
                });
                return {
                    devices: loadedDevices,
                    nextId: data.nextId || 1
                };
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return { devices: [], nextId: 1 };
    }

    // Initialize devices from localStorage if empty
    let nextId = $state(1);

    if (devices.length === 0) {
        const initialState = loadFromLocalStorage();
        devices = initialState.devices;
        nextId = initialState.nextId;
    }

    // Save to localStorage whenever devices change
    $effect(() => {
        try {
            const data = {
                devices: devices.map(d => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    startChannel: d.startChannel,
                    defaultValues: d.defaultValues,
                    linkedTo: d.linkedTo
                })),
                nextId
            };
            localStorage.setItem('dmx-devices', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    });

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

    function validateDevice(device) {
        const deviceChannels = DEVICE_TYPES[device.type].channels;
        const deviceEnd = device.startChannel + deviceChannels;

        // Check if device goes beyond channel 512
        if (deviceEnd > 512) {
            return false;
        }

        // Check for overlaps with other devices
        for (let otherDevice of devices) {
            if (otherDevice.id === device.id) continue;

            const otherChannels = DEVICE_TYPES[otherDevice.type].channels;
            const otherStart = otherDevice.startChannel;
            const otherEnd = otherStart + otherChannels;

            // Check if ranges overlap
            if (device.startChannel < otherEnd && deviceEnd > otherStart) {
                return false;
            }
        }

        return true;
    }

    export function addDevice(type = selectedType) {
        const startChannel = getNextFreeChannel();
        const device = new Device(nextId++, type, startChannel);
        devices.push(device);
    }

    export function clearAllDeviceValues() {
        // Reset all device default values to 0
        devices = devices.map(d => {
            d.defaultValues = d.defaultValues.map(() => 0);
            return d;
        });
    }

    function removeDevice(deviceId) {
        // Also unlink any devices linked to this one
        devices = devices.map(d => {
            if (d.linkedTo === deviceId) {
                d.linkedTo = null;
            }
            return d;
        }).filter(d => d.id !== deviceId);
    }

    function handleDeviceValueChange(device, channelIndex, value) {
        // Create new device instance with updated value
        const updatedDevice = new Device(
            device.id,
            device.type,
            device.startChannel,
            device.name,
            device.linkedTo
        );
        updatedDevice.defaultValues = [...device.defaultValues];
        updatedDevice.defaultValues[channelIndex] = value;

        // Update devices array with new instance
        devices = devices.map(d => d.id === device.id ? updatedDevice : d);

        // Update DMX controller
        updateDeviceToDMX(updatedDevice);

        // Propagate to linked devices
        propagateToLinkedDevices(updatedDevice);
    }

    function updateDeviceToDMX(device) {
        if (!dmxController) return;

        device.defaultValues.forEach((value, index) => {
            const channelIndex = device.startChannel + index;
            dmxController.setChannel(channelIndex, value);
        });
    }

    function propagateToLinkedDevices(sourceDevice) {
        // Create new device instances for all linked devices
        devices = devices.map(device => {
            if (device.linkedTo === sourceDevice.id) {
                // Create new device instance to trigger reactivity
                const updatedDevice = new Device(
                    device.id,
                    device.type,
                    device.startChannel,
                    device.name,
                    device.linkedTo
                );

                // Apply linked values
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    device.type,
                    sourceDevice.defaultValues,
                    device.defaultValues
                );
                updatedDevice.defaultValues = newValues;

                // Update DMX
                updateDeviceToDMX(updatedDevice);

                return updatedDevice;
            }
            return device;
        });
    }

    function getLinkableDevices(device) {
        return devices.filter(d =>
            d.id !== device.id &&
            !d.isLinked() && // Can't link to a device that's already linked
            canLinkDevices(device.type, d.type) &&
            d.linkedTo !== device.id // Don't allow circular links
        );
    }

    function getDisabledChannels(device) {
        if (!device.linkedTo) return [];

        const sourceDevice = devices.find(d => d.id === device.linkedTo);
        if (!sourceDevice) return [];

        return getMappedChannels(sourceDevice.type, device.type);
    }

    // Restore all device values to DMX controller on load
    $effect(() => {
        if (dmxController) {
            devices.forEach(device => {
                updateDeviceToDMX(device);
            });
        }
    });
</script>

<div class="devices-container">
    <div class="devices-list">
        {#if devices.length === 0}
            <div class="empty-state">
                <p>No devices added yet. Add a device to get started!</p>
            </div>
        {/if}

        {#each devices as device (device.id)}
            <div class="device-card">
                <div class="device-header">
                    <div
                        class="color-preview"
                        style="background-color: {getDeviceColor(device.type, device.defaultValues)}"
                    ></div>
                    <h3>{device.name}</h3>
                    <span class="channel-info">
                        Ch {device.startChannel + 1}-{device.startChannel + DEVICE_TYPES[device.type].channels}
                    </span>
                    {#if device.isLinked()}
                        <span class="link-indicator" title="Linked to another device">🔗</span>
                    {/if}
                    <button
                        class="settings-btn"
                        onclick={() => openSettingsDialog(device)}
                        title="Device settings"
                    >
                        <Icon data={settingsIcon} />
                    </button>
                    <button class="remove-btn" onclick={() => removeDevice(device.id)}>
                        <Icon data={disconnectIcon} />
                    </button>
                </div>

                <DeviceControls
                    deviceType={device.type}
                    bind:values={device.defaultValues}
                    onChange={(channelIndex, value) => handleDeviceValueChange(device, channelIndex, value)}
                    disabledChannels={getDisabledChannels(device)}
                />
            </div>
        {/each}
    </div>

    <dialog bind:this={settingsDialog} class="settings-dialog">
        {#if editingDevice}
            <form method="dialog" onsubmit={(e) => { e.preventDefault(); saveDeviceSettings(); }}>
                <h3>Device Settings</h3>

                <div class="dialog-input-group">
                    <label for="name-input">Name:</label>
                    <input
                        id="name-input"
                        type="text"
                        bind:value={dialogName}
                        placeholder="Device name"
                    />
                </div>

                <div class="dialog-input-group">
                    <label for="channel-input">Starting channel (1-512):</label>
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
                        Device uses {DEVICE_TYPES[editingDevice.type].channels} channels
                        (Ch {dialogChannel}-{dialogChannel + DEVICE_TYPES[editingDevice.type].channels - 1})
                    </small>
                </div>

                <div class="dialog-input-group">
                    <label for="link-select">Link to device:</label>
                    {#if getLinkableDevices(editingDevice).length > 0 || editingDevice.isLinked()}
                        <select id="link-select" bind:value={selectedLinkTarget}>
                            <option value={null}>None</option>
                            {#each getLinkableDevices(editingDevice) as linkableDevice}
                                <option value={linkableDevice.id}>
                                    {linkableDevice.name} ({DEVICE_TYPES[linkableDevice.type].name})
                                </option>
                            {/each}
                        </select>
                        <small class="link-help">Link this device to follow another device's values</small>
                    {:else}
                        <p class="no-devices">No compatible devices available to link</p>
                    {/if}
                </div>

                <div class="dialog-buttons">
                    <button type="button" onclick={closeSettingsDialog}>Cancel</button>
                    <button
                        type="submit"
                        disabled={!isChannelValid(editingDevice, dialogChannel - 1)}
                    >
                        Save
                    </button>
                </div>
            </form>
        {/if}
    </dialog>
</div>

<style>
    .devices-container {
        flex: 1;
        overflow: auto;
        padding: 20px;
    }

    .devices-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(20em, 1fr));
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

    .device-card {
        background: #f0f0f0;
        border-radius: 8px;
        padding: 15px;
    }

    .device-header {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        gap: 8px;
    }

    .color-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.15);
        flex-shrink: 0;
    }

    .device-header h3 {
        margin: 0;
        font-size: 12pt;
        color: #333;
    }

    .channel-info {
        font-size: 8pt;
        color: #888;
        white-space: nowrap;
    }

    .link-indicator {
        font-size: 11pt;
        line-height: 1;
    }

    .settings-btn,
    .remove-btn {
        margin: 0;
        padding: 2px;
        width: 20px;
        height: 20px;
        background: transparent;
        border: none;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: grayscale(100%);
        transition: filter 0.2s ease;
        cursor: pointer;
    }

    .settings-btn {
        margin-left: auto;
    }

    .settings-btn :global(svg),
    .remove-btn :global(svg) {
        width: 100%;
        height: 100%;
    }

    .settings-btn:hover,
    .remove-btn:hover {
        filter: grayscale(0%);
    }

    /* Dialog styles */
    .settings-dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 450px;
        width: 90%;
    }

    .settings-dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    .settings-dialog form {
        padding: 20px;
    }

    .settings-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 14pt;
        color: #333;
    }

    .dialog-input-group {
        margin-bottom: 20px;
    }

    .dialog-input-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 10pt;
        font-weight: 400;
        color: #555;
    }

    .dialog-input-group input {
        width: 100%;
        padding: 8px 12px;
        font-size: 11pt;
        font-family: var(--font-stack-mono);
        border: 2px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .dialog-input-group input:focus {
        outline: none;
        border-color: #2196F3;
    }

    .dialog-input-group input.valid {
        border-color: #4caf50;
        background: #f0fdf0;
    }

    .dialog-input-group input.invalid {
        border-color: #ff4444;
        background: #fff5f5;
    }

    .dialog-input-group select {
        width: 100%;
        padding: 8px 12px;
        font-size: 10pt;
        border: 2px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
        background: white;
        cursor: pointer;
    }

    .dialog-input-group select:focus {
        outline: none;
        border-color: #2196F3;
    }

    .dialog-input-group input[type="text"] {
        font-family: inherit;
    }

    .dialog-input-group small {
        display: block;
        margin-top: 6px;
        font-size: 9pt;
        color: #888;
    }

    .dialog-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }

    .dialog-buttons button {
        margin: 0;
        padding: 8px 20px;
        font-size: 10pt;
        cursor: pointer;
    }

    .dialog-buttons button[type="button"] {
        background: #f5f5f5;
        color: #333;
    }

    .dialog-buttons button[type="button"]:hover {
        background: #e0e0e0;
    }

    .dialog-buttons button[type="submit"] {
        background-color: #bbdefb;
        color: #1976d2;
    }

    .dialog-buttons button[type="submit"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .no-devices {
        margin: 0;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
        color: #999;
        text-align: center;
        font-size: 10pt;
    }
</style>
