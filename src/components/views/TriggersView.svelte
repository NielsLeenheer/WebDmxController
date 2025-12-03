<script>
    import { triggerLibrary, inputLibrary, animationLibrary, deviceLibrary } from '../../stores.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import TriggerCard from '../cards/TriggerCard.svelte';
    import Button from '../common/Button.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import AddActionTriggerDialog from '../dialogs/AddActionTriggerDialog.svelte';
    import AddAutomaticTriggerDialog from '../dialogs/AddAutomaticTriggerDialog.svelte';
    import AddValueTriggerDialog from '../dialogs/AddValueTriggerDialog.svelte';
    import EditActionTriggerDialog from '../dialogs/EditActionTriggerDialog.svelte';
    import EditAutomaticTriggerDialog from '../dialogs/EditAutomaticTriggerDialog.svelte';
    import EditValueTriggerDialog from '../dialogs/EditValueTriggerDialog.svelte';

    import { Icon } from 'svelte-icon';
    import newIcon from '../../assets/icons/new.svg?raw';
    import editIcon from '../../assets/icons/edit.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    // Get devices reactively from library
    let devices = $derived(deviceLibrary.getAll());

    // Get inputs, animations, and triggers reactively from libraries
    let availableInputs = $derived(inputLibrary.getAll());
    let availableAnimations = $derived(animationLibrary.getAll());
    let triggers = $derived(triggerLibrary.getAll());

    // Get inputs that can be used for value triggers (those with continuous values)
    let valueCapableInputs = $derived(inputLibrary.getValueInputs());

    // Dialog references
    let addActionTriggerDialog;
    let addAutomaticTriggerDialog;
    let addValueTriggerDialog;
    let editActionTriggerDialog;
    let editAutomaticTriggerDialog;
    let editValueTriggerDialog;

    // Context menu reference
    let contextMenuRef = $state(null);

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => triggers,
        onReorder: (orderedIds) => {
            triggerLibrary.reorder(orderedIds);
        },
        orientation: 'vertical'
    });

    async function openActionTriggerDialog() {
        const result = await addActionTriggerDialog.open(availableInputs, availableAnimations, devices);

        if (!result) return; // User cancelled

        const [inputDeviceId, inputControlId] = result.input.split('_');
        const input = availableInputs.find(i =>
            i.deviceId === inputDeviceId && i.controlId === inputControlId
        );
        if (!input) return;

        // Create trigger using library method
        triggerLibrary.create({
            type: 'action',
            input: {
                id: input.id,
                state: result.inputState
            },
            output: {
                id: result.device
            },
            action: {
                type: result.actionType,
                animation: result.actionType === 'animation' ? {
                    id: result.animation,
                    duration: result.duration,
                    easing: result.easing,
                    iterations: result.looping ? 'infinite' : 1
                } : null,
                values: result.actionType === 'values' ? result.values : null
            }
        });
    }

    async function openAutomaticTriggerDialog() {
        const result = await addAutomaticTriggerDialog.open(availableAnimations, devices);

        if (!result) return; // User cancelled

        // Create trigger using library method
        triggerLibrary.create({
            type: 'auto',
            output: {
                id: result.device
            },
            action: {
                type: 'animation',
                animation: {
                    id: result.animation,
                    duration: result.duration,
                    easing: result.easing,
                    iterations: result.looping ? 'infinite' : 1
                }
            }
        });
    }

    async function openValueTriggerDialog() {
        const result = await addValueTriggerDialog.open(valueCapableInputs, devices);

        if (!result) return; // User cancelled

        // Create value trigger using library method
        triggerLibrary.create({
            type: 'value',
            input: {
                id: result.inputId,
                value: result.inputValueKey
            },
            output: {
                id: result.deviceId
            },
            action: {
                type: 'copy',
                copy: {
                    control: result.controlId,
                    component: result.controlValueId,
                    invert: result.invert
                }
            }
        });
    }

    function startEditing(trigger) {
        if (trigger.type === 'value') {
            editValueTrigger(trigger);
        } else if (trigger.type === 'auto') {
            editAutomaticTrigger(trigger);
        } else {
            editActionTrigger(trigger);
        }
    }

    async function editValueTrigger(trigger) {
        const result = await editValueTriggerDialog.open(trigger, valueCapableInputs, devices);

        if (!result || result.action === 'cancel') return; // User cancelled

        // Handle save
        triggerLibrary.update(trigger.id, {
            input: {
                id: result.data.inputId,
                value: result.data.inputValueKey
            },
            output: {
                id: result.data.deviceId
            },
            action: {
                type: 'copy',
                copy: {
                    control: result.data.controlId,
                    component: result.data.controlValueId,
                    invert: result.data.invert
                }
            }
        });
    }

    async function editAutomaticTrigger(trigger) {
        const result = await editAutomaticTriggerDialog.open(trigger, availableAnimations, devices);

        if (!result) return; // User cancelled

        // Handle save using library update method
        triggerLibrary.update(trigger.id, {
            output: {
                id: result.device
            },
            action: {
                type: 'animation',
                animation: {
                    id: result.animation,
                    duration: result.duration,
                    easing: result.easing,
                    iterations: result.looping ? 'infinite' : 1
                }
            }
        });
    }

    async function editActionTrigger(trigger) {
        const result = await editActionTriggerDialog.open(trigger, availableInputs, availableAnimations, devices);

        if (!result) return; // User cancelled

        // Handle save - parse the selected input
        const [newInputDeviceId, newInputControlId] = result.input.split('_');
        const selectedInput = availableInputs.find(input =>
            input.deviceId === newInputDeviceId &&
            input.controlId === newInputControlId
        );

        if (!selectedInput) return;

        // Get button mode from the input
        const buttonMode = selectedInput.buttonMode || 'momentary';

        // Build updates object based on action type
        const updates = {
            input: {
                id: selectedInput.id,
                state: result.inputState
            },
            output: {
                id: result.device
            },
            action: {
                type: result.actionType,
                animation: null,
                values: null
            }
        };

        if (result.actionType === 'animation') {
            updates.action.animation = {
                id: result.animation,
                duration: result.duration,
                easing: result.easing,
                iterations: result.looping ? 'infinite' : 1
            };
        } else {
            updates.action.values = result.values;
        }

        // Update using library method
        triggerLibrary.update(trigger.id, updates);
    }

    function deleteTrigger(trigger) {
        if (confirm('Are you sure you want to delete this trigger?')) {
            triggerLibrary.remove(trigger.id);
        }
    }

    function toggleTriggerEnabled(trigger, enabled) {
        triggerLibrary.update(trigger.id, { enabled });
    }

