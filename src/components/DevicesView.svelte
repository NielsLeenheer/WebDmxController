<script>
    import { Icon } from 'svelte-icon';
    import { DEVICE_TYPES, Device } from '../lib/devices.js';
    import XYPad from './XYPad.svelte';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';

    let { dmxController, selectedType = $bindable() } = $props();

    // Dialog state
    let editingDevice = $state(null);
    let dialogChannel = $state(1);
    let channelDialog = $state(null);

    function openChannelDialog(device) {
        editingDevice = device;
        dialogChannel = device.startChannel + 1;
        channelDialog?.showModal();
    }

    function closeChannelDialog() {
        channelDialog?.close();
        editingDevice = null;
    }

    function submitChannelChange() {
        if (editingDevice && isChannelValid(editingDevice, dialogChannel - 1)) {
            updateDeviceChannel(editingDevice, dialogChannel);
            closeChannelDialog();
        }
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
                    const device = new Device(d.id, d.type, d.startChannel);
                    device.name = d.name;
                    return device;
                });
                return {
                    devices: loadedDevices,
                    deviceValues: data.deviceValues || {},
                    nextId: data.nextId || 1
                };
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return { devices: [], deviceValues: {}, nextId: 1 };
    }

    const initialState = loadFromLocalStorage();
    let devices = $state(initialState.devices);
    let deviceValues = $state(initialState.deviceValues);
    let nextId = $state(initialState.nextId);

    // Save to localStorage whenever devices or deviceValues change
    $effect(() => {
        try {
            const data = {
                devices: devices.map(d => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    startChannel: d.startChannel
                })),
                deviceValues,
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
        // Initialize values for this device
        deviceValues[device.id] = new Array(DEVICE_TYPES[device.type].channels).fill(0);
    }

    export function clearAllDeviceValues() {
        // Reset all device values to 0
        devices.forEach(device => {
            if (deviceValues[device.id]) {
                deviceValues[device.id] = deviceValues[device.id].map(() => 0);
            }
        });
        // Trigger reactivity
        deviceValues = { ...deviceValues };
    }

    function removeDevice(deviceId) {
        devices = devices.filter(d => d.id !== deviceId);
        delete deviceValues[deviceId];
    }

    function updateDeviceChannel(device, newChannel) {
        // Convert from 1-indexed to 0-indexed
        const newStartChannel = Math.max(0, Math.min(511, newChannel - 1));

        // Create new device instances to trigger reactivity
        devices = devices.map(d => {
            if (d.id === device.id) {
                // Create a new Device instance with updated channel
                const updated = new Device(d.id, d.type, newStartChannel, d.name);
                return updated;
            }
            return d;
        });

        // Update DMX controller with new channel values
        if (dmxController && deviceValues[device.id]) {
            deviceValues[device.id].forEach((value, index) => {
                const channelIndex = newStartChannel + index;
                dmxController.setChannel(channelIndex, value);
            });
        }
    }

    function updateDeviceValue(device, controlIndex, value) {
        // Update DMX controller
        if (dmxController) {
            const channelIndex = device.startChannel + controlIndex;
            dmxController.setChannel(channelIndex, value);
        }
    }

    function handleXYPadUpdate(device, panIndex, tiltIndex, panValue, tiltValue) {
        // Update device values
        deviceValues[device.id][panIndex] = panValue;
        deviceValues[device.id][tiltIndex] = tiltValue;

        // Update DMX controller
        if (dmxController) {
            dmxController.setChannel(device.startChannel + panIndex, panValue);
            dmxController.setChannel(device.startChannel + tiltIndex, tiltValue);
        }

        // Trigger reactivity
        deviceValues = { ...deviceValues };
    }

    // Get the channel index for a control
    function getControlChannelIndex(deviceType, controlIndex) {
        const controls = DEVICE_TYPES[deviceType].controls;
        let channelOffset = 0;

        for (let i = 0; i < controlIndex; i++) {
            if (controls[i].type === 'xypad') {
                channelOffset += 2; // XY pad uses 2 channels
            } else {
                channelOffset += 1;
            }
        }

        return channelOffset;
    }

    // Restore all device values to DMX controller on load
    $effect(() => {
        if (dmxController) {
            devices.forEach(device => {
                if (deviceValues[device.id]) {
                    deviceValues[device.id].forEach((value, index) => {
                        const channelIndex = device.startChannel + index;
                        dmxController.setChannel(channelIndex, value);
                    });
                }
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
                    <h3>{device.name}</h3>
                    <button
                        class="channel-button"
                        onclick={() => openChannelDialog(device)}
                    >
                        Channel: {device.startChannel + 1}-{device.startChannel + DEVICE_TYPES[device.type].channels}
                    </button>
                    <button class="remove-btn" onclick={() => removeDevice(device.id)}>
                        <Icon data={disconnectIcon} />
                    </button>
                </div>

                <div class="device-controls">
                    {#each DEVICE_TYPES[device.type].controls as control, controlIndex}
                        {#if control.type === 'xypad'}
                            <div class="control-xypad">
                                <label>{control.name}</label>
                                <XYPad
                                    bind:panValue={deviceValues[device.id][control.panIndex]}
                                    bind:tiltValue={deviceValues[device.id][control.tiltIndex]}
                                    onUpdate={(pan, tilt) => handleXYPadUpdate(device, control.panIndex, control.tiltIndex, pan, tilt)}
                                />
                                <div class="xypad-inputs">
                                    <input
                                        type="number"
                                        min="0"
                                        max="255"
                                        bind:value={deviceValues[device.id][control.panIndex]}
                                        onchange={(e) => handleXYPadUpdate(device, control.panIndex, control.tiltIndex, parseInt(e.target.value), deviceValues[device.id][control.tiltIndex])}
                                        class="value-input"
                                        title="Pan"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        max="255"
                                        bind:value={deviceValues[device.id][control.tiltIndex]}
                                        onchange={(e) => handleXYPadUpdate(device, control.panIndex, control.tiltIndex, deviceValues[device.id][control.panIndex], parseInt(e.target.value))}
                                        class="value-input"
                                        title="Tilt"
                                    />
                                </div>
                            </div>
                        {:else}
                            {@const channelIndex = getControlChannelIndex(device.type, controlIndex)}
                            <div class="control">
                                <label>{control.name}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="255"
                                    bind:value={deviceValues[device.id][channelIndex]}
                                    oninput={(e) => updateDeviceValue(device, channelIndex, parseInt(e.target.value))}
                                    style="accent-color: {control.color}"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="255"
                                    bind:value={deviceValues[device.id][channelIndex]}
                                    onchange={(e) => updateDeviceValue(device, channelIndex, parseInt(e.target.value))}
                                    class="value-input"
                                />
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    <dialog bind:this={channelDialog} class="channel-dialog">
        {#if editingDevice}
            <form method="dialog" onsubmit={(e) => { e.preventDefault(); submitChannelChange(); }}>
                <h3>{editingDevice.name}</h3>

                <div class="dialog-input-group">
                    <label for="channel-input">{DEVICE_TYPES[editingDevice.type].channels} channels, starting at:</label>
                    <input
                        id="channel-input"
                        type="number"
                        min="1"
                        max="512"
                        bind:value={dialogChannel}
                        class:valid={isChannelValid(editingDevice, dialogChannel - 1)}
                        class:invalid={!isChannelValid(editingDevice, dialogChannel - 1)}
                        autofocus
                    />
                </div>

                <div class="dialog-buttons">
                    <button type="button" onclick={closeChannelDialog}>Cancel</button>
                    <button
                        type="submit"
                        disabled={!isChannelValid(editingDevice, dialogChannel - 1)}
                    >
                        Apply
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
        align-items: baseline;
        margin-bottom: 15px;
        gap: 8px;
        margin-top: -0.4em;
    }

    .device-header h3 {
        margin: 0;
        font-size: 12pt;
        color: #333;
    }

    .channel-button {
        padding: 4px 8px;
        font-size: 7pt;
        text-align: center;
        background: transparent;
        cursor: pointer;
        margin: 0;
        white-space: nowrap;
        color: #888;
    }

    .channel-button:hover {
        text-decoration: underline;
    }

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

        margin-left: auto;
    }

    .remove-btn :global(svg) {
        width: 100%;
        height: 100%;
    }

    .remove-btn:hover {
        filter: grayscale(0%);
    }

    .device-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .control {
        display: grid;
        grid-template-columns: 4em 1fr 3em;
        gap: 8px;
        align-items: center;
    }

    .control label {
        font-size: 8pt;
        font-weight: 400;
        color: #555;
    }

    .control input[type="range"] {
        cursor: pointer;
    }

    .value-input {
        width: 4em;
        border: none;
        background: transparent;
        padding: 4px;
        font-size: 8pt;
        font-family: var(--font-stack-mono);
        text-align: right;
        border-radius: 5px;
    }

    .value-input:focus {
        outline: none;
        background: #fff;
    }

    .control input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .control-xypad {
        display: grid;
        grid-template-columns: 4em 1fr 3em;
        gap: 8px;
        align-items: center;
    }

    .control-xypad label {
        font-size: 9pt;
        font-weight: 600;
        color: #555;
    }

    .xypad-inputs {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .xypad-inputs input {
        width: 4em;
    }

    /* Dialog styles */
    .channel-dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
    }

    .channel-dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    .channel-dialog form {
        padding: 20px;
    }

    .channel-dialog h3 {
        margin: 0 0 8px 0;
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
</style>
