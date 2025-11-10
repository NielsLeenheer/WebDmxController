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

            // Only Stream Deck devices support colors (not keyboard or MIDI)
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
        // Parse the controlId to determine the type
        if (controlId.startsWith('note-')) {
            const noteNumber = controlId.replace('note-', '');
            return `${deviceName} Note ${noteNumber}`;
        } else if (controlId.startsWith('control-') || controlId.startsWith('cc-')) {
            const controlNumber = controlId.replace('control-', '').replace('cc-', '');
            return `${deviceName} Control ${controlNumber}`;
        } else if (controlId.startsWith('button-')) {
            const buttonNumber = controlId.replace('button-', '');
            return `${deviceName} Button ${buttonNumber}`;
        } else if (controlId.startsWith('key-')) {
            // Extract just the key letter from KeyQ -> Q
            const keyCode = controlId.replace('key-', '');
            const key = keyCode.replace('Key', '').replace('Digit', '') || keyCode;
            return `Keyboard ${key}`;
        } else {
            // Fallback for unknown control types
            return `${deviceName} ${controlId}`;
        }
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
    <div class="listen-section">
        <div class="button-wrapper">
            {#if isListening}
                <Button onclick={stopListening} primary class="listen-button pulsating">
                    Stop Listening
                </Button>
            {:else}
                <Button onclick={startListening} primary class="listen-button">
                    Start Listening
                </Button>
            {/if}
        </div>
    </div>

    <div class="inputs-grid">
        {#if savedInputs.length === 0}
            <div class="empty-state">
                <p>No inputs detected yet. Start listening to detect inputs!</p>
            </div>
        {:else}
            {#each savedInputs as input (input.id)}
                <div class="input-card">
                    {#if input.color}
                        <div class="input-color-badge" style="background-color: {input.color}"></div>
                    {/if}
                    <div class="input-header">
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
                        <div class="input-device-name">
                            {#if inputController.getInputDevice(input.inputDeviceId)}
                                {inputController.getInputDevice(input.inputDeviceId).name}
                            {:else}
                                {input.inputDeviceId}
                            {/if}
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

<style>
    .inputs-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .listen-section {
        padding: 20px;
        display: flex;
        justify-content: center;
    }

    .button-wrapper {
        display: flex;
        justify-content: center;
        position: relative;
    }

    .listen-button :global(button) {
        font-size: 11pt;
        padding: 12px 30px;
        position: relative;
        z-index: 1;
    }

    .listen-button.pulsating :global(button) {
        animation: glowingRing 2s ease-in-out infinite;
    }

    @keyframes glowingRing {
        0%, 100% {
            box-shadow:
                0 0 0 0 rgba(33, 150, 243, 0.7),
                0 0 0 0 rgba(33, 150, 243, 0.4);
        }
        50% {
            box-shadow:
                0 0 0 4px rgba(33, 150, 243, 0.3),
                0 0 0 8px rgba(33, 150, 243, 0.1);
        }
    }

    .inputs-grid {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(15em, 1fr));
        gap: 15px;
        align-content: start;
    }

    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        min-height: 50vh;
        align-content: center;
        color: #999;
        font-size: 10pt;
    }

    .empty-state p {
        margin: 0;
    }

    .input-card {
        background: #f0f0f0;
        border-radius: 8px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: slideIn 0.2s ease-out;
        position: relative;
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

    .input-color-badge {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .input-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-right: 40px; /* Space for color badge */
    }

    .input-name {
        font-weight: 600;
        font-size: 11pt;
        color: #333;
        word-wrap: break-word;
    }

    .input-name-edit {
        width: 100%;
        padding: 6px 10px;
        border: 2px solid #2196f3;
        border-radius: 4px;
        font-size: 11pt;
        font-weight: 600;
        box-sizing: border-box;
    }

    .input-device-name {
        font-size: 9pt;
        color: #666;
    }

    .input-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: auto;
    }
</style>
