<script>
    import { onMount, onDestroy } from 'svelte';
    import { isButtonInput, getInputPropertyName } from '../../lib/inputs/utils.js';
    import { inputLibrary } from '../../stores.svelte.js';
    import { getUnusedFromPalette, getPalette } from '../../lib/inputs/colors.js';
    import { toCSSIdentifier } from '../../lib/css/utils.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import InputCard from '../cards/InputCard.svelte';
    import Button from '../common/Button.svelte';
    import EditInputDialog from '../dialogs/EditInputDialog.svelte';
    import recordIcon from '../../assets/icons/record.svg?raw';
    import stopIcon from '../../assets/icons/stop.svg?raw';

    let {
        inputController
    } = $props();

    // Get inputs reactively from library
    let inputs = $derived(inputLibrary.getAll());

    let isListening = $state(false);
    let editInputDialog; // Reference to EditInputDialog component
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number } }
    let thingyEulerAngles = $state({}); // Track Euler angles for Thingy devices: { deviceId: { roll, pitch, yaw } }

    const deviceColorUsage = new Map(); // deviceId -> Set(colors)
    const deviceColorIndices = new Map(); // deviceId -> last palette index used when cycling
    const COLOR_CAPABLE_PREFIXES = ['button-', 'note-'];

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => inputs,
        onReorder: (orderedIds) => {
            inputLibrary.reorder(orderedIds);
        },
        orientation: 'horizontal',
        getItemId: (item) => item.id
    });

    function getInputStateDisplay(input) {
        const state = inputStates[input.id];
        if (!state) return '';

        // For buttons (toggle or momentary)
        if (isButtonInput(input)) {
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

    function shouldAssignColorSupport(device, controlId) {
        // For now, Thingy:52 buttons support RGB
        // Other devices will get colorSupport from profile/device definitions
        if (device.type === 'bluetooth' && device.thingyDevice) {
            return 'rgb';
        }
        // For other devices, would need to query device profile
        // Default to 'none' if no color support
        return 'none';
    }

    function registerColorUsage(deviceId, controlId, color) {
        if (!deviceId || !color || !isColorCapableControl(controlId)) return;

        if (!deviceColorUsage.has(deviceId)) {
            deviceColorUsage.set(deviceId, new Set());
        }
        deviceColorUsage.get(deviceId).add(color);
    }

    function releaseColorUsage(deviceId, controlId, color) {
        if (!deviceId || !color || !isColorCapableControl(controlId)) return;

        const usage = deviceColorUsage.get(deviceId);
        if (!usage) return;
        usage.delete(color);
        if (usage.size === 0) {
            deviceColorUsage.delete(deviceId);
            deviceColorIndices.delete(deviceId);
        }
    }

    function rebuildDeviceColorUsage() {
        deviceColorUsage.clear();
        deviceColorIndices.clear();
        for (const input of inputs) {
            registerColorUsage(input.inputDeviceId, input.inputControlId, input.color);
        }
    }

    // Event handlers
    let inputEventHandlers = [];

    function getNextAvailableColor(deviceId, colorSupport = 'rgb') {
        // Get fixed color for single-color buttons
        if (colorSupport === 'red') return 'red';
        if (colorSupport === 'green') return 'green';
        if (colorSupport === 'none') return null;
        
        // For RGB buttons, cycle through available colors
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
                    type: eventData.type, // Pass type from device event
                    colorSupport: eventData.colorSupport, // Pass colorSupport from device event
                    friendlyName: eventData.friendlyName, // Pass friendlyName from device event
                    orientation: eventData.orientation, // Pass orientation from device event
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

        const { deviceId, controlId, device, type, colorSupport, friendlyName, orientation } = event;

        // DEBUG: Log what we're receiving for CC buttons
        if (controlId?.startsWith('cc-') && parseInt(controlId.replace('cc-', '')) >= 100) {
            console.log('[InputsView.handleRawInput] DEBUG:', {
                deviceId,
                controlId,
                deviceName: device?.name,
                type,
                supportsColor,
                friendlyName,
                orientation
            });
        }

        // Check if this input already exists
        const existing = inputs.find(
            input => input.inputDeviceId === deviceId && input.inputControlId === controlId
        );

        if (!existing) {
            // Auto-save new input
            const name = friendlyName || formatInputName(device?.name || deviceId, controlId);
            
            // Get appropriate color based on colorSupport type
            const color = getNextAvailableColor(deviceId, colorSupport);

            const input = inputLibrary.create({
                name,
                inputDeviceId: deviceId,
                inputControlId: controlId,
                inputDeviceName: device?.name || deviceId,
                type: type || 'button', // Use type from device
                colorSupport: colorSupport || 'none', // Use colorSupport from device
                friendlyName: friendlyName || null, // Use friendlyName from device
                orientation: orientation || null, // Use orientation from device
                color
            });

            // Initialize pressure property for button inputs
            if (isButtonInput(input)) {
                inputController.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, '0.0%');
            }

            if (colorSupport && colorSupport !== 'none') {
                registerColorUsage(deviceId, controlId, input.color);

                // Refresh all colors on the device to show assigned vs unassigned buttons
                applyColorsToDevices().catch(err => {
                    console.warn(`Could not apply colors to devices:`, err);
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
                type: eventData.type, // Pass type from device event
                colorSupport: eventData.colorSupport, // Pass colorSupport from device event
                friendlyName: eventData.friendlyName, // Pass friendlyName from device event
                orientation: eventData.orientation, // Pass orientation from device event
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
        const existingInput = inputLibrary.get(input.id);
        if (existingInput) {
            const oldColor = existingInput.color;
            
            // Prepare updates object
            const updates = {
                name: result.name
            };

            // Update button mode for button inputs
            if (isButtonInput(existingInput)) {
                updates.buttonMode = result.buttonMode;
            }

            // Update color if it changed and control supports color
            if (result.color !== oldColor && existingInput.colorSupport && existingInput.colorSupport !== 'none') {
                // Release old color usage
                if (oldColor) {
                    releaseColorUsage(existingInput.inputDeviceId, existingInput.inputControlId, oldColor);
                }

                // Update color
                updates.color = result.color;

                // Register new color usage
                if (result.color) {
                    registerColorUsage(existingInput.inputDeviceId, existingInput.inputControlId, result.color);
                }

                // Update color on hardware (only if device is connected)
                const inputDevice = inputController.getInputDevice(existingInput.inputDeviceId);
                if (inputDevice && result.color) {
                    // For toggle buttons, respect current state
                    let color = result.color;
                    if (isButtonInput(existingInput) && existingInput.buttonMode === 'toggle') {
                        const state = inputStates[existingInput.id];
                        color = (state?.state === 'on') ? result.color : 'black';
                    }

                    // Use generic setColor method
                    await inputDevice.setColor(existingInput.inputControlId, color);

                    // Update Thingy device LED color if it's a Thingy device
                    if (inputDevice.type === 'bluetooth' && inputDevice.thingyDevice) {
                        inputDevice.thingyDevice.setDeviceColor(result.color);
                    }
                }
            }

            // Apply updates (includes CSS identifier update if name/buttonMode changed)
            inputLibrary.update(existingInput.id, updates);
        }
    }

    async function deleteInput(inputId) {
        const input = inputLibrary.get(inputId);
        if (!input) return;

        // Release color usage for this device
        releaseColorUsage(input.inputDeviceId, input.inputControlId, input.color);

        inputLibrary.remove(inputId);

        // Refresh all colors on devices to update unassigned buttons
        await applyColorsToDevices();
    }

    // Initialize input states when inputs change
    $effect(() => {
        // Initialize input states for all inputs
        for (const input of inputs) {
            if (isButtonInput(input)) {
                // Initialize toggle buttons to 'off', momentary buttons have no initial state
                if (input.buttonMode === 'toggle' && !inputStates[input.id]) {
                    inputStates[input.id] = { state: 'off' };
                    // Note: Initial color will be set by applyColorsToDevices()
                }
            } else {
                // Initialize knobs/sliders to 0%
                if (!inputStates[input.id]) {
                    inputStates[input.id] = { value: 0 };
                }
            }
        }

        rebuildDeviceColorUsage();
    });

    async function applyColorsToDevices() {
        // Get all connected devices
        const devices = inputController.getInputDevices();

        for (const device of devices) {
            // Only apply to devices that support colors
            if (!deviceSupportsColors(device)) continue;

            // For MIDI devices with profiles, clear all color-capable controls
            if (device.type === 'midi' && device.profile) {
                // Build a map of assigned controls for this device
                const assignedControls = new Map();
                for (const input of inputs) {
                    if (input.inputDeviceId === device.id && input.color) {
                        assignedControls.set(input.inputControlId, input);
                    }
                }

                // Get all color-capable controls from the profile
                const colorCapableControls = device.profile.controls?.filter(
                    ctrl => ctrl.colorSupport && ctrl.colorSupport !== 'none'
                ) || [];

                // Check if device supports batch color updates (Akai LPD8 MK2, etc.)
                const supportsBatchUpdate = typeof device.profile.setPadColor === 'function' &&
                                           typeof device.profile.flushColors === 'function';

                if (supportsBatchUpdate && device.profile.padNotes) {
                    // Batch mode: update all pad states first, then send ONE message
                    for (const note of device.profile.padNotes) {
                        const controlId = `note-${note}`;
                        const input = assignedControls.get(controlId);

                        if (input) {
                            // Set assigned color
                            let color = input.color;

                            // For toggle buttons, respect the current toggle state
                            if (isButtonInput(input) && input.buttonMode === 'toggle') {
                                const state = inputStates[input.id];
                                color = (state?.state === 'on') ? input.color : 'black';
                            }

                            device.profile.setPadColor(note, color);
                        } else {
                            // Set unassigned buttons to black
                            device.profile.setPadColor(note, 'black');
                        }
                    }

                    // Send single update with all pad colors
                    const command = device.profile.flushColors();
                    if (command && command.type === 'sysex' && device.midiOutput) {
                        device.midiOutput.send(command.value);
                    }
                } else {
                    // Non-batch mode: send individual updates for all color-capable controls
                    for (const control of colorCapableControls) {
                        const input = assignedControls.get(control.controlId);

                        if (input) {
                            // Set assigned color
                            let color = input.color;

                            // For toggle buttons, respect the current toggle state
                            if (isButtonInput(input) && input.buttonMode === 'toggle') {
                                const state = inputStates[input.id];
                                color = (state?.state === 'on') ? input.color : 'black';
                            }

                            await device.setColor(control.controlId, color);
                        } else {
                            // Set unassigned controls to black/off
                            await device.setColor(control.controlId, 'black');
                        }
                    }
                }
            } else {
                // For other devices (HID, Bluetooth), apply colors only to saved inputs
                for (const input of inputs) {
                    if (input.inputDeviceId !== device.id) continue;
                    if (!input.color || !input.colorSupport || input.colorSupport === 'none') continue;

                    // For toggle buttons, respect the current toggle state
                    let color = input.color;
                    if (isButtonInput(input) && input.buttonMode === 'toggle') {
                        const state = inputStates[input.id];
                        color = (state?.state === 'on') ? input.color : 'black';
                    }

                    await device.setColor(input.inputControlId, color);
                }
            }
        }
    }

    async function updateButtonColorForToggleState(input, isOn) {
        // Update button color based on toggle state (on = full color, off = black)
        const inputDevice = inputController.getInputDevice(input.inputDeviceId);
        if (!inputDevice || !input.color || !input.colorSupport || input.colorSupport === 'none') return;

        const color = isOn ? input.color : 'black';

        // Use generic setColor method for all device types
        await inputDevice.setColor(input.inputControlId, color);
    }

    onMount(() => {
        // Set up device event handlers FIRST, before processing existing devices
        // Apply colors when devices connect
        inputController.on('deviceadded', (device) => {
            // Track Euler angles for Thingy:52 devices
            if (device.type === 'bluetooth') {
                if (device.thingyDevice) {
                    device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                        thingyEulerAngles[device.id] = { roll, pitch, yaw };
                    });
                }

                // Auto-create button input for Thingy:52 (it always has exactly one button)
                const controlId = 'button';
                const existing = inputs.find(
                    input => input.inputDeviceId === device.id && input.inputControlId === controlId
                );

                if (!existing) {
                    const name = formatInputName(device.name || device.id, controlId);
                    // Thingy:52 button supports RGB color
                    const colorSupport = 'rgb';
                    const color = getNextAvailableColor(device.id, colorSupport);

                    const input = inputLibrary.create({
                        name,
                        inputDeviceId: device.id,
                        inputControlId: controlId,
                        inputDeviceName: device.name || device.id,
                        type: 'button',
                        colorSupport: 'rgb',
                        friendlyName: null,
                        color: color
                    });

                    // Initialize pressure property for button input
                    if (isButtonInput(input)) {
                        inputController.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, '0.0%');
                    }

                    if (colorSupport && colorSupport !== 'none') {
                        registerColorUsage(device.id, controlId, input.color);
                    }
                } else if (!existing.color) {
                    // Input exists but has no color assigned - assign one now
                    const colorSupport = shouldAssignColorSupport(device, controlId);
                    if (colorSupport && colorSupport !== 'none') {
                        const color = getNextAvailableColor(device.id, colorSupport);
                        inputLibrary.update(existing.id, { color });
                        registerColorUsage(device.id, controlId, color);
                    }
                }
            }

            // Apply colors to devices that support them (HID, MIDI, and Bluetooth)
            if (deviceSupportsColors(device)) {
                // Small delay to ensure device is fully initialized
                setTimeout(() => {
                    applyColorsToDevices().catch(err => {
                        console.warn('Failed to apply colors on device added:', err);
                    });
                }, 500);
            }
        });

        // Now process already-connected devices
        // Auto-create button inputs for any already-connected Thingy:52 devices
        const devices = inputController.getInputDevices();
        for (const device of devices) {
            if (device.type === 'bluetooth' && device.thingyDevice) {
                // Auto-create button input for Thingy:52 (it always has exactly one button)
                const controlId = 'button';
                const existing = inputs.find(
                    input => input.inputDeviceId === device.id && input.inputControlId === controlId
                );

                if (!existing) {
                    const name = formatInputName(device.name || device.id, controlId);
                    // Thingy:52 button supports RGB color
                    const colorSupport = 'rgb';

                    const input = inputLibrary.create({
                        name,
                        inputDeviceId: device.id,
                        inputControlId: controlId,
                        inputDeviceName: device.name || device.id,
                        type: 'button',
                        colorSupport: 'rgb',
                        friendlyName: null,
                        color: getNextAvailableColor(device.id, colorSupport)
                    });

                    // Initialize pressure property for button input
                    if (isButtonInput(input)) {
                        inputController.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, '0.0%');
                    }

                    if (colorSupport && colorSupport !== 'none') {
                        registerColorUsage(device.id, controlId, input.color);
                    }
                } else if (!existing.color) {
                    // Input exists but has no color assigned - assign one now
                    const colorSupport = shouldAssignColorSupport(device, controlId);
                    if (colorSupport && colorSupport !== 'none') {
                        const color = getNextAvailableColor(device.id, colorSupport);
                        inputLibrary.update(existing.id, { color });
                        registerColorUsage(device.id, controlId, color);
                    }
                }

                // Track Euler angles
                device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                    thingyEulerAngles[device.id] = { roll, pitch, yaw };
                });
            }
        }

        // Apply colors immediately after inputs are loaded
        // Use a small delay to ensure devices are ready
        setTimeout(() => {
            applyColorsToDevices().catch(err => {
                console.warn('Failed to apply colors on initial load:', err);
            });
        }, 100);

        // Track input state changes for display
        inputController.on('input-trigger', ({ mapping, velocity, toggleState }) => {
            // For toggle buttons, use the toggleState from the event
            if (mapping.buttonMode === 'toggle') {
                inputStates[mapping.id] = { state: toggleState ? 'on' : 'off' };

                // Update button color based on toggle state
                updateButtonColorForToggleState(mapping, toggleState);
            } else if (isButtonInput(mapping)) {
                // For momentary buttons, show pressed state
                inputStates[mapping.id] = { state: 'pressed' };
            }
        });

        inputController.on('input-release', ({ mapping }) => {
            if (isButtonInput(mapping) && mapping.buttonMode !== 'toggle') {
                // For momentary buttons, clear pressed state
                inputStates[mapping.id] = { state: 'released' };
            }
        });

        inputController.on('input-valuechange', ({ mapping, value }) => {
            if (!isButtonInput(mapping)) {
                // For knobs/sliders, store the value (0-1)
                inputStates[mapping.id] = { value: Math.round(value * 100) };
            }
        });
    });

    onDestroy(() => {
        stopListening();
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
        {#if inputs.length === 0}
            <div class="empty-state">
                <p>No inputs detected yet. Start listening to detect inputs!</p>
            </div>
        {:else}
            {#each inputs as input (input.id)}
                <InputCard
                    {input}
                    {dnd}
                    stateDisplay={getInputStateDisplay(input)}
                    eulerAngles={thingyEulerAngles[input.inputDeviceId]}
                    onEdit={startEditing}
                />
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
</style>
