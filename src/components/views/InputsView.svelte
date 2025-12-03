<script>
    import { onMount, onDestroy } from 'svelte';
    import { isButton } from '../../lib/inputs/utils.js';
    import { InputListeningController } from '../../lib/inputs/InputListeningController.js';
    import { inputLibrary } from '../../stores.svelte.js';
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

    let editInputDialog; // Reference to EditInputDialog component
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number } }
    let thingyEulerAngles = $state({}); // Track Euler angles for Thingy devices: { deviceId: { roll, pitch, yaw } }

    // Context menu state
    let contextMenuRef = $state(null);

    // Input listening controller
    let listeningController = $state(null);
    let isListening = $state(false);

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => inputs,
        onReorder: (orderedIds) => {
            inputLibrary.reorder(orderedIds);
        },
        orientation: 'horizontal',
        getItemId: (item) => item.id
    });

    function startListening() {
        listeningController?.startListening();
        isListening = true;
    }

    function stopListening() {
        listeningController?.stopListening();
        isListening = false;
    }

    async function startEditing(input) {
        const result = await editInputDialog.open(input);

        if (!result) return; // User cancelled

        // Handle save - prepare updates object
        const existingInput = inputLibrary.get(input.id);
        if (existingInput) {
            const updates = {
                name: result.name
            };

            // Update button mode for button inputs
            if (isButton(existingInput)) {
                updates.buttonMode = result.buttonMode;
            }

            // Include color in updates if it changed
            if (result.color !== existingInput.color) {
                updates.color = result.color;
            }

            // Library emits event, controller syncs hardware
            inputLibrary.update(existingInput.id, updates);
        }
    }

    function deleteInput(inputId) {
        const input = inputLibrary.get(inputId);
        if (!input) return;

        if (!confirm(`Are you sure you want to delete "${input.name}"`)) return;

        // Library emits event, controller syncs hardware
        inputLibrary.remove(inputId);
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
    });

    onMount(() => {
        // Create the listening controller
        listeningController = new InputListeningController(inputController, inputLibrary);

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
                    // Library will auto-assign a color
                    inputLibrary.update(thingyInput.id, { 
                        color: inputLibrary.getNextColor(device.id, 'rgb') 
                    });

                    // Initialize pressure property for thingy input (it has button functionality)
                    inputController.customPropertyManager.setProperty(`${thingyInput.cssIdentifier}-pressure`, '0.0%');
                }
            }

            // Apply colors to the newly connected device
            // Small delay to ensure device is fully initialized
            setTimeout(() => {
                inputController.applyColorsToDevices().catch(err => {
                    console.warn('Failed to apply colors on device added:', err);
                });
            }, 500);
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
                    // Library will auto-assign a color
                    inputLibrary.update(thingyInput.id, { 
                        color: inputLibrary.getNextColor(device.id, 'rgb') 
                    });

                    // Initialize pressure property for thingy input (it has button functionality)
                    inputController.customPropertyManager.setProperty(`${thingyInput.cssIdentifier}-pressure`, '0.0%');
                }
            }
        }

        // Apply colors immediately after inputs are loaded
        // Use a small delay to ensure devices are ready
        setTimeout(() => {
            inputController.applyColorsToDevices().catch(err => {
                console.warn('Failed to apply colors on initial load:', err);
            });
        }, 100);

        // Track input state changes for display
        inputController.on('input-trigger', ({ mapping, velocity, toggleState }) => {
            // For toggle buttons, use the toggleState from the event
            if (mapping.buttonMode === 'toggle') {
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: toggleState ? 'on' : 'off', pressed: true };

                // Update button color based on toggle state
                inputController.updateButtonColorForToggleState(mapping, toggleState);
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
                    onEdit={(input, anchor) => contextMenuRef?.show(input, anchor)}
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
