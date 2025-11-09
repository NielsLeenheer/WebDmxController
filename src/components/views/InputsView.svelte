<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';

    let {
        inputController,
        mappingLibrary
    } = $props();

    // Icons
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    const editIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    const keyboardIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>';
    const midiIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
    const hidIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>';

    let isListening = $state(false);
    let savedInputs = $state([]);
    let editingInput = $state(null);
    let editingName = $state('');

    // Event handlers
    let inputEventHandlers = [];

    async function connectStreamDeck() {
        try {
            await inputController.requestStreamDeck();
            // Device events are now handled automatically via the StreamDeckManager
            // No need to manually set up listeners - they're already connected
        } catch (error) {
            alert(`Failed to connect Stream Deck: ${error.message}\n\nPlease close the Elgato Stream Deck software and try again.`);
        }
    }

    function startListening() {
        isListening = true;

        // Listen to input controller for raw inputs
        const devices = inputController.getInputDevices();
        for (const device of devices) {
            const handler = (eventData) => {
                handleRawInput({
                    deviceId: device.id,
                    controlId: eventData.controlId,
                    type: eventData.velocity !== undefined ? 'trigger' : 'change',
                    device
                });
            };

            device.on('trigger', handler);
            device.on('change', handler);

            inputEventHandlers.push({ device, event: 'trigger', handler });
            inputEventHandlers.push({ device, event: 'change', handler });
        }

        inputController.on('deviceadded', handleDeviceAdded);
    }

    function handleRawInput(event) {
        if (!isListening) return;

        const { deviceId, controlId, device } = event;

        // Check if this input already exists
        const existing = savedInputs.find(
            input => input.inputDeviceId === deviceId && input.inputControlId === controlId
        );

        if (!existing) {
            // Auto-save new input
            const name = formatInputName(device?.name || deviceId, controlId);

            // Only assign colors to Stream Deck devices (not keyboard or other devices)
            const supportsColor = device?.type === 'hid' && device.id !== 'keyboard';

            const inputMapping = new InputMapping({
                name,
                mode: 'input',  // Mark as input-only (not a trigger mapping)
                inputDeviceId: deviceId,
                inputControlId: controlId,
                color: supportsColor ? undefined : null  // undefined = generate color, null = no color
            });

            mappingLibrary.add(inputMapping);
            refreshInputs();

            // Set color on hardware for Stream Deck devices only
            // MIDI will also support colors when available
            if (supportsColor && controlId.startsWith('button-')) {
                const buttonIndex = parseInt(controlId.replace('button-', ''));

                // Validate buttonIndex is a valid number
                if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                    const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
                    const serialNumber = deviceId; // deviceId is the serialNumber for Stream Deck

                    // Set the button color on the device (async, but don't wait)
                    streamDeckManager.setButtonColor(serialNumber, buttonIndex, inputMapping.color).catch(err => {
                        console.warn(`Could not set button ${buttonIndex} color:`, err);
                    });
                }
            }
        }
    }

    function handleDeviceAdded(device) {
        if (!isListening) return;

        const handler = (eventData) => {
            handleRawInput({
                deviceId: device.id,
                controlId: eventData.controlId,
                type: eventData.velocity !== undefined ? 'trigger' : 'change',
                device
            });
        };

        device.on('trigger', handler);
        device.on('change', handler);

        inputEventHandlers.push({ device, event: 'trigger', handler });
        inputEventHandlers.push({ device, event: 'change', handler });
    }

    function stopListening() {
        isListening = false;

        // Remove all event handlers
        for (const { device, event, handler } of inputEventHandlers) {
            device.off(event, handler);
        }
        inputEventHandlers = [];

        inputController.off('deviceadded', handleDeviceAdded);
    }

    function formatInputName(deviceName, controlId) {
        const devicePart = deviceName.replace(/\s+/g, '_').toLowerCase();
        const controlPart = controlId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `${devicePart}_${controlPart}`;
    }

    function startEditing(input) {
        editingInput = input;
        editingName = input.name;
    }

    function saveEdit() {
        if (!editingInput || !editingName.trim()) return;

        editingInput.name = editingName.trim();
        mappingLibrary.save();
        refreshInputs();

        editingInput = null;
        editingName = '';
    }

    function cancelEdit() {
        editingInput = null;
        editingName = '';
    }

    async function deleteInput(inputId) {
        const input = mappingLibrary.get(inputId);
        if (!input) return;

        // If this is a Stream Deck button (not keyboard), clear its color (set to black)
        const inputDevice = inputController.getInputDevice(input.inputDeviceId);
        if (inputDevice?.type === 'hid' && inputDevice.id !== 'keyboard' && input.inputControlId.startsWith('button-')) {
            const buttonIndex = parseInt(input.inputControlId.replace('button-', ''));

            if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
                const serialNumber = input.inputDeviceId;

                // Clear the button color (set to black)
                await streamDeckManager.clearButtonColor(serialNumber, buttonIndex);
            }
        }

        mappingLibrary.remove(inputId);
        refreshInputs();
    }

    function refreshInputs() {
        // Only show input-mode mappings
        savedInputs = mappingLibrary.getAll().filter(m => m.mode === 'input');
    }

    function getInputIcon(inputId) {
        const device = inputController.getInputDevice(inputId);
        switch (device?.type) {
            case 'keyboard':
                return keyboardIcon;
            case 'midi':
                return midiIcon;
            case 'hid':
                return hidIcon;
            default:
                return midiIcon;
        }
    }

    async function applyColorsToStreamDeck() {
        // Apply colors to all Stream Deck buttons that have saved inputs
        const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
        const connectedDevices = streamDeckManager.getConnectedDevices();

        if (connectedDevices.length === 0) {
            // No Stream Deck connected, skip color application
            return;
        }

        // Find all Stream Deck inputs and apply their colors (skip keyboard)
        for (const input of savedInputs) {
            const inputDevice = inputController.getInputDevice(input.inputDeviceId);

            // Check if this is a Stream Deck device that's currently connected (not keyboard)
            if (inputDevice?.type === 'hid' && inputDevice.id !== 'keyboard' && input.inputControlId.startsWith('button-')) {
                const buttonIndex = parseInt(input.inputControlId.replace('button-', ''));

                // Validate buttonIndex is a valid number
                if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                    const serialNumber = input.inputDeviceId; // deviceId is the serialNumber

                    // Set the button color on the device (will silently fail if button doesn't exist)
                    await streamDeckManager.setButtonColor(serialNumber, buttonIndex, input.color);
                }
            }
        }
    }

    onMount(() => {
        refreshInputs();

        // Apply colors when a Stream Deck connects
        inputController.on('deviceadded', (device) => {
            if (device.type === 'hid') {
                // Small delay to ensure device is fully initialized
                setTimeout(() => applyColorsToStreamDeck(), 500);
            }
        });

        // Apply colors on initial load
        setTimeout(() => applyColorsToStreamDeck(), 1000);
    });

    onDestroy(() => {
        stopListening();
    });
