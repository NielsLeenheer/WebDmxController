<script>
    import { Icon } from 'svelte-icon';
    import { DEVICE_TYPES, Device } from '../lib/devices.js';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';

    let { dmxController } = $props();

    let devices = $state([]);
    let deviceValues = $state({}); // Store values separately as reactive state
    let nextId = $state(1);
    let selectedType = $state('RGB');

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

    function addDevice() {
        const startChannel = getNextFreeChannel();
        const device = new Device(nextId++, selectedType, startChannel);
        devices.push(device);
        // Initialize values for this device
        deviceValues[device.id] = new Array(DEVICE_TYPES[device.type].channels).fill(0);
    }

    function removeDevice(deviceId) {
        devices = devices.filter(d => d.id !== deviceId);
        delete deviceValues[deviceId];
    }

    function updateDeviceChannel(device, newChannel) {
        // Convert from 1-indexed to 0-indexed
        device.startChannel = Math.max(0, Math.min(511, newChannel - 1));
    }

    function updateDeviceValue(device, controlIndex, value) {
        // Update DMX controller only if device is valid
        if (dmxController && validateDevice(device)) {
            const channelIndex = device.startChannel + controlIndex;
            dmxController.setChannel(channelIndex, value);
        }
    }
</script>

<div class="devices-container">
    <div class="add-device">
        <select bind:value={selectedType}>
            {#each Object.entries(DEVICE_TYPES) as [key, type]}
                <option value={key}>{type.name}</option>
            {/each}
        </select>

        <button onclick={addDevice}>Add Device</button>
    </div>

    <div class="devices-list">
        {#if devices.length === 0}
            <div class="empty-state">
                <p>No devices added yet. Add a device to get started!</p>
            </div>
        {/if}

        {#each devices as device (device.id)}
            {@const isValid = validateDevice(device)}
            <div class="device-card" class:invalid={!isValid}>
                <div class="device-header">
                    <h3>{device.name}</h3>
                    <div class="channel-config">
                        <label>Start Ch:</label>
                        <input
                            type="number"
                            min="1"
                            max="512"
                            value={device.startChannel + 1}
                            onchange={(e) => updateDeviceChannel(device, parseInt(e.target.value))}
                            class="channel-input"
                            class:invalid={!isValid}
                        />
                        <span class="channel-range">
                            ({DEVICE_TYPES[device.type].channels} ch)
                        </span>
                    </div>
                    <button class="remove-btn" onclick={() => removeDevice(device.id)}>
                        <Icon data={disconnectIcon} />
                    </button>
                </div>

                {#if !isValid}
                    <div class="error-message">
                        ⚠ Channel conflict or out of range (1-512). Device disabled.
                    </div>
                {/if}

                <div class="device-controls">
                    {#each DEVICE_TYPES[device.type].controls as control, index}
                        <div class="control">
                            <label>{control.name}</label>
                            <input
                                type="range"
                                min="0"
                                max="255"
                                bind:value={deviceValues[device.id][index]}
                                oninput={(e) => updateDeviceValue(device, index, parseInt(e.target.value))}
                                style="accent-color: {control.color}"
                                disabled={!isValid}
                            />
                            <input
                                type="number"
                                min="0"
                                max="255"
                                bind:value={deviceValues[device.id][index]}
                                onchange={(e) => updateDeviceValue(device, index, parseInt(e.target.value))}
                                class="value-input"
                                disabled={!isValid}
                            />
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

    .add-device {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
    }

    .add-device select {
        margin: 0;
        min-width: 200px;
    }

    .add-device button {
        margin: 0;
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

    .device-card.invalid {
        border-color: #ff4444;
        background: #fff5f5;
    }

    .error-message {
        background: #ffeeee;
        border: 1px solid #ff4444;
        border-radius: 4px;
        padding: 8px 12px;
        margin-bottom: 15px;
        color: #cc0000;
        font-size: 9pt;
        font-weight: 600;
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

    .channel-config {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 9pt;
        color: #666;
    }

    .channel-config label {
        font-weight: 600;
    }

    .channel-input {
        width: 60px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 9pt;
        font-family: var(--font-stack-mono);
        text-align: center;
    }

    .channel-input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .channel-input.invalid {
        border-color: #ff4444;
        background: #ffeeee;
    }

    .channel-range {
        font-size: 9pt;
        color: #999;
        font-family: var(--font-stack-mono);
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
    }

    .remove-btn :global(svg) {
        width: 100%;
        height: 100%;
    }

    .remove-btn:hover {
        opacity: 0.7;
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
        font-size: 9pt;
        font-weight: 600;
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
        font-size: 9pt;
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
</style>
