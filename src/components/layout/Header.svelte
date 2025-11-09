<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../../assets/icons/connect.svg?raw';
    import disconnectIcon from '../../assets/icons/disconnect.svg?raw';
    import addIcon from '../../assets/icons/add.svg?raw';

    let { onconnect, ondisconnect, connected, inputController } = $props();

    let devicesDialog = $state(null);
    let anchorButtonRef = $state(null);
    let connectedDevices = $state([]);

    function openDevicesDialog() {
        // Update list of connected devices
        if (inputController) {
            connectedDevices = inputController.getInputDevices();
        }

        // Show dialog as non-modal
        requestAnimationFrame(() => {
            devicesDialog?.show();
        });
    }

    function closeDevicesDialog() {
        devicesDialog?.close();
    }

    async function connectStreamDeck() {
        try {
            await inputController?.requestStreamDeck();
            // Update device list
            connectedDevices = inputController?.getInputDevices() || [];
        } catch (error) {
            alert(`Failed to connect Stream Deck: ${error.message}\n\nPlease close the Elgato Stream Deck software and try again.`);
        }
    }

    async function connectMIDI() {
        try {
            // MIDI is auto-initialized, but we can reinitialize to trigger permission request
            await inputController?.inputDeviceManager?.initMIDI();
            // Update device list
            connectedDevices = inputController?.getInputDevices() || [];
        } catch (error) {
            alert(`Failed to connect MIDI: ${error.message}`);
        }
    }
</script>

<header>
    {#if !connected}
        <button id="start" onclick={onconnect}>
            <Icon data={connectIcon} />
            Connect DMX controller
        </button>
    {:else}
        <button id="stop" onclick={ondisconnect}>
            <Icon data={disconnectIcon} />
            Disconnect
        </button>
    {/if}

    <button
        id="devices-button"
        bind:this={anchorButtonRef}
        style="anchor-name: --devices-button"
        onclick={openDevicesDialog}
        title="Connect input devices"
    >
        <Icon data={addIcon} />
    </button>
</header>

<!-- Devices Dialog (non-modal with anchor positioning) -->
{#if anchorButtonRef}
<dialog bind:this={devicesDialog} class="devices-dialog" style="position-anchor: --devices-button">
    <div class="dialog-header">
        <h3>Input Devices</h3>
        <button class="close-btn" onclick={closeDevicesDialog}>×</button>
    </div>

    <div class="dialog-content">
        <div class="connect-buttons">
            <button class="connect-device-btn" onclick={connectStreamDeck}>
                Connect Stream Deck
            </button>
            <button class="connect-device-btn" onclick={connectMIDI}>
                Connect MIDI Device
            </button>
        </div>

        {#if connectedDevices.length > 0}
            <div class="devices-list">
                <h4>Connected Devices</h4>
                {#each connectedDevices as device (device.id)}
                    <div class="device-item">
                        <span class="device-type">{device.type.toUpperCase()}</span>
                        <span class="device-name">{device.name}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</dialog>
{/if}

<style>
    header {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    button :global(svg) {
        height: 75%;
        margin-right: 3px;
    }

    button#start {
        background-color: #bbdefb;
        color: #1976d2;
    }

    button#stop {
        background-color: #fff;
        color: #000;
    }

    button#devices-button {
        background-color: #fff;
        color: #666;
        padding: 0 10px;
        min-width: auto;
    }

    button#devices-button :global(svg) {
        margin: 0;
    }

    button#devices-button:hover {
        background-color: #f0f0f0;
        color: #333;
    }

    /* Devices Dialog */
    .devices-dialog {
        position: fixed;
        position-anchor: var(--position-anchor);
        top: anchor(bottom);
        left: anchor(center);
        translate: -50% 8px;
        margin: 0;
        padding: 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        min-width: 300px;
        max-width: 400px;
        z-index: 100;
    }

    .devices-dialog::backdrop {
        background: transparent;
    }

    /* Tooltip arrow pointing up */
    .devices-dialog::before {
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid #fff;
        filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
    }

    .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px;
        border-bottom: 1px solid #e0e0e0;
    }

    .dialog-header h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .close-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        background: transparent;
        color: #999;
        font-size: 20pt;
        line-height: 1;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: #f0f0f0;
        color: #333;
    }

    .dialog-content {
        padding: 15px;
    }

    .connect-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
    }

    .connect-device-btn {
        padding: 10px 15px;
        background: #0078d4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10pt;
        font-weight: 500;
        transition: background 0.2s;
    }

    .connect-device-btn:hover {
        background: #106ebe;
    }

    .devices-list {
        border-top: 1px solid #e0e0e0;
        padding-top: 15px;
    }

    .devices-list h4 {
        margin: 0 0 10px 0;
        font-size: 9pt;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .device-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: #f9f9f9;
        border-radius: 4px;
        margin-bottom: 6px;
        font-size: 9pt;
    }

    .device-type {
        background: #e3f2fd;
        color: #1976d2;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
        font-size: 8pt;
        text-transform: uppercase;
    }

    .device-name {
        color: #333;
        font-weight: 500;
    }
</style>
