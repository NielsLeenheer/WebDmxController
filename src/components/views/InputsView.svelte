<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping, INPUT_COLOR_PALETTE } from '../../lib/mappings.js';
    import { getInputColorCSS } from '../../lib/inputColors.js';
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
    let editingButtonMode = $state('momentary');
    let editDialog = null; // DOM reference - should NOT be $state

    const deviceColorUsage = new Map(); // deviceId -> Set(colors)
    const deviceColorIndices = new Map(); // deviceId -> last palette index used when cycling
    const COLOR_CAPABLE_PREFIXES = ['button-', 'note-'];

    function isColorCapableControl(controlId) {
        if (!controlId || typeof controlId !== 'string') return false;
        return COLOR_CAPABLE_PREFIXES.some(prefix => controlId.startsWith(prefix));
    }

    function deviceSupportsColors(device) {
        if (!device) return false;
        if (device.type === 'hid') {
            return device.id !== 'keyboard';
        }
        return device.type === 'midi';
    }

    function shouldAssignColor(device, controlId) {
        return deviceSupportsColors(device) && isColorCapableControl(controlId);
    }

    function normalizeColor(color) {
        if (!color || typeof color !== 'string') return null;
        return color.trim().toLowerCase();
    }

    function registerColorUsage(deviceId, controlId, color) {
        const normalized = normalizeColor(color);
        if (!deviceId || !normalized || !isColorCapableControl(controlId)) return;

        if (!deviceColorUsage.has(deviceId)) {
            deviceColorUsage.set(deviceId, new Set());
        }
        deviceColorUsage.get(deviceId).add(normalized);
    }

    function releaseColorUsage(deviceId, controlId, color) {
        const normalized = normalizeColor(color);
        if (!deviceId || !normalized || !isColorCapableControl(controlId)) return;

        const usage = deviceColorUsage.get(deviceId);
        if (!usage) return;
        usage.delete(normalized);
        if (usage.size === 0) {
            deviceColorUsage.delete(deviceId);
            deviceColorIndices.delete(deviceId);
        }
    }

    function rebuildDeviceColorUsage() {
        deviceColorUsage.clear();
        deviceColorIndices.clear();
        for (const input of savedInputs) {
            registerColorUsage(input.inputDeviceId, input.inputControlId, input.color);
        }
    }

    // Event handlers
    let inputEventHandlers = [];

    function getNextAvailableColor(deviceId) {
        const palette = INPUT_COLOR_PALETTE || [];
        if (!palette.length) return undefined;

        const usedColors = deviceColorUsage.get(deviceId);
        if (!usedColors || usedColors.size === 0) {
            return palette[0];
        }

        for (const color of palette) {
            if (!usedColors.has(color)) {
                return color;
            }
        }

        const lastIndex = deviceColorIndices.get(deviceId) ?? -1;
        const nextIndex = (lastIndex + 1) % palette.length;
        deviceColorIndices.set(deviceId, nextIndex);
        return palette[nextIndex];
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

            // Stream Deck (HID, not keyboard) and MIDI devices support colors
            const supportsColor = shouldAssignColor(device, controlId);

            const inputMapping = new InputMapping({
                name,
                mode: 'input',  // Mark as input-only (not a trigger mapping)
                inputDeviceId: deviceId,
                inputControlId: controlId,
                inputDeviceName: device?.name || deviceId, // Store device name for display
                color: supportsColor ? getNextAvailableColor(deviceId) : null  // unique random color if supported
            });

            mappingLibrary.add(inputMapping);
            refreshInputs();

            if (supportsColor) {
                registerColorUsage(deviceId, controlId, inputMapping.color);
            }

            // Set color on hardware for devices that support it
            if (supportsColor) {
                if (device.type === 'hid' && controlId.startsWith('button-')) {
                    // Stream Deck button
                    const buttonIndex = parseInt(controlId.replace('button-', ''));
                    if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                        const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
                        const serialNumber = deviceId;
                        streamDeckManager.setButtonColor(serialNumber, buttonIndex, inputMapping.color).catch(err => {
                            console.warn(`Could not set Stream Deck button ${buttonIndex} color:`, err);
                        });
                    }
                } else if (device.type === 'midi' && controlId.startsWith('note-')) {
                    // MIDI note/button
                    const noteNumber = parseInt(controlId.replace('note-', ''));
                    if (!isNaN(noteNumber) && noteNumber >= 0) {
                        device.setButtonColor(noteNumber, inputMapping.color);
                    }
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
        editingButtonMode = input.buttonMode || 'momentary';

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

            // Update button mode for button inputs
            if (mapping.mode === 'input' && mapping.isButtonInput()) {
                mapping.buttonMode = editingButtonMode;
            }

            // Update CSS identifiers based on new name and button mode
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

    // Generate preview of button on class name based on current editing name
    function getPreviewButtonOnClass() {
        if (!editingName.trim()) return '';

        const namePart = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
            .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores

        return `${namePart}_on`;
    }

    // Generate preview of button off class name based on current editing name
    function getPreviewButtonOffClass() {
        if (!editingName.trim()) return '';

        const namePart = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
            .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores

        return `${namePart}_off`;
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

    // Release color usage for this device before clearing hardware
    releaseColorUsage(input.inputDeviceId, input.inputControlId, input.color);

    // Clear button color on hardware
        const inputDevice = inputController.getInputDevice(input.inputDeviceId);
        if (inputDevice?.type === 'hid' && inputDevice.id !== 'keyboard' && input.inputControlId.startsWith('button-')) {
            // Stream Deck button
            const buttonIndex = parseInt(input.inputControlId.replace('button-', ''));
            if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
                const serialNumber = input.inputDeviceId;
                await streamDeckManager.clearButtonColor(serialNumber, buttonIndex);
            }
        } else if (inputDevice?.type === 'midi' && input.inputControlId.startsWith('note-')) {
            // MIDI note/button
            const noteNumber = parseInt(input.inputControlId.replace('note-', ''));
            if (!isNaN(noteNumber) && noteNumber >= 0) {
                if (typeof inputDevice.setButtonColor === 'function') {
                    inputDevice.setButtonColor(noteNumber, 'off');
                }
                inputDevice.sendNoteOff(noteNumber);
            }
        }

        mappingLibrary.remove(inputId);
        refreshInputs();
    }

    function refreshInputs() {
        // Only show input-mode mappings
        savedInputs = mappingLibrary.getAll()
            .filter(m => m.mode === 'input');

        rebuildDeviceColorUsage();
    }

    async function applyColorsToDevices() {
        // Apply colors to all buttons that have saved inputs
        for (const input of savedInputs) {
            const inputDevice = inputController.getInputDevice(input.inputDeviceId);
            if (!inputDevice || !input.color || !isColorCapableControl(input.inputControlId)) continue;

            if (inputDevice.type === 'hid' && inputDevice.id !== 'keyboard' && input.inputControlId.startsWith('button-')) {
                // Stream Deck button
                const buttonIndex = parseInt(input.inputControlId.replace('button-', ''));
                if (!isNaN(buttonIndex) && buttonIndex >= 0) {
                    const streamDeckManager = inputController.inputDeviceManager.streamDeckManager;
                    const serialNumber = input.inputDeviceId;
                    await streamDeckManager.setButtonColor(serialNumber, buttonIndex, input.color);
                }
            } else if (inputDevice.type === 'midi' && input.inputControlId.startsWith('note-')) {
                // MIDI note/button
                const noteNumber = parseInt(input.inputControlId.replace('note-', ''));
                if (!isNaN(noteNumber) && noteNumber >= 0) {
                    inputDevice.setButtonColor(noteNumber, input.color);
                }
            }
        }
    }

    onMount(() => {
        refreshInputs();

        // Apply colors when devices connect
        inputController.on('deviceadded', (device) => {
            if (device.type === 'hid' || device.type === 'midi') {
                // Small delay to ensure device is fully initialized
                setTimeout(() => applyColorsToDevices(), 500);
            }
        });

        // Apply colors on initial load
        setTimeout(() => applyColorsToDevices(), 1000);
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
                    {#if input.color && isColorCapableControl(input.inputControlId)}
                        <div
                            class="input-color-badge"
                            style="background-color: {getInputColorCSS(input.color)}"
                        ></div>
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
        </div>

        {#if editingInput.isButtonInput()}
            <div class="dialog-input-group">
                <label for="button-mode">Button Mode:</label>
                <select id="button-mode" bind:value={editingButtonMode}>
                    <option value="momentary">Momentary (Down/Up)</option>
                    <option value="toggle">Toggle (On/Off)</option>
                </select>
            </div>

            <div class="css-identifiers">
                {#if editingButtonMode === 'toggle'}
                    <code class="css-id">.{getPreviewButtonOnClass()}</code>
                    <code class="css-id">.{getPreviewButtonOffClass()}</code>
                {:else}
                    <code class="css-id">.{getPreviewButtonDownClass()}</code>
                    <code class="css-id">.{getPreviewButtonUpClass()}</code>
                {/if}
            </div>
        {:else}
            <div class="css-identifiers">
                <code class="css-id">{getPreviewPropertyName()}</code>
            </div>
        {/if}
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
