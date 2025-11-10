<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../../assets/icons/connect.svg?raw';
    import disconnectIcon from '../../assets/icons/disconnect.svg?raw';
    import addIcon from '../../assets/icons/add.svg?raw';
    import streamdeckIcon from '../../assets/icons/streamdeck.svg?raw';
    import midiIcon from '../../assets/icons/midi.svg?raw';
    import Dialog from '../common/Dialog.svelte';

    let { onconnect, ondisconnect, connected, inputController } = $props();

    let devicesDialog = $state(null);
    let anchorButtonRef = $state(null);
    let connectedDevices = $state([]);

    // Filter devices by type
    let streamDeckDevices = $derived(connectedDevices.filter(d => d.type === 'hid' && d.id !== 'keyboard'));
    let midiDevices = $derived(connectedDevices.filter(d => d.type === 'midi'));

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

<!-- Devices Dialog (anchored with light dismiss) -->
{#if anchorButtonRef}
<Dialog
    bind:dialogRef={devicesDialog}
    anchored={true}
    anchorId="devices-button"
    showArrow={true}
    lightDismiss={true}
    onclose={closeDevicesDialog}
>
    <!-- Stream Deck Section -->
    <div class="device-section">
        <button class="connect-device-btn" onclick={connectStreamDeck}>
            <Icon data={streamdeckIcon} />
            Connect Stream Deck
        </button>
        {#if streamDeckDevices.length > 0}
            <div class="device-list">
                {#each streamDeckDevices as device (device.id)}
                    <div class="device-item">
                        <span class="device-name">{device.name}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- MIDI Section -->
    <div class="device-section">
        <button
            class="connect-device-btn"
            onclick={connectMIDI}
            disabled={hasMidiAccess}
        >
            <Icon data={midiIcon} />
            Connect MIDI Device
        </button>
        {#if midiDevices.length > 0}
            <div class="device-list">
                {#each midiDevices as device (device.id)}
                    <div class="device-item">
                        <span class="device-name">{device.name}</span>
                    </div>
                {/each}
            </div>
        {/if}
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

    /* Device sections within dialog */
    .device-section {
        padding: 15px;
    }

    .device-section:not(:last-child) {
        border-bottom: 1px solid #f0f0f0;
    }

    .connect-device-btn {
        width: 100%;
        padding: 0px 10px;
        height: 36px;
        background: #eee;
        color: #333;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10pt;
        font-weight: 500;
        transition: background 0.2s, opacity 0.2s;
        display: flex;
        align-items: center;
    }

    .connect-device-btn :global(svg) {
        height: 75%;
        margin-right: 3px;
    }

    .connect-device-btn:hover:not(:disabled) {
        background: #90caf9;
    }

    .connect-device-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .device-list {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .device-item {
        padding: 8px 10px;
        background: #f9f9f9;
        border-radius: 4px;
        font-size: 9pt;
    }

    .device-name {
        color: #333;
        font-weight: 500;
    }
</style>
