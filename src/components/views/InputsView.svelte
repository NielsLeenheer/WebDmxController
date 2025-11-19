<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import { paletteColorToHex, getUnusedFromPalette } from '../../lib/inputs/colors.js';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Preview from '../common/Preview.svelte';
    import EditInputDialog from '../dialogs/EditInputDialog.svelte';
    import recordIcon from '../../assets/icons/record.svg?raw';
    import stopIcon from '../../assets/icons/stop.svg?raw';
    import editIcon from '../../assets/glyphs/edit.svg?raw';


    let {
        inputController,
        mappingLibrary
    } = $props();

    let isListening = $state(false);
    let savedInputs = $state([]);
    let editInputDialog; // Reference to EditInputDialog component
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number } }
    let thingyEulerAngles = $state({}); // Track Euler angles for Thingy devices: { deviceId: { roll, pitch, yaw } }

    // Drag and drop state
    let draggedInput = $state(null);
    let draggedIndex = $state(null);
    let dragOverIndex = $state(null);
    let isAfterMidpoint = $state(false);

    const deviceColorUsage = new Map(); // deviceId -> Set(colors)
    const deviceColorIndices = new Map(); // deviceId -> last palette index used when cycling
    const COLOR_CAPABLE_PREFIXES = ['button-', 'note-'];

    function handleDragStart(event, input) {
        draggedInput = input;
        draggedIndex = savedInputs.findIndex(i => i.id === input.id);
        event.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(event, index) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dragOverIndex = index;

        // Calculate if mouse is in the second half of the card
        const rect = event.currentTarget.getBoundingClientRect();
        const mouseX = event.clientX;
        const cardMidpoint = rect.left + rect.width / 2;
        isAfterMidpoint = mouseX > cardMidpoint;
    }

    function isDragAfter(index) {
        return dragOverIndex === index && isAfterMidpoint;
    }

    function handleDragLeave() {
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDrop(event, targetIndex) {
        event.preventDefault();

        if (!draggedInput) return;

        const currentIndex = savedInputs.findIndex(i => i.id === draggedInput.id);
        if (currentIndex === -1) {
            draggedInput = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Adjust target index based on whether we're inserting after the midpoint
        let insertIndex = targetIndex;
        if (isAfterMidpoint) {
            insertIndex = targetIndex + 1;
        }

        // If dragging from before to after in the same position, no change needed
        if (currentIndex === insertIndex || currentIndex === insertIndex - 1) {
            draggedInput = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Reorder the savedInputs array
        const newInputs = [...savedInputs];
        const [removed] = newInputs.splice(currentIndex, 1);
        // Adjust insert position if we removed an item before it
        const finalInsertIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
        newInputs.splice(finalInsertIndex, 0, removed);
        savedInputs = newInputs;

        // Update the mapping library order
        // Get all mappings and reorder them
        const allMappings = mappingLibrary.getAll();
        const inputMappings = newInputs;
        const nonInputMappings = allMappings.filter(m => m.mode !== 'input');

        // Clear and rebuild the library with new order
        mappingLibrary.mappings.clear();
        [...inputMappings, ...nonInputMappings].forEach(m => {
            mappingLibrary.mappings.set(m.id, m);
        });
        mappingLibrary.save();

        draggedInput = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDragEnd() {
        draggedInput = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function getInputStateDisplay(input) {
        const state = inputStates[input.id];
        if (!state) return '';

        // For buttons (toggle or momentary)
        if (input.isButtonInput()) {
            if (input.buttonMode === 'toggle') {
                return state.state === 'on' ? 'On' : 'Off';
            } else {
                // Momentary buttons - only show when pressed
                return state.state === 'pressed' ? '●' : '';
            }
        }

        // For knobs/sliders
        if (state.value !== undefined) {
            return `${state.value}%`;
        }

        return '';
    }

    function isColorCapableControl(controlId) {
        if (!controlId || typeof controlId !== 'string') return false;
        // Thingy:52 button uses 'button' (not 'button-'), so check exact match too
        if (controlId === 'button') return true;
        return COLOR_CAPABLE_PREFIXES.some(prefix => controlId.startsWith(prefix));
    }

    function deviceSupportsColors(device) {
        if (!device) return false;
        if (device.type === 'hid') {
            return device.id !== 'keyboard';
        }
        // MIDI and Bluetooth (Thingy:52) support colors
        return device.type === 'midi' || device.type === 'bluetooth';
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
        const usedColors = deviceColorUsage.get(deviceId);
        const usedColorsArray = usedColors ? Array.from(usedColors) : [];
        
        // Try to get an unused color
        const unusedColor = getUnusedFromPalette(usedColorsArray);
        if (unusedColor) {
            return unusedColor;
        }

        // All colors are used, cycle through the palette
        const palette = getPalette();
        if (!palette.length) return undefined;

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
                device.setColor(controlId, inputMapping.color).catch(err => {
                    console.warn(`Could not set button color:`, err);
                });
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

    async function startEditing(input) {
        const result = await editInputDialog.open(input);

        if (!result) return; // User cancelled

        if (result.delete) {
            // Handle delete
            await deleteInput(input.id);
            return;
        }

        // Handle save
        const mapping = mappingLibrary.get(input.id);
        if (mapping) {
            const oldColor = mapping.color;
            mapping.name = result.name;

            // Update button mode for button inputs
            if (mapping.mode === 'input' && mapping.isButtonInput()) {
                mapping.buttonMode = result.buttonMode;
            }

            // Update color if it changed and control is color-capable
            if (result.color !== oldColor && isColorCapableControl(mapping.inputControlId)) {
                // Release old color usage
                if (oldColor) {
                    releaseColorUsage(mapping.inputDeviceId, mapping.inputControlId, oldColor);
                }

                // Update color
                mapping.color = result.color;

                // Register new color usage
                if (result.color) {
                    registerColorUsage(mapping.inputDeviceId, mapping.inputControlId, result.color);
                }

                // Update color on hardware (only if device is connected)
                const inputDevice = inputController.getInputDevice(mapping.inputDeviceId);
                if (inputDevice && result.color) {
                    // For toggle buttons, respect current state
                    let color = result.color;
                    if (mapping.isButtonInput() && mapping.buttonMode === 'toggle') {
                        const state = inputStates[mapping.id];
                        color = (state?.state === 'on') ? result.color : 'black';
                    }

                    // Use generic setColor method
                    await inputDevice.setColor(mapping.inputControlId, color);
                }
            }

            // Update CSS identifiers based on new name and button mode
            mapping.updateCSSIdentifiers();
            mappingLibrary.update(mapping);
            // Note: refreshInputs() is called automatically by the 'changed' listener in onMount
        }
    }

    async function deleteInput(inputId) {
        const input = mappingLibrary.get(inputId);
        if (!input) return;

        // Release color usage for this device before clearing hardware
        releaseColorUsage(input.inputDeviceId, input.inputControlId, input.color);

        // Clear button color on hardware
        const inputDevice = inputController.getInputDevice(input.inputDeviceId);
        if (inputDevice && isColorCapableControl(input.inputControlId)) {
            await inputDevice.setColor(input.inputControlId, 'off');
        }

        mappingLibrary.remove(inputId);
        refreshInputs();
    }

    function refreshInputs() {
        // Only show input-mode mappings
        // Note: Mappings have a version property that increments on update for reactivity
        savedInputs = mappingLibrary.getAll()
            .filter(m => m.mode === 'input');

        // Initialize input states for all inputs
        for (const input of savedInputs) {
            if (input.isButtonInput()) {
                // Initialize toggle buttons to 'off', momentary buttons have no initial state
                if (input.buttonMode === 'toggle') {
                    inputStates[input.id] = { state: 'off' };
                    // Note: Initial color will be set by applyColorsToDevices()
                }
            } else {
                // Initialize knobs/sliders to 0%
                inputStates[input.id] = { value: 0 };
            }
        }

        rebuildDeviceColorUsage();
    }

    async function applyColorsToDevices() {
        // Apply colors to all buttons that have saved inputs
        for (const input of savedInputs) {
            const inputDevice = inputController.getInputDevice(input.inputDeviceId);
            if (!inputDevice || !input.color || !isColorCapableControl(input.inputControlId)) continue;

            // For toggle buttons, respect the current toggle state
            let color = input.color;
            if (input.isButtonInput() && input.buttonMode === 'toggle') {
                const state = inputStates[input.id];
                color = (state?.state === 'on') ? input.color : 'black';
            }

            // Use generic setColor method for all device types
            await inputDevice.setColor(input.inputControlId, color);
        }
    }

    async function updateButtonColorForToggleState(input, isOn) {
        // Update button color based on toggle state (on = full color, off = black)
        const inputDevice = inputController.getInputDevice(input.inputDeviceId);
        if (!inputDevice || !input.color || !isColorCapableControl(input.inputControlId)) return;

        const color = isOn ? input.color : 'black';

        // Use generic setColor method for all device types
        await inputDevice.setColor(input.inputControlId, color);
    }

    onMount(() => {
        refreshInputs();

        // Listen for mapping changes (add/update/remove)
        mappingLibrary.on('changed', ({ type, mapping }) => {
            // Refresh inputs for all change types to ensure UI updates
            refreshInputs();
        });

        // Track Euler angles for Thingy:52 devices
        const devices = inputController.getInputDevices();
        for (const device of devices) {
            if (device.type === 'bluetooth' && device.thingyDevice) {
                device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                    thingyEulerAngles[device.id] = { roll, pitch, yaw };
                });
            }
        }

        // Track input state changes for display
        inputController.on('input-trigger', ({ mapping, velocity, toggleState }) => {
            // For toggle buttons, use the toggleState from the event
            if (mapping.buttonMode === 'toggle') {
                inputStates[mapping.id] = { state: toggleState ? 'on' : 'off' };

                // Update button color based on toggle state
                updateButtonColorForToggleState(mapping, toggleState);
            } else if (mapping.isButtonInput()) {
                // For momentary buttons, show pressed state
                inputStates[mapping.id] = { state: 'pressed' };
            }
        });

        inputController.on('input-release', ({ mapping }) => {
            if (mapping.isButtonInput() && mapping.buttonMode !== 'toggle') {
                // For momentary buttons, clear pressed state
                inputStates[mapping.id] = { state: 'released' };
            }
        });

        inputController.on('input-valuechange', ({ mapping, value }) => {
            if (!mapping.isButtonInput()) {
                // For knobs/sliders, store the value (0-1)
                inputStates[mapping.id] = { value: Math.round(value * 100) };
            }
        });

        // Apply colors when devices connect
        inputController.on('deviceadded', (device) => {
            // Track Euler angles for Thingy:52 devices
            if (device.type === 'bluetooth' && device.thingyDevice) {
                device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                    thingyEulerAngles[device.id] = { roll, pitch, yaw };
                });
            }

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
        
        // Clear all stability timers
        for (const timerId of thingyStabilityTimers.values()) {
            clearTimeout(timerId);
        }
        thingyStabilityTimers.clear();
    });
</script>

<div class="inputs-view">
    <div class="listen-section">
        {#if isListening}
            <Button onclick={stopListening} variant="primary" pulsating={true}>
                {@html stopIcon}
                Stop Listening
            </Button>
        {:else}
            <Button onclick={startListening} variant="secondary">
                {@html recordIcon}
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
            {#each savedInputs as input, index (`${input.id}-${input.version}`)}
                <div
                    class="input-card"
                    class:dragging={draggedInput?.id === input.id}
                    class:drag-over={dragOverIndex === index && !isAfterMidpoint}
                    class:drag-after={isDragAfter(index)}
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, input)}
                    ondragover={(e) => handleDragOver(e, index)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, index)}
                    ondragend={handleDragEnd}
                >
                    {#if input.color && isColorCapableControl(input.inputControlId)}
                        <Preview
                            type="input"
                            size="medium"
                            data={{ color: paletteColorToHex(input.color) }}
                            euler={input.inputControlId === 'button' && thingyEulerAngles[input.inputDeviceId] ? thingyEulerAngles[input.inputDeviceId] : null}
                            class="input-color-badge"
                        />
                    {/if}
                    <div class="input-header">
                        <div class="input-name">{input.name}</div>
                        <div class="input-device-name">
                            {input.inputDeviceName || input.inputDeviceId}
                        </div>
                    </div>
                    {#if input.inputControlId === 'button' && thingyEulerAngles[input.inputDeviceId]}
                        {@const euler = thingyEulerAngles[input.inputDeviceId]}
                        <div class="thingy-euler-preview">
                            <div class="euler-axis">
                                <span class="euler-label">Roll:</span>
                                <span class="euler-value">{euler.roll.toFixed(0)}°</span>
                            </div>
                            <div class="euler-axis">
                                <span class="euler-label">Pitch:</span>
                                <span class="euler-value">{euler.pitch.toFixed(0)}°</span>
                            </div>
                            <div class="euler-axis">
                                <span class="euler-label">Yaw:</span>
                                <span class="euler-value">{euler.yaw.toFixed(0)}°</span>
                            </div>
                        </div>
                    {/if}
                    <div class="input-state">
                        {getInputStateDisplay(input)}
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

<!-- Edit Input Dialog -->
<EditInputDialog
    bind:this={editInputDialog}
    inputController={inputController}
/>

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
        padding: 20px 40px;
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
        position: relative;
        cursor: grab;
        transition: opacity 0.2s, transform 0.2s;
    }

    .input-card:active {
        cursor: grabbing;
    }

    .input-card.dragging {
        opacity: 0.4;
    }

    .input-card.drag-over {
        position: relative;
    }

    .input-card.drag-over::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 0;
        bottom: 0;
        width: 4px;
        background: #2196F3;
        border-radius: 2px;
    }

    .input-card.drag-after::before {
        left: auto;
        right: -8px;
    }

    .input-color-badge {
        position: absolute;
        top: 15px;
        right: 15px;
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

    .input-state {
        position: absolute;
        bottom: 14px;
        left: 14px;
        font-size: 9pt;
        font-weight: 600;
        color: #666;
        min-height: 14px;
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

    /* Thingy:52 Euler angle preview */
    .thingy-euler-preview {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        background: #f6f6f6;
        border-radius: 4px;
        margin: 8px 0;
        font-family: var(--font-stack-mono);
    }

    .euler-axis {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10pt;
    }

    .euler-label {
        color: #666;
        font-weight: 500;
    }

    .euler-value {
        color: #2563eb;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

</style>
