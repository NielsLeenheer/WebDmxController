<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../../assets/icons/connect.svg?raw';
    import disconnectIcon from '../../assets/icons/disconnect.svg?raw';
    import addIcon from '../../assets/icons/add.svg?raw';
    import streamdeckIcon from '../../assets/icons/streamdeck.svg?raw';
    import midiIcon from '../../assets/icons/midi.svg?raw';
    import inputsIcon from '../../assets/icons/inputs.svg?raw';
    import thingyIcon from '../../assets/icons/thingy.svg?raw';
    import heartrateIcon from '../../assets/icons/heartrate.svg?raw';
    import joyconIcon from '../../assets/icons/joycon.svg?raw';
    import audioIcon from '../../assets/icons/audio.svg?raw';
    import Dialog from '../common/Dialog.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import settingsIcon from '../../assets/icons/settings.svg?raw';
    import openIcon from '../../assets/icons/open.svg?raw';
    import saveIcon from '../../assets/icons/save.svg?raw';

    let { onconnect, ondisconnect, connected, inputController } = $props();

    let devicesDialog = $state(null);
    let settingsMenuRef = $state(null);
    let anchorButtonRef = $state(null);
    let settingsButtonRef = $state(null);
    let connectedDevices = $state([]);

    // Filter devices by type
    let streamDeckDevices = $derived(connectedDevices.filter(d => d.type === 'streamdeck'));
    let hidDevices = $derived(connectedDevices.filter(d => d.type === 'hid' && d.id !== 'keyboard'));
    let thingyDevices = $derived(connectedDevices.filter(d => d.type === 'thingy'));
    let heartRateDevices = $derived(connectedDevices.filter(d => d.type === 'heartrate'));
    let joyConDevices = $derived(connectedDevices.filter(d => d.type === 'joycon'));
    let audioDevices = $derived(connectedDevices.filter(d => d.type === 'audio'));
    let midiDevices = $derived(connectedDevices.filter(d => d.type === 'midi'));
    let gamepadDevices = $derived(connectedDevices.filter(d => d.type === 'gamepad'));

    // Unified list of all connected devices
    let allConnectedDevices = $derived([...streamDeckDevices, ...hidDevices, ...thingyDevices, ...heartRateDevices, ...joyConDevices, ...audioDevices, ...midiDevices, ...gamepadDevices]);

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
            connectedDevices = inputController?.getInputDevices() || [];
            closeDevicesDialog();
        } catch (error) {
            if (error.name === 'NotFoundError') return;
            alert(`Failed to connect Thingy:52: ${error.message}\n\nMake sure your device is powered on and in range.`);
        }
    }

    async function connectHeartRate() {
        try {
            await inputController?.requestHeartRate();
            connectedDevices = inputController?.getInputDevices() || [];
            closeDevicesDialog();
        } catch (error) {
            if (error.name === 'NotFoundError') return;
            alert(`Failed to connect Heart Rate Monitor: ${error.message}\n\nMake sure your device is powered on and in range.`);
        }
    }

    async function connectJoyCon() {
        try {
            await inputController?.requestJoyCon();
            connectedDevices = inputController?.getInputDevices() || [];
            closeDevicesDialog();
        } catch (error) {
            if (error.name === 'NotFoundError') return;
            alert(`Failed to connect Joy-Con: ${error.message}\n\nMake sure WebHID is supported and the Joy-Con is in pairing mode.`);
        }
    }

    async function connectAudio() {
        try {
            await inputController?.requestAudio();
            connectedDevices = inputController?.getInputDevices() || [];
            closeDevicesDialog();
        } catch (error) {
            if (error.name === 'NotAllowedError') return;
            alert(`Failed to connect audio: ${error.message}\n\nMake sure microphone access is allowed.`);
        }
    }


    function openSettingsMenu() {
        settingsMenuRef?.show(null, settingsButtonRef);
    }

    // --- Project Export/Import ---

    function exportProject() {
        const data = {
            version: 1,
            devices: JSON.parse(localStorage.getItem('dmx-devices') || '[]'),
            animations: JSON.parse(localStorage.getItem('dmx-animations') || '[]'),
            inputs: JSON.parse(localStorage.getItem('dmx-inputs') || '[]'),
            triggers: JSON.parse(localStorage.getItem('dmx-triggers') || '[]'),
            scenes: JSON.parse(localStorage.getItem('dmx-scenes') || '[]'),
            customCSS: localStorage.getItem('dmx-custom-css') || '',
            drawings: JSON.parse(localStorage.getItem('dmx-drawings') || '[]')
        };

        downloadJSON(data, 'dmx-project.json');
    }

    function importProject() {
        pickFile('.json', (content) => {
            try {
                const data = JSON.parse(content);
                if (!data.version) throw new Error('Invalid project file');

                if (data.devices) localStorage.setItem('dmx-devices', JSON.stringify(data.devices));
                if (data.animations) localStorage.setItem('dmx-animations', JSON.stringify(data.animations));
                if (data.inputs) localStorage.setItem('dmx-inputs', JSON.stringify(data.inputs));
                if (data.triggers) localStorage.setItem('dmx-triggers', JSON.stringify(data.triggers));
                if (data.scenes) localStorage.setItem('dmx-scenes', JSON.stringify(data.scenes));
                if (data.customCSS !== undefined) localStorage.setItem('dmx-custom-css', data.customCSS);
                if (data.drawings) localStorage.setItem('dmx-drawings', JSON.stringify(data.drawings));

                        location.reload();
            } catch (e) {
                alert('Failed to import project: ' + e.message);
            }
        });
    }

    // --- Helpers ---

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, filename);
    }

    function downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        downloadBlob(blob, filename);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function pickFile(accept, callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => callback(reader.result);
            reader.readAsText(file);
        };
        input.click();
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

    <div style="flex: 1;"></div>

    <button
        id="settings-button"
        bind:this={settingsButtonRef}
        style="anchor-name: --settings-button"
        onclick={openSettingsMenu}
        title="Settings"
    >
        <Icon data={settingsIcon} />
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
            <button class="device-connect-btn" onclick={connectThingy52}>
                <Icon data={thingyIcon} />
                <span>Thingy:52</span>
            </button>
            <button class="device-connect-btn" onclick={connectHeartRate}>
                <Icon data={heartrateIcon} />
                <span>Heart Rate</span>
            </button>
            <button class="device-connect-btn" onclick={connectJoyCon}>
                <Icon data={joyconIcon} />
                <span>Joy-Con</span>
            </button>
            <button class="device-connect-btn" onclick={connectAudio}>
                <Icon data={audioIcon} />
                <span>Audio</span>
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

