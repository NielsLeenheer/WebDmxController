<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Dialog from '../common/Dialog.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';
    import editIcon from '../../assets/glyphs/edit.svg?raw';

    let {
        inputController,
        mappingLibrary
    } = $props();

    let isListening = $state(false);
    let savedInputs = $state([]);
    let editingInput = $state(null);
    let editingName = $state('');
    let editDialog = null; // DOM reference - should NOT be $state

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
                inputDeviceName: device?.name || deviceId, // Store device name for display
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

        requestAnimationFrame(() => {
            editDialog?.showModal();
        });
    }

    function saveEdit() {
        if (!editingInput || !editingName.trim()) return;

        // Get the mapping from the library and update it
        const mapping = mappingLibrary.get(editingInput.id);
        if (mapping) {
            mapping.name = editingName.trim();
            // Update CSS identifiers based on new name
            mapping.updateCSSIdentifiers();
            mappingLibrary.update(mapping);
            refreshInputs();
        }

        closeEditDialog();
    }

    function cancelEdit() {
        closeEditDialog();
    }

    function closeEditDialog() {
        editDialog?.close();
        editingInput = null;
        editingName = '';
    }

    // Generate preview of CSS property name based on current editing name
    function getPreviewPropertyName() {
        if (!editingName.trim()) return '--';

        const propertyName = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        return `--${propertyName}`;
    }

    // Generate preview of button down class name based on current editing name
    function getPreviewButtonDownClass() {
        if (!editingName.trim()) return '';

        const namePart = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
            .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores

        return `${namePart}_down`;
    }

    // Generate preview of button up class name based on current editing name
    function getPreviewButtonUpClass() {
        if (!editingName.trim()) return '';

        const namePart = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
            .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores

        return `${namePart}_up`;
    }

    async function confirmDelete() {
        if (!editingInput) return;

        if (confirm(`Are you sure you want to delete "${editingInput.name}"?`)) {
            await deleteInput(editingInput.id);
            closeEditDialog();
        }
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
        savedInputs = mappingLibrary.getAll()
            .filter(m => m.mode === 'input');
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
        {#if isListening}
            <Button onclick={stopListening} variant="primary" pulsating={true}>
                Stop Listening
            </Button>
        {:else}
            <Button onclick={startListening} variant="secondary">
                Start Listening
            </Button>
        {/if}
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
                        <div class="input-name">{input.name}</div>
                        <div class="input-device-name">
                            {input.inputDeviceName || input.inputDeviceId}
                        </div>
                    </div>
                    <div class="input-actions">
                        <button
                            class="edit-button"
                            onclick={() => startEditing(input)}
                            title="Rename input"
                        >
                            {@html editIcon}
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- Edit Dialog -->
{#if editingInput}
<Dialog
    bind:dialogRef={editDialog}
    title="Input"
    onclose={closeEditDialog}
>
    <form id="edit-input-form" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
        <div class="dialog-input-group">
            <label for="input-name">Name:</label>
            <input
                id="input-name"
                type="text"
                bind:value={editingName}
                placeholder="Input name"
                onkeydown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                }}
                autofocus
            />
            <div class="css-identifiers">
                {#if editingInput.isButtonInput()}
                    <code class="css-id">.{getPreviewButtonDownClass()}</code>
                    <code class="css-id">.{getPreviewButtonUpClass()}</code>
                {:else}
                    <code class="css-id">{getPreviewPropertyName()}</code>
                {/if}
            </div>
        </div>
    </form>

    {#snippet tools()}
        <Button onclick={confirmDelete} variant="secondary">
            {@html removeIcon}
            Delete
        </Button>
    {/snippet}

    {#snippet buttons()}
        <Button onclick={cancelEdit} variant="secondary">Cancel</Button>
        <Button type="submit" form="edit-input-form" variant="primary">Save</Button>
    {/snippet}
</Dialog>
{/if}

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

    .edit-button {
        padding: 4px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: #666;
        transition: background 0.2s;
    }

    .edit-button:hover {
        background: #e0e0e0;
    }

    .edit-button :global(svg) {
        width: 20px;
        height: 20px;
    }

    /* Dialog content styles */
    .dialog-input-group {
        margin-bottom: 16px;
    }

    .dialog-input-group input {
        font-size: 10pt;
    }

    .css-identifiers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .css-id {
        font-family: var(--font-stack-mono);
        font-size: 8pt;
        color: #007acc;
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
    }
</style>
