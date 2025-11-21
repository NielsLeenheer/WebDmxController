<script>
    import { Trigger } from '../../lib/triggers.js';
    import { Animation } from '../../lib/animations.js';
    import { Input } from '../../lib/inputs.js';
    import { triggerLibrary, inputLibrary, animationLibrary, deviceLibrary } from '../../lib/libraries.svelte.js';
    import { DEVICE_TYPES, getDevicePreviewData } from '../../lib/outputs/devices.js';
    import { paletteColorToHex } from '../../lib/inputs/colors.js';
    import { getDeviceColor } from '../../lib/colorUtils.js';
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

    // Get trigger type options for a trigger being edited
    function getTriggerTypeOptionsForTrigger(trigger) {
        const input = availableInputs.find(i => i.id === trigger.inputId);
        if (!input || !Input.isButtonInput(input)) {
            return [
                { value: 'pressed', label: 'Pressed' },
                { value: 'not-pressed', label: 'Not Pressed' }
            ];
        }

        const buttonMode = input.buttonMode || 'momentary';

        if (buttonMode === 'toggle') {
            return [
                { value: 'pressed', label: 'On' },
                { value: 'not-pressed', label: 'Off' }
            ];
        } else {
            return [
                { value: 'pressed', label: 'Down' },
                { value: 'not-pressed', label: 'Up' }
            ];
        }
    }

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

    function getInputName(inputId) {
        const input = availableInputs.find(i => i.id === inputId);
        return input?.name || 'Unknown Input';
    }

    function getDeviceName(deviceId) {
        const device = devices.find(d => d.id === deviceId);
        return device?.name || deviceId;
    }

    // Get input preview color
    function getInputPreview(trigger) {
        const input = availableInputs.find(i => i.id === trigger.inputId);
        return input?.color ? paletteColorToHex(input.color) : '#888';
    }

    // Get input type label (On/Off/Up/Down)
    function getInputTypeLabel(trigger) {
        const input = availableInputs.find(i => i.id === trigger.inputId);

        if (!input) return trigger.triggerType === 'pressed' ? 'Down' : 'Up';

        // Check if it's toggle mode
        if (input.buttonMode === 'toggle') {
            return trigger.triggerType === 'pressed' ? 'On' : 'Off';
        } else {
            return trigger.triggerType === 'pressed' ? 'Down' : 'Up';
        }
    }

    // Get preview for value-based trigger
    function getValuePreview(trigger) {
        const device = devices.find(d => d.id === trigger.deviceId);
        if (!device) return '#888';

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return '#888';

        // Build values array from channelValues
        const values = new Array(deviceType.channels).fill(0);
        for (const [channelIndex, value] of Object.entries(trigger.values?.channelValues || {})) {
            values[parseInt(channelIndex)] = value;
        }

        return getDeviceColor(device.type, values);
    }

    // Get all special controls being set by a values trigger
    function getSpecialControls(trigger) {
        if (trigger.actionType !== 'values') return null;

        const device = devices.find(d => d.id === trigger.deviceId);
        if (!device) return null;

        // Check which channels are being set
        const channelIndices = Object.keys(trigger.values?.channelValues || {}).map(k => parseInt(k));
        if (channelIndices.length === 0) return null;

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return null;

        // Map channel indices to control names
        const controls = deviceType.components.map((comp, idx) => ({
            index: idx,
            name: comp.name
        }));

        // Collect which special controls are being set
        const hasFuel = channelIndices.some(idx => controls[idx]?.name === 'Fuel');
        const hasSafety = channelIndices.some(idx => controls[idx]?.name === 'Safety');
        const hasOutput = channelIndices.some(idx => controls[idx]?.name === 'Output');

        // Build array in correct stacking order (bottom to top)
        const specialControls = [];
        if (hasFuel) specialControls.push('fuel');
        if (hasOutput) specialControls.push('output');
        if (hasSafety) specialControls.push('safety');  // Safety always on top

        return specialControls.length > 0 ? specialControls : null;
    }

    // Get the value for a specific control in a values trigger
    function getControlValue(trigger, controlName) {
        const device = devices.find(d => d.id === trigger.deviceId);
        if (!device) return 0;

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return 0;

        // Find the channel index for this control
        const channelIndex = deviceType.components.findIndex(c => c.name === controlName);
        if (channelIndex === -1) return 0;

        return trigger.values?.channelValues?.[channelIndex] || 0;
    }

    // Get device ID from trigger (unified property)
    function getTriggerDeviceId(trigger) {
        return trigger.deviceId;
    }

    // Get device preview based on default values
    function getDevicePreview(trigger) {
        const deviceId = getTriggerDeviceId(trigger);
        const device = devices.find(d => d.id === deviceId);
        if (!device) return '#888';

        return getDeviceColor(device.type, device.defaultValues);
    }

    // Helper functions for channel value management
    function getSelectedDevice(deviceId) {
        return devices.find(d => d.id === deviceId);
    }

    function getDeviceChannels(deviceId) {
        const device = getSelectedDevice(deviceId);
        if (!device) return [];

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return [];

        return deviceType.controls.map((control, index) => ({
            index,
            name: control.name,
            type: control.type
        }));
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
                    {getInputName}
                    {getInputTypeLabel}
                    {getInputPreview}
                    {getSpecialControls}
                    {getControlValue}
                    {getValuePreview}
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
