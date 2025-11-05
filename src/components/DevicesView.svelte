<script>
    import { DEVICE_TYPES, Device } from '../lib/devices.js';

    let { dmxController } = $props();

    let devices = $state([]);
    let nextId = $state(1);
    let selectedType = $state('RGB');
    let startChannel = $state(1);

    function addDevice() {
        const device = new Device(nextId++, selectedType, startChannel - 1);
        devices.push(device);

        // Update start channel for next device
        startChannel = startChannel + DEVICE_TYPES[selectedType].channels;

        // Ensure we don't go over 512
        if (startChannel > 512) {
            startChannel = 1;
        }
    }

    function removeDevice(deviceId) {
        devices = devices.filter(d => d.id !== deviceId);
    }

    function updateDeviceValue(device, controlIndex, value) {
        device.setValue(controlIndex, value);

        // Update DMX controller
        if (dmxController) {
            const channelIndex = device.startChannel + controlIndex;
            dmxController.setChannel(channelIndex, value);
        }
    }
</script>

<div class="devices-container">
    <div class="devices-header">
        <h2>Devices</h2>
        <p>Add and control common DMX devices</p>
    </div>

    <div class="add-device">
        <select bind:value={selectedType}>
            {#each Object.entries(DEVICE_TYPES) as [key, type]}
                <option value={key}>{type.name}</option>
            {/each}
        </select>

        <input
            type="number"
            bind:value={startChannel}
            min="1"
            max="512"
            placeholder="Start channel"
        />

        <button onclick={addDevice}>Add Device</button>
    </div>

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
                    <span class="channel-info">
                        Ch {device.startChannel + 1}-{device.startChannel + DEVICE_TYPES[device.type].channels}
                    </span>
                    <button class="remove-btn" onclick={() => removeDevice(device.id)}>×</button>
                </div>

                <div class="device-controls">
                    {#each DEVICE_TYPES[device.type].controls as control, index}
                        <div class="control">
                            <label>{control.name}</label>
                            <div class="control-input">
                                <input
                                    type="range"
                                    min="0"
                                    max="255"
                                    value={device.getValue(index)}
                                    oninput={(e) => updateDeviceValue(device, index, parseInt(e.target.value))}
                                    style="accent-color: {control.color}"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="255"
                                    value={device.getValue(index)}
                                    onchange={(e) => updateDeviceValue(device, index, parseInt(e.target.value))}
                                    class="value-input"
                                />
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .devices-container {
        flex: 1;
        overflow: auto;
        padding: 20px;
    }

    .devices-header {
        margin-bottom: 20px;
    }

    .devices-header h2 {
        margin: 0 0 5px 0;
        font-size: 16pt;
        color: #333;
    }

    .devices-header p {
        margin: 0;
        color: #666;
        font-size: 10pt;
    }

    .add-device {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        padding: 15px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
    }

    .add-device select {
        margin: 0;
        flex: 1;
    }

    .add-device input {
        margin: 0;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 0 12px;
        height: 32px;
        width: 120px;
        font-family: system-ui;
        font-size: 10pt;
    }

    .add-device button {
        margin: 0;
    }

    .devices-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .empty-state {
        text-align: center;
        padding: 40px;
        color: #999;
    }

    .device-card {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 15px;
    }

    .device-header {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        gap: 10px;
    }

    .device-header h3 {
        margin: 0;
        font-size: 12pt;
        color: #333;
        flex: 1;
    }

    .channel-info {
        font-size: 9pt;
        color: #666;
        background: #f0f0f0;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: var(--font-stack-mono);
    }

    .remove-btn {
        margin: 0;
        padding: 0;
        width: 28px;
        height: 28px;
        background: #ff4444;
        color: white;
        font-size: 18pt;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .remove-btn:hover {
        background: #ff0000;
    }

    .device-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .control {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .control label {
        font-size: 10pt;
        font-weight: 600;
        color: #555;
    }

    .control-input {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .control-input input[type="range"] {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        appearance: none;
        background: #ddd;
    }

    .control-input input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        cursor: pointer;
    }

    .control-input input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        cursor: pointer;
        border: none;
    }

    .value-input {
        width: 60px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 6px;
        font-size: 10pt;
        font-family: var(--font-stack-mono);
        text-align: center;
    }

    .value-input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }
</style>
