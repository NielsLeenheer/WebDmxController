<script>
    import { triggerLibrary, inputLibrary, animationLibrary, deviceLibrary } from '../../stores.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import TriggerCard from '../cards/TriggerCard.svelte';
    import Button from '../common/Button.svelte';
    import AddManualTriggerDialog from '../dialogs/AddManualTriggerDialog.svelte';
    import AddAutomaticTriggerDialog from '../dialogs/AddAutomaticTriggerDialog.svelte';
    import EditManualTriggerDialog from '../dialogs/EditManualTriggerDialog.svelte';
    import EditAutomaticTriggerDialog from '../dialogs/EditAutomaticTriggerDialog.svelte';

    // Get devices reactively from library
    let devices = $derived(deviceLibrary.getAll());

    // Get inputs, animations, and triggers reactively from libraries
    let availableInputs = $derived(inputLibrary.getAll());
    let availableAnimations = $derived(animationLibrary.getAll());
    let triggers = $derived(triggerLibrary.getAll());

    // Dialog references
    let addManualTriggerDialog;
    let addAutomaticTriggerDialog;
    let editManualTriggerDialog;
    let editAutomaticTriggerDialog;

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => triggers,
        onReorder: (orderedIds) => {
            triggerLibrary.reorder(orderedIds);
        },
        orientation: 'vertical'
    });

    async function openManualTriggerDialog() {
        const result = await addManualTriggerDialog.open(availableInputs, availableAnimations, devices);

        if (!result) return; // User cancelled

        const [inputDeviceId, inputControlId] = result.input.split('_');
        const input = availableInputs.find(i =>
            i.inputDeviceId === inputDeviceId && i.inputControlId === inputControlId
        );
        if (!input) return;

        // Create trigger using library method
        triggerLibrary.create({
            triggerType: result.triggerType,
            actionType: result.actionType,
            inputId: input.id,
            deviceId: result.device,
            // Animation action properties
            animation: result.actionType === 'animation' ? {
                id: result.animation,
                duration: result.duration,
                easing: result.easing,
                iterations: result.looping ? 'infinite' : 1
            } : null,
            // Values action properties
            values: result.actionType === 'values' ? {
                channelValues: result.channelValues,
                enabledControls: result.enabledControls
            } : null
        });
    }

    async function openAutomaticTriggerDialog() {
        const result = await addAutomaticTriggerDialog.open(availableAnimations, devices);

        if (!result) return; // User cancelled

        // Create trigger using library method
        triggerLibrary.create({
            triggerType: 'always',
            actionType: 'animation',
            inputId: null,
            deviceId: result.device,
            animation: {
                id: result.animation,
                duration: result.duration,
                easing: result.easing,
                iterations: result.looping ? 'infinite' : 1
            }
        });
    }

    async function openEditDialog(trigger) {
        if (trigger.triggerType === 'always') {
            // Automatic trigger
            const result = await editAutomaticTriggerDialog.open(trigger, availableAnimations, devices);

            if (!result) return; // User cancelled

            if (result.delete) {
                // Handle delete
                triggerLibrary.remove(trigger.id);
                return;
            }

            // Handle save using library update method
            triggerLibrary.update(trigger.id, {
                deviceId: result.device,
                animation: {
                    id: result.animation,
                    duration: result.duration,
                    easing: result.easing,
                    iterations: result.looping ? 'infinite' : 1
                }
            });
        } else {
            // Manual trigger
            const result = await editManualTriggerDialog.open(trigger, availableInputs, availableAnimations, devices);

            if (!result) return; // User cancelled

            if (result.delete) {
                // Handle delete
                triggerLibrary.remove(trigger.id);
                return;
            }

            // Handle save - parse the selected input
            const [newInputDeviceId, newInputControlId] = result.input.split('_');
            const selectedInput = availableInputs.find(input =>
                input.inputDeviceId === newInputDeviceId &&
                input.inputControlId === newInputControlId
            );

            if (!selectedInput) return;

            // Get button mode from the input
            const buttonMode = selectedInput.buttonMode || 'momentary';

            // Build updates object based on action type
            const updates = {
                inputId: selectedInput.id,
                triggerType: result.triggerType,
                actionType: result.actionType,
                deviceId: result.device
            };

            if (result.actionType === 'animation') {
                updates.animation = {
                    id: result.animation,
                    duration: result.duration,
                    easing: result.easing,
                    iterations: result.looping ? 'infinite' : 1
                };
                updates.values = null;
            } else {
                updates.animation = null;
                updates.values = {
                    channelValues: result.channelValues,
                    enabledControls: result.enabledControls
                };
                updates.animationName = null;
            }

            // Update using library method
            triggerLibrary.update(trigger.id, updates);
        }
    }

</script>

<div class="triggers-view">
    <div class="add-trigger-section">
        <Button
            onclick={openManualTriggerDialog}
            variant="secondary"
            disabled={availableInputs.length === 0 || devices.length === 0}
        >
            Add Manual Trigger
        </Button>
        <Button
            onclick={openAutomaticTriggerDialog}
            variant="secondary"
            disabled={availableAnimations.length === 0 || devices.length === 0}
        >
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
                    onEdit={openEditDialog}
                />
            {/each}
        {/if}
    </div>
</div>


<!-- Dialog Components -->
<AddManualTriggerDialog
    bind:this={addManualTriggerDialog}
/>

<AddAutomaticTriggerDialog
    bind:this={addAutomaticTriggerDialog}
/>

<EditManualTriggerDialog
    bind:this={editManualTriggerDialog}
/>

<EditAutomaticTriggerDialog
    bind:this={editAutomaticTriggerDialog}
/>

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
