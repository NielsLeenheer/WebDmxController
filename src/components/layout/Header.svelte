<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../../assets/icons/connect.svg?raw';
    import disconnectIcon from '../../assets/icons/disconnect.svg?raw';
    import addIcon from '../../assets/icons/add.svg?raw';
    import streamdeckIcon from '../../assets/icons/streamdeck.svg?raw';
    import midiIcon from '../../assets/icons/midi.svg?raw';
    import inputsIcon from '../../assets/icons/inputs.svg?raw';
    import thingyIcon from '../../assets/icons/thingy.svg?raw';
    import Dialog from '../common/Dialog.svelte';

    let { onconnect, ondisconnect, connected, inputController } = $props();

    let devicesDialog = $state(null);
    let anchorButtonRef = $state(null);
    let connectedDevices = $state([]);

    // Filter devices by type
    let streamDeckDevices = $derived(connectedDevices.filter(d => d.type === 'streamdeck'));
    let hidDevices = $derived(connectedDevices.filter(d => d.type === 'hid' && d.id !== 'keyboard'));
    let thingyDevices = $derived(connectedDevices.filter(d => d.type === 'thingy'));
    let midiDevices = $derived(connectedDevices.filter(d => d.type === 'midi'));
    let gamepadDevices = $derived(connectedDevices.filter(d => d.type === 'gamepad'));

    // Unified list of all connected devices
    let allConnectedDevices = $derived([...streamDeckDevices, ...hidDevices, ...thingyDevices, ...midiDevices, ...gamepadDevices]);

    // MIDI button should be disabled if we already have MIDI access
    let hasMidiAccess = $derived(midiDevices.length > 0);

    function openDevicesDialog() {
        // Update list of connected devices
        if (inputController) {
            connectedDevices = inputController.getInputDevices();
        }

        // Show dialog as modal so backdrop clicks work for light dismiss
        requestAnimationFrame(() => {
            devicesDialog?.showModal();
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
            // Close dialog on successful connection
            closeDevicesDialog();
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
            // Close dialog on successful connection
            closeDevicesDialog();
        } catch (error) {
            // Silently ignore user cancellation
            if (error.name === 'NotFoundError') return;
            alert(`Failed to connect MIDI: ${error.message}`);
        }
    }

    async function connectHID() {
        try {
            await inputController?.requestHIDDevice();
            // Update device list
            connectedDevices = inputController?.getInputDevices() || [];
            // Close dialog on successful connection
            closeDevicesDialog();
        } catch (error) {
            alert(`Failed to connect HID device: ${error.message}`);
        }
    }

    async function connectThingy52() {
        try {
            await inputController?.requestThingy52();
            // Update device list
            connectedDevices = inputController?.getInputDevices() || [];
            // Close dialog on successful connection
            closeDevicesDialog();
        } catch (error) {
            // Silently ignore user cancellation
            if (error.name === 'NotFoundError') return;
            alert(`Failed to connect Thingy:52: ${error.message}\n\nMake sure your device is powered on and in range.`);
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

<!-- Devices Dialog (anchored with light dismiss) -->
{#if anchorButtonRef}
<Dialog
    bind:dialogRef={devicesDialog}
    anchored={true}
    anchorId="devices-button"
    showArrow={true}
    lightDismiss={true}
    width="450px"
    onclose={closeDevicesDialog}
>
    <div class="devices-dialog-content">
        <!-- Left Column: Connect Buttons Grid -->
        <div class="connect-buttons-grid">
            <button class="device-connect-btn" onclick={connectStreamDeck}>
                <Icon data={streamdeckIcon} />
                <span>Stream Deck</span>
            </button>
            <button class="device-connect-btn" onclick={connectMIDI} disabled={hasMidiAccess}>
                <Icon data={midiIcon} />
                <span>MIDI</span>
            </button>
            <button class="device-connect-btn" onclick={connectHID}>
                <Icon data={inputsIcon} />
                <span>HID</span>
            </button>
            <button class="device-connect-btn" onclick={connectThingy52}>
                <Icon data={thingyIcon} />
                <span>Thingy:52</span>
            </button>
        </div>

        <!-- Right Column: Connected Devices List -->
        <div class="connected-devices-column">
            <h3>Connected Devices</h3>
            {#if allConnectedDevices.length > 0}
                <div class="device-list">
                    {#each allConnectedDevices as device (device.id)}
                        <div class="device-item">
                            <span class="device-name">{device.name}</span>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="no-devices-message">No devices connected</p>
            {/if}
        </div>
    </div>
</Dialog>
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

    /* Devices Dialog Content */
    .devices-dialog-content {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 24px;
    }

    /* Connect Buttons Grid (2x2) */
    .connect-buttons-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 4px;
    }

    .device-connect-btn {
        width: 100px;
        height: 100%;
        min-height: 100px;
        background: #eee;
        color: #333;
        border: none;
        border-radius: 0;
        cursor: pointer;
        font-size: 9pt;
        font-weight: 500;
        transition: background 0.2s, opacity 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 4px;
    }

    /* Rounded corners only on outer edges of grid */
    .device-connect-btn:nth-child(1) {
        border-top-left-radius: 8px;
    }

    .device-connect-btn:nth-child(2) {
        border-top-right-radius: 8px;
    }

    .device-connect-btn:nth-child(3) {
        border-bottom-left-radius: 8px;
    }

    .device-connect-btn:nth-child(4) {
        border-bottom-right-radius: 8px;
    }

    .device-connect-btn :global(svg) {
        height: 42px;
        width: 42px;
    }

    .device-connect-btn span {
        text-align: center;
        line-height: 1.2;
    }

    .device-connect-btn:hover:not(:disabled) {
        background: #90caf9;
    }

    .device-connect-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Connected Devices Column */

    .connected-devices-column h3 {
        margin: 0 0 12px 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .device-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .device-item {
        padding: 8px 12px;
        background: #f9f9f9;
        border-radius: 4px;
        font-size: 9pt;
    }

    .device-name {
        color: #333;
        font-weight: 500;
    }

    .no-devices-message {
        margin: 0;
        padding: 60px 20px 0;
        text-align: center;
        color: #999;
        font-size: 9pt;
        font-style: italic;
    }
</style>
