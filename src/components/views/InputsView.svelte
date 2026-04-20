<script>
    import { onMount, onDestroy } from 'svelte';
    import { isButton } from '../../lib/inputs/utils.js';
    import { InputListeningController } from '../../lib/inputs/InputListeningController.js';
    import { inputLibrary } from '../../stores.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import InputCard from '../cards/InputCard.svelte';
    import GroupCard from '../cards/GroupCard.svelte';
    import Button from '../common/Button.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import ContextSeparator from '../common/ContextSeparator.svelte';
    import EditInputDialog from '../dialogs/EditInputDialog.svelte';
    import AudioPreviewDialog from '../dialogs/AudioPreviewDialog.svelte';
    import recordIcon from '../../assets/icons/record.svg?raw';
    import stopIcon from '../../assets/icons/stop.svg?raw';
    import editIcon from '../../assets/icons/edit.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';
    import audioIcon from '../../assets/icons/audio.svg?raw';
    import backIcon from '../../assets/icons/back.svg?raw';
    import forwardIcon from '../../assets/icons/forward.svg?raw';

    let {
        inputController
    } = $props();

    // Get inputs reactively from library
    let inputs = $derived(inputLibrary.getAll());

    let editInputDialog; // Reference to EditInputDialog component
    let audioPreviewDialog; // Reference to AudioPreviewDialog component
    let inputStates = $state({}); // Track state/value for each input: { inputId: { state: 'on'|'off', value: number, roll?, pitch?, yaw? } }
    let contextInput = $state(null); // Track which input the context menu is open for

    // Context menu state
    let contextMenuRef = $state(null);

    // Input listening controller
    let listeningController = $state(null);
    let isListening = $state(false);

    // Groups sidebar state
    let sidebarOpen = $state(false);

    // Derive groups from select-mode inputs. All `scene:*` inputs collapse into
    // a single "Scenes" group (matching the exclusive-selection semantics in
    // InputController._handleTrigger). Single-item groups with no explicit
    // selectGroup are skipped — they're not meaningful as a "group".
    let groups = $derived.by(() => {
        const byKey = new Map(); // key → { key, label, inputs[] }
        for (const input of inputs) {
            if (!isButton(input) || input.buttonMode !== 'select') continue;
            if (!input.selectGroup) continue;

            const isScene = input.selectGroup.startsWith('scene:');
            const key = isScene ? '__scene__' : input.selectGroup;
            const label = isScene ? 'Scenes' : input.selectGroup;

            let group = byKey.get(key);
            if (!group) {
                group = { key, label, inputs: [] };
                byKey.set(key, group);
            }
            group.inputs.push(input);
        }
        return [...byKey.values()];
    });

    // Build the per-group items passed to each GroupCard. `selected` comes
    // from inputStates[id].state, which is kept in sync by the input-trigger
    // listener and seeded on mount from the persisted selectGroupStates.
    let groupCards = $derived(
        groups.map(group => ({
            key: group.key,
            label: group.label,
            items: group.inputs.map(input => ({
                input,
                selected: inputStates[input.id]?.state === 'selected',
                inputState: inputStates[input.id] || {}
            }))
        }))
    );

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }

    function selectFromSidebar(input) {
        inputController.triggerInput(input);
    }

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
                updates.selectGroup = result.selectGroup;
            }

            // Include color in updates if it changed
            if (result.color !== existingInput.color) {
                updates.color = result.color;
            }

            // Include draw button for joycon sensor inputs
            if (result.drawButton !== undefined && existingInput.type === 'joycon') {
                updates.drawButton = result.drawButton;
            }
            if (result.clearButton !== undefined && existingInput.type === 'joycon') {
                updates.clearButton = result.clearButton;
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

                if (input.type === 'heartrate') {
                    inputStates[input.id]['heartrate'] = 0;
                    inputStates[input.id]['beat'] = 0;
                }
            }
        }
    });

    onMount(() => {
        // Create the listening controller
        listeningController = new InputListeningController(inputController, inputLibrary);

        // Seed select-state from persisted selectGroupStates so the sidebar
        // checkmarks match reality after a reload, before any input events
        // have had a chance to repopulate inputStates.
        for (const input of inputs) {
            if (!isButton(input) || input.buttonMode !== 'select') continue;
            const rawGroup = input.selectGroup || input.id;
            const groupKey = rawGroup.startsWith('scene:') ? '__scene__' : rawGroup;
            const selectedId = inputController.selectGroupStates.get(groupKey);
            inputStates[input.id] = {
                ...inputStates[input.id],
                state: selectedId === input.id ? 'selected' : 'deselected'
            };
        }

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
            if (device.type === 'audio') {
                const audioInput = inputs.find(i => i.type === 'audio');
                if (audioInput) {
                    inputStates[audioInput.id] = { ...inputStates[audioInput.id], connected: false };
                }
            }
        });

        inputController.on('deviceadded', (device) => {
            if (device.type === 'audio') {
                const audioInput = inputs.find(i => i.type === 'audio');
                if (audioInput) {
                    inputStates[audioInput.id] = { ...inputStates[audioInput.id], connected: true };
                }
            }
        });

        // Seed initial connected state for any audio device already present
        // (e.g. when switching back to the inputs view after the mic was granted).
        const initialAudio = inputController.inputDeviceManager
            ?.getAllDevices?.()
            ?.find(d => d.type === 'audio');
        if (initialAudio) {
            const audioInput = inputs.find(i => i.type === 'audio');
            if (audioInput) {
                inputStates[audioInput.id] = { ...inputStates[audioInput.id], connected: true };
            }
        }

        // Track input state changes for display
        inputController.on('input-trigger', ({ mapping, velocity, toggleState, selectState }) => {
            // For toggle buttons, use the toggleState from the event
            if (mapping.buttonMode === 'toggle') {
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: toggleState ? 'on' : 'off', pressed: true };
            } else if (mapping.buttonMode === 'select') {
                // For select buttons, mark this one as selected and deselect others in the group.
                // All scene:* selectGroups collapse into one exclusive group, matching the
                // controller's logic in _handleTrigger. Without the collapse, clicking
                // "scene B" wouldn't clear the "scene A" selection.
                const groupKeyOf = (i) => {
                    const raw = i.selectGroup || i.id;
                    return raw.startsWith('scene:') ? '__scene__' : raw;
                };
                const group = groupKeyOf(mapping);
                for (const input of inputs) {
                    if (input.buttonMode !== 'select') continue;
                    if (input.id === mapping.id) continue;
                    if (groupKeyOf(input) !== group) continue;
                    inputStates[input.id] = { ...inputStates[input.id], state: 'deselected', pressed: false };
                }
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: 'selected', pressed: true };
            } else if (isButton(mapping)) {
                // For momentary buttons, show pressed state
                inputStates[mapping.id] = { ...inputStates[mapping.id], state: 'pressed', pressed: true };
            }
        });

        inputController.on('input-release', ({ mapping }) => {
            if (isButton(mapping)) {
                // Track physical release for all buttons (including toggle and select)
                // For momentary buttons, also update state to 'released'
                if (mapping.buttonMode === 'toggle' || mapping.buttonMode === 'select') {
                    inputStates[mapping.id] = { ...inputStates[mapping.id], pressed: false };
                } else {
                    inputStates[mapping.id] = { ...inputStates[mapping.id], pressed: false, state: 'released' };
                }
            }
        });

        inputController.on('input-valuechange', ({ mapping, value, x, y, roll, pitch, yaw, heartrate, beat }) => {
            if (mapping.type === 'stick' && x !== undefined && y !== undefined) {
                inputStates[mapping.id] = { ...inputStates[mapping.id], x, y };
            }
            else if (mapping.type === 'thingy' && roll !== undefined) {
                // Euler angles for Thingy:52
                inputStates[mapping.id] = { ...inputStates[mapping.id], roll, pitch, yaw };
            }
            else if (mapping.type === 'heartrate' && (heartrate !== undefined || beat !== undefined)) {
                const updates = { ...inputStates[mapping.id] };
                if (heartrate !== undefined) updates.heartrate = heartrate;
                if (beat !== undefined) updates.beat = beat;
                inputStates[mapping.id] = updates;
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
        {#if groups.length > 0}
            <button
                type="button"
                class="sidebar-toggle"
                onclick={toggleSidebar}
                title={sidebarOpen ? 'Hide groups' : 'Show groups'}
                aria-pressed={sidebarOpen}
            >
                {@html sidebarOpen ? backIcon : forwardIcon}
            </button>
        {/if}
    </div>

    <div class="inputs-body">
        {#if groups.length > 0}
            <aside class="groups-sidebar" class:open={sidebarOpen} aria-hidden={!sidebarOpen}>
                <div class="groups-sidebar-inner">
                    {#each groupCards as card (card.key)}
                        <GroupCard
                            label={card.label}
                            items={card.items}
                            onSelect={selectFromSidebar}
                        />
                    {/each}
                </div>
            </aside>
        {/if}

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
                        onEdit={(input, anchor) => { contextInput = input; contextMenuRef?.show(input, anchor); }}
                    />
                {/each}
            {/if}
        </div>
    </div>
</div>

<!-- Edit Input Dialog -->
<EditInputDialog
    bind:this={editInputDialog}
    {inputLibrary}
/>

<!-- Audio Preview Dialog -->
<AudioPreviewDialog bind:this={audioPreviewDialog} />

<!-- Context Menu -->
<ContextMenu bind:contextRef={contextMenuRef}>
    <ContextAction onclick={(input) => startEditing(input)}>
        {@html editIcon}
        Edit
    </ContextAction>
    {#if contextInput?.type === 'audio'}
        <ContextAction
            disabled={!inputStates[contextInput?.id]?.connected}
            onclick={(input) => {
                const device = inputController.getInputDevice(input?.deviceId);
                if (device) audioPreviewDialog?.show(device, inputController);
            }}
        >
            {@html audioIcon}
            Audio Settings
        </ContextAction>
    {/if}
    <ContextSeparator />
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
        position: relative;
        padding: 20px;
        display: flex;
        justify-content: center;
    }

    .sidebar-toggle {
        position: absolute;
        left: 40px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        background: transparent;
        color: #666;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s;
    }

    .sidebar-toggle :global(svg) {
        width: 20px;
        height: 20px;
    }

    .sidebar-toggle:hover {
        color: #333;
    }

    .inputs-body {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
    }

    .inputs-grid {
        flex: 1;
        overflow-y: auto;
        padding: 20px 40px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(18em, 1fr));
        gap: 16px;
        align-content: start;
    }

    .groups-sidebar {
        flex-shrink: 0;
        width: 0;
        overflow: hidden;
        transition: width 0.25s ease;
    }

    .groups-sidebar.open {
        width: 300px;
    }

    .groups-sidebar-inner {
        width: 240px;
        height: 100%;
        padding: 20px 20px 20px 40px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-sizing: content-box;
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