</script>

<div class="inputs-view">
    <div class="left-panel">
        <div class="panel-header">
            <h3>Listen for Inputs</h3>
        </div>

        <div class="listen-section">
            <p class="instructions">
                Press any MIDI button, keyboard key, Stream Deck button, or move any MIDI control to detect and save it automatically.
            </p>

            <div class="button-group">
                {#if isListening}
                    <Button onclick={stopListening} primary>
                        Stop Listening
                    </Button>
                {:else}
                    <Button onclick={startListening} primary>
                        Start Listening
                    </Button>
                {/if}

                <Button onclick={connectStreamDeck}>
                    Connect Stream Deck
                </Button>
            </div>

            {#if isListening}
                <div class="listening-indicator">
                    <div class="pulse-dot"></div>
                    Listening for inputs...
                </div>
            {/if}
        </div>
    </div>

    <div class="right-panel">
        <div class="panel-header">
            <h3>Saved Inputs</h3>
        </div>

        <div class="inputs-list">
            {#if savedInputs.length === 0}
                <p class="empty-state">No inputs detected yet. Start listening to detect inputs!</p>
            {:else}
                {#each savedInputs as input (input.id)}
                    <div class="input-item">
                        {#if input.color}
                            <div class="input-color-badge" style="background-color: {input.color}"></div>
                        {/if}
                        <div class="input-icon">
                            {@html getInputIcon(input.inputDeviceId)}
                        </div>
                        <div class="input-info">
                            {#if editingInput?.id === input.id}
                                <input
                                    type="text"
                                    bind:value={editingName}
                                    class="input-name-edit"
                                    onkeydown={(e) => {
                                        if (e.key === 'Enter') saveEdit();
                                        if (e.key === 'Escape') cancelEdit();
                                    }}
                                    autofocus
                                />
                            {:else}
                                <div class="input-name">{input.name}</div>
                            {/if}
                            <div class="input-details">
                                {#if inputController.getInputDevice(input.inputDeviceId)}
                                    {inputController.getInputDevice(input.inputDeviceId).name}
                                {:else}
                                    {input.inputDeviceId}
                                {/if}
                                &rarr; {input.inputControlId}
                            </div>
                        </div>
                        <div class="input-actions">
                            {#if editingInput?.id === input.id}
                                <Button onclick={saveEdit} size="small">Save</Button>
                                <Button onclick={cancelEdit} size="small">Cancel</Button>
                            {:else}
                                <IconButton
                                    icon={editIcon}
                                    onclick={() => startEditing(input)}
                                    title="Rename input"
                                />
                                <IconButton
                                    icon={trashIcon}
                                    onclick={() => deleteInput(input.id)}
                                    title="Delete input"
                                />
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    .inputs-view {
        display: flex;
        height: 100%;
        overflow: hidden;
    }

    .left-panel {
        width: 350px;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        background: #f9f9f9;
    }

    .right-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .panel-header {
        padding: 15px;
        border-bottom: 1px solid #ddd;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 12pt;
    }

    .listen-section {
        padding: 20px;
    }

    .instructions {
        margin: 0 0 15px 0;
        font-size: 10pt;
        color: #666;
        line-height: 1.5;
    }

    .button-group {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }

    .listening-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
        padding: 12px;
        background: #e3f2fd;
        border-radius: 4px;
        color: #1976d2;
        font-weight: 500;
        font-size: 10pt;
    }

    .pulse-dot {
        width: 12px;
        height: 12px;
        background: #2196f3;
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(0.8);
        }
    }

    .inputs-list {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .input-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 4px;
        animation: slideIn 0.2s ease-out;
    }

    .input-color-badge {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .input-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e3f2fd;
        border-radius: 4px;
        color: #2196f3;
        flex-shrink: 0;
    }

    .input-icon :global(svg) {
        width: 20px;
        height: 20px;
    }

    .input-info {
        flex: 1;
        min-width: 0;
    }

    .input-name {
        font-weight: 600;
        font-size: 10pt;
        margin-bottom: 4px;
    }

    .input-name-edit {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid #2196f3;
        border-radius: 4px;
        font-size: 10pt;
        font-weight: 600;
        margin-bottom: 4px;
    }

    .input-details {
        font-size: 9pt;
        color: #666;
        font-family: var(--font-stack-mono);
    }

    .input-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }

    .empty-state {
        text-align: center;
        color: #999;
        font-size: 10pt;
        padding: 40px 20px;
    }
</style>
