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
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number, roll?, pitch?, yaw? } }

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

                if (input.type === 'thingy') {
                    inputStates[input.id]['roll'] = null;
                    inputStates[input.id]['pitch'] = null;
                    inputStates[input.id]['yaw'] = null;
                }
            }
        }
    });

    onMount(() => {
        // Create the listening controller
        listeningController = new InputListeningController(inputController, inputLibrary);

        // Reset euler values to null when Thingy devices disconnect
        inputController.on('deviceremoved', (device) => {
            if (device.type === 'thingy') {
                // Find the thingy input for this device and reset euler to null
                const thingyInput = inputs.find(
                    input => input.deviceId === device.id && input.type === 'thingy'
                );
                if (thingyInput && inputStates[thingyInput.id]) {
                    inputStates[thingyInput.id] = {
                        ...inputStates[thingyInput.id],
                        roll: null,
                        pitch: null,
                        yaw: null
                    };
                }
            }
        });

        // Track input state changes for display
        inputController.on('input-trigger', ({ mapping, velocity, toggleState }) => {
            // For toggle buttons, use the toggleState from the event
            if (mapping.buttonMode === 'toggle') {
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: toggleState ? 'on' : 'off', pressed: true };
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

        inputController.on('input-valuechange', ({ mapping, value, x, y, roll, pitch, yaw }) => {
            if (mapping.type === 'stick' && x !== undefined && y !== undefined) {
                inputStates[mapping.id] = { ...inputStates[mapping.id], x, y };
            } 
            else if (mapping.type === 'thingy' && roll !== undefined) {
                // Euler angles for Thingy:52
                inputStates[mapping.id] = { ...inputStates[mapping.id], roll, pitch, yaw };
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
                    onEdit={(input, anchor) => contextMenuRef?.show(input, anchor)}
                />
            {/each}
        {/if}
    </div>
</div>

<!-- Edit Input Dialog -->
<EditInputDialog
    bind:this={editInputDialog}
    {inputController}
    {inputLibrary}
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