</script>

<div class="triggers-view">
    <div class="add-trigger-section">
        <Button
            onclick={openActionTriggerDialog}
            variant="secondary"
            disabled={availableInputs.length === 0 || devices.length === 0}
        >
            <Icon data={newIcon} />
            Add Action Trigger
        </Button>
        <Button
            onclick={openValueTriggerDialog}
            variant="secondary"
            disabled={valueCapableInputs.length === 0 || devices.length === 0}
        >
            <Icon data={newIcon} />
            Add Value Trigger
        </Button>
        <Button
            onclick={openAutomaticTriggerDialog}
            variant="secondary"
            disabled={availableAnimations.length === 0 || devices.length === 0}
        >
            <Icon data={newIcon} />
            Add Automatic Trigger
        </Button>
    </div>

    <div class="triggers-list">
        {#if availableInputs.length === 0 || devices.length === 0}
            <div class="empty-state">
                {#if availableInputs.length === 0}
                    <p>No inputs available. Go to the Inputs tab to detect and save inputs first.</p>
                {/if}
                {#if devices.length === 0}
                    <p>No devices available. Go to the Devices tab to add devices first.</p>
                {/if}
            </div>
        {:else if triggers.length === 0}
            <div class="empty-state">
                <p>No triggers created yet. Click Add Trigger to create one!</p>
            </div>
        {:else}
            {#each triggers as trigger (trigger.id)}
                <TriggerCard
                    {trigger}
                    {dnd}
                    onEdit={(item, anchor) => contextMenuRef?.show(item, anchor)}
                    onToggleEnabled={toggleTriggerEnabled}
                />
            {/each}
        {/if}
    </div>
</div>


<!-- Dialog Components -->
<AddActionTriggerDialog
    bind:this={addActionTriggerDialog}
/>

<AddAutomaticTriggerDialog
    bind:this={addAutomaticTriggerDialog}
/>

<AddValueTriggerDialog
    bind:this={addValueTriggerDialog}
/>

<EditActionTriggerDialog
    bind:this={editActionTriggerDialog}
/>

<EditAutomaticTriggerDialog
    bind:this={editAutomaticTriggerDialog}
/>

<EditValueTriggerDialog
    bind:this={editValueTriggerDialog}
/>

<ContextMenu bind:contextRef={contextMenuRef}>
    <ContextAction onclick={(trigger) => startEditing(trigger)}>
        {@html editIcon}
        Edit
    </ContextAction>
    <ContextAction onclick={(trigger) => deleteTrigger(trigger)} variant="danger">
        {@html removeIcon}
        Delete
    </ContextAction>
</ContextMenu>

<style>
    .triggers-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .add-trigger-section {
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
    }

    .triggers-list {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
    }

    .empty-state {
        width: 100%;
        text-align: center;
        min-height: 50vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 10pt;
        gap: 10px;
    }

    .empty-state p {
        margin: 0;
        padding: 12px;
        max-width: 500px;
    }

    /* Dialog column layout */
    .trigger-columns {
        display: grid;
        grid-template-columns: 180px 200px 1fr;
        gap: 20px;
    }

    #automatic-trigger-form .trigger-columns {
        grid-template-columns: 180px 1fr;
    }

    .trigger-columns .trigger-column {
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 0;
    }

    .trigger-column.with-divider {
        border-left: 2px solid #eee;
        padding-left: 20px;
    }

    .trigger-column .trigger-card {
        background: #f6f6f6;
        width: 340px;
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 0;
        flex: 1;
    }

    .duration-with-loop {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
    }

    .duration-with-loop input[type="number"] {
        width: 100px;
    }

    .duration-with-loop .checkbox-field {
        margin: 0;
    }

    .duration-with-loop .checkbox-field label {
        font-size: 10pt;
    }

    .controls-info {
        font-size: 9pt;
        color: #666;
        margin-bottom: 8px;
        font-style: italic;
    }

</style>