<!-- Settings Menu -->
<ContextMenu bind:contextRef={settingsMenuRef}>
    <ContextAction onclick={exportProject}>{@html saveIcon} Export Project</ContextAction>
    <ContextAction onclick={importProject}>{@html openIcon} Import Project</ContextAction>
</ContextMenu>

<style>
    header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-right: 20px;
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

    button#devices-button,
    button#settings-button {
        background-color: #fff;
        color: #666;
        padding: 0 10px;
        min-width: auto;
    }

    button#devices-button :global(svg),
    button#settings-button :global(svg) {
        margin: 0;
    }

    button#devices-button:hover,
    button#settings-button:hover {
        background-color: #f0f0f0;
        color: #333;
    }

    /* Devices Dialog Content */
    .devices-dialog-content {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 24px;
    }

    /* Connect Buttons Grid (3x2) */
    .connect-buttons-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr 1fr;
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

    /* Rounded corners only on outer edges of 3x2 grid */
    .device-connect-btn:nth-child(1) {
        border-top-left-radius: 8px;
    }

    .device-connect-btn:nth-child(2) {
        border-top-right-radius: 8px;
    }

    .device-connect-btn:nth-child(5) {
        border-bottom-left-radius: 8px;
    }

    .device-connect-btn:nth-child(6) {
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
