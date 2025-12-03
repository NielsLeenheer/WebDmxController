<script>
    import { onMount, onDestroy } from 'svelte';
    import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
    import { inputLibrary } from '../../stores.svelte.js';
    import { getUnusedFromPalette, getPalette } from '../../lib/inputs/colors.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import InputCard from '../cards/InputCard.svelte';
    import Button from '../common/Button.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import EditInputDialog from '../dialogs/EditInputDialog.svelte';
    import recordIcon from '../../assets/icons/record.svg?raw';
    import stopIcon from '../../assets/icons/stop.svg?raw';
    import editIcon from '../../assets/icons/edit.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let {
        inputController
    } = $props();

    // Get inputs reactively from library
    let inputs = $derived(inputLibrary.getAll());

    let isListening = $state(false);
    let editInputDialog; // Reference to EditInputDialog component
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number } }
    let thingyEulerAngles = $state({}); // Track Euler angles for Thingy devices: { deviceId: { roll, pitch, yaw } }

    // Context menu state
    let contextMenuRef = $state(null);

    function showContextMenu(input, anchorElement) {
        contextMenuRef?.show(anchorElement, input);
    }

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

    function isColorCapableControl(controlId) {
        if (!controlId || typeof controlId !== 'string') return false;
        // Thingy:52 uses 'thingy' controlId (single input with button + sensor functionality)
        if (controlId === 'thingy') return true;
        return COLOR_CAPABLE_PREFIXES.some(prefix => controlId.startsWith(prefix));
    }

    function deviceSupportsColors(device) {
        if (!device) return false;
        // StreamDeck, MIDI and Thingy:52 support colors
        return device.type === 'streamdeck' || device.type === 'midi' || device.type === 'thingy';
    }

    function shouldAssignColorSupport(device, controlId) {
        // For now, Thingy:52 buttons support RGB
        // Other devices will get colorSupport from profile/device definitions
        if (device.type === 'thingy') {
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
            registerColorUsage(input.deviceId, input.controlId, input.color);
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
                    deviceBrand: eventData.deviceBrand, // Pass deviceBrand from device event
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

        const { deviceId, controlId, device, type, colorSupport, friendlyName, orientation, deviceBrand } = event;

        // Skip Thingy:52 inputs entirely - they are added via the connect dialog, not by listening
        if (device?.type === 'thingy') return;

        // Check if this input already exists
        const existing = inputs.find(
            input => input.deviceId === deviceId && input.controlId === controlId
        );

        if (!existing) {
            // Auto-save new input
            const name = friendlyName || formatInputName(device?.name || deviceId, controlId);
            
            // Get appropriate color based on colorSupport type
            const color = getNextAvailableColor(deviceId, colorSupport);

            const input = inputLibrary.create({
                name,
                deviceId: deviceId,
                deviceName: device?.name || deviceId,
                controlId: controlId,
                controlName: friendlyName || null,
                type: type || 'button',
                colorSupport: colorSupport || 'none',
                orientation: orientation || null,
                deviceBrand: deviceBrand || null,
                color
            });

            // Initialize state for the new input
            if (isButton(input)) {
                inputController.customPropertyManager.setProperty(`${input.cssIdentifier}-pressure`, '0.0%');
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
                deviceBrand: eventData.deviceBrand, // Pass deviceBrand from device event
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

        // Handle save
        const existingInput = inputLibrary.get(input.id);
        if (existingInput) {
            const oldColor = existingInput.color;
            
            // Prepare updates object
            const updates = {
                name: result.name
            };

            // Update button mode for button inputs
            if (isButton(existingInput)) {
                updates.buttonMode = result.buttonMode;
            }

            // Update color if it changed and control supports color
            if (result.color !== oldColor && existingInput.colorSupport && existingInput.colorSupport !== 'none') {
                // Release old color usage
                if (oldColor) {
                    releaseColorUsage(existingInput.deviceId, existingInput.controlId, oldColor);
                }

                // Update color
                updates.color = result.color;

                // Register new color usage
                if (result.color) {
                    registerColorUsage(existingInput.deviceId, existingInput.controlId, result.color);
                }

                // Update color on hardware (only if device is connected)
                const inputDevice = inputController.getInputDevice(existingInput.deviceId);
                if (inputDevice && result.color) {
                    // For toggle buttons, respect current state
                    let color = result.color;
                    if (isButton(existingInput) && existingInput.buttonMode === 'toggle') {
                        const state = inputStates[existingInput.id];
                        color = (state?.state === 'on') ? result.color : 'black';
                    }

                    // Use generic setColor method
                    await inputDevice.setColor(existingInput.controlId, color);

                    // Update Thingy device LED color if it's a Thingy device
                    if (inputDevice.type === 'thingy' && inputDevice.thingyDevice) {
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

        if (!confirm(`Are you sure you want to delete "${input.name}"?`)) return;

        // Release color usage for this device
        releaseColorUsage(input.deviceId, input.controlId, input.color);

        inputLibrary.remove(inputId);

        // Refresh all colors on devices to update unassigned buttons
        await applyColorsToDevices();
    }

    // Initialize input states when inputs change
    $effect(() => {
        // Initialize input states for all inputs
        for (const input of inputs) {
            if (!inputStates[input.id]) {
                inputStates[input.id] = { pressed: false };

                if (isButton(input) && input.buttonMode === 'toggle') {
                    inputStates[input.id]['state'] = 'off';
                }
            
                if (input.type === 'stick') {
                    inputStates[input.id]['x'] = 50;
                    inputStates[input.id]['y'] = 50;
                }

                if (input.type == 'axis') {
                    inputStates[input.id]['value'] = 50;
                } 
                
                if (input.type == 'knob' || input.type == 'slider') {
                    inputStates[input.id]['value'] = 0;
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
                    if (input.deviceId === device.id && input.color) {
                        assignedControls.set(input.controlId, input);
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
                            if (isButton(input) && input.buttonMode === 'toggle') {
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
                            if (isButton(input) && input.buttonMode === 'toggle') {
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
            } else if (typeof device.getControls === 'function') {
                // For devices with getControls() method (StreamDeck, etc.)
                const controls = device.getControls();
                
                // Build a map of assigned controls for this device
                const assignedControls = new Map();
                for (const input of inputs) {
                    if (input.deviceId === device.id && input.color) {
                        assignedControls.set(input.controlId, input);
                    }
                }

                for (const control of controls) {
                    if (!control.colorSupport || control.colorSupport === 'none') continue;

                    const input = assignedControls.get(control.controlId);

                    if (input) {
                        // Set assigned color
                        let color = input.color;

                        // For toggle buttons, respect the current toggle state
                        if (isButton(input) && input.buttonMode === 'toggle') {
                            const state = inputStates[input.id];
                            color = (state?.state === 'on') ? input.color : 'black';
                        }

                        await device.setColor(control.controlId, color);
                    } else {
                        // Set unassigned controls to black/off
                        await device.setColor(control.controlId, 'black');
                    }
                }
            } else {
                // For other devices (HID, Bluetooth) without getControls(), apply colors only to saved inputs
                for (const input of inputs) {
                    if (input.deviceId !== device.id) continue;
                    if (!input.color || !input.colorSupport || input.colorSupport === 'none') continue;

                    // For toggle buttons, respect the current toggle state
                    let color = input.color;
                    if (isButton(input) && input.buttonMode === 'toggle') {
                        const state = inputStates[input.id];
                        color = (state?.state === 'on') ? input.color : 'black';
                    }

                    await device.setColor(input.controlId, color);
                }
            }
        }
    }

    async function updateButtonColorForToggleState(input, isOn) {
        // Update button color based on toggle state (on = full color, off = black)
        const inputDevice = inputController.getInputDevice(input.deviceId);
        if (!inputDevice || !input.color || !input.colorSupport || input.colorSupport === 'none') return;

        const color = isOn ? input.color : 'black';

        // Use generic setColor method for all device types
        await inputDevice.setColor(input.controlId, color);
    }

    onMount(() => {
        // Set up device event handlers FIRST, before processing existing devices
        // Apply colors when devices connect
        inputController.on('deviceadded', (device) => {
            // Track Euler angles for Thingy:52 devices
            if (device.type === 'thingy' && device.thingyDevice) {
                device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                    thingyEulerAngles[device.id] = { roll, pitch, yaw };
                });

                // Assign color to thingy input if it doesn't have one
                // The input is created by the controller with controlId 'thingy'
                const thingyInput = inputs.find(
                    input => input.deviceId === device.id && input.controlId === 'thingy'
                );

                if (thingyInput && !thingyInput.color) {
                    const color = getNextAvailableColor(device.id, 'rgb');
                    inputLibrary.update(thingyInput.id, { color });
                    registerColorUsage(device.id, 'thingy', color);

                    // Initialize pressure property for thingy input (it has button functionality)
                    inputController.customPropertyManager.setProperty(`${thingyInput.cssIdentifier}-pressure`, '0.0%');
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

        // Clear euler angles when Thingy devices disconnect
        inputController.on('deviceremoved', (device) => {
            if (device.type === 'thingy' && thingyEulerAngles[device.id]) {
                delete thingyEulerAngles[device.id];
            }
        });

        // Now process already-connected devices
        // Track Euler angles and assign colors for any already-connected Thingy:52 devices
        const devices = inputController.getInputDevices();
        for (const device of devices) {
            if (device.type === 'thingy' && device.thingyDevice) {
                // Track Euler angles
                device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
                    thingyEulerAngles[device.id] = { roll, pitch, yaw };
                });

                // Assign color to thingy input if it doesn't have one
                const thingyInput = inputs.find(
                    input => input.deviceId === device.id && input.controlId === 'thingy'
                );

                if (thingyInput && !thingyInput.color) {
                    const color = getNextAvailableColor(device.id, 'rgb');
                    inputLibrary.update(thingyInput.id, { color });
                    registerColorUsage(device.id, 'thingy', color);

                    // Initialize pressure property for thingy input (it has button functionality)
                    inputController.customPropertyManager.setProperty(`${thingyInput.cssIdentifier}-pressure`, '0.0%');
                }
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
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: toggleState ? 'on' : 'off', pressed: true };

                // Update button color based on toggle state
                updateButtonColorForToggleState(mapping, toggleState);
            } else if (isButton(mapping)) {
                // For momentary buttons, show pressed state
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: 'pressed', pressed: true };
            }
        });

        inputController.on('input-release', ({ mapping }) => {
            if (isButton(mapping)) {
                // Track physical release for all buttons (including toggle)
                // For momentary buttons, also update state to 'released'
                if (mapping.buttonMode !== 'toggle') {
                    inputStates[mapping.id] = { ...inputStates[mapping.id], pressed: false, state: 'released' };
                } else {
                    inputStates[mapping.id] = { ...inputStates[mapping.id], pressed: false };
                }
            }
        });

        inputController.on('input-valuechange', ({ mapping, value, x, y }) => {
            if (mapping.type === 'stick' && x !== undefined && y !== undefined) {
                inputStates[mapping.id] = { ...inputStates[mapping.id], x, y };
            } 
            else if (!isButton(mapping) && value !== undefined) {
                inputStates[mapping.id] = { ...inputStates[mapping.id], value: Math.round(value * 100) };
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
                    inputState={inputStates[input.id] || {}}
                    eulerAngles={thingyEulerAngles[input.deviceId]}
                    onEdit={showContextMenu}
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

<!-- Context Menu -->
<ContextMenu bind:contextRef={contextMenuRef}>
    <ContextAction onclick={(input) => startEditing(input)}>
        {@html editIcon}
        Edit
    </ContextAction>
    <ContextAction onclick={(input) => deleteInput(input?.id)} variant="danger">
        {@html removeIcon}
        Delete
    </ContextAction>
</ContextMenu>

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
        grid-template-columns: repeat(auto-fill, minmax(18em, 1fr));
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
