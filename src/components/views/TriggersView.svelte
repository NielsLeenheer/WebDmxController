<script>
    import { Trigger } from '../../lib/triggers.js';
    import { Animation } from '../../lib/animations.js';
    import { Input } from '../../lib/inputs.js';
    import { DEVICE_TYPES, getDevicePreviewData } from '../../lib/outputs/devices.js';
    import { paletteColorToHex } from '../../lib/inputs/colors.js';
    import { getDeviceColor } from '../../lib/colorUtils.js';
    import { toCSSIdentifier } from '../../lib/css/utils.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import DraggableCard from '../common/DraggableCard.svelte';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Preview from '../common/Preview.svelte';
    import AddManualTriggerDialog from '../dialogs/AddManualTriggerDialog.svelte';
    import AddAutomaticTriggerDialog from '../dialogs/AddAutomaticTriggerDialog.svelte';
    import EditManualTriggerDialog from '../dialogs/EditManualTriggerDialog.svelte';
    import EditAutomaticTriggerDialog from '../dialogs/EditAutomaticTriggerDialog.svelte';
    import editIcon from '../../assets/glyphs/edit.svg?raw';

    let {
        triggerLibrary,
        inputLibrary,
        animationLibrary,
        deviceLibrary
    } = $props();

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
        const input = availableInputs.find(i =>
            i.inputDeviceId === trigger.inputDeviceId &&
            i.inputControlId === trigger.inputControlId
        );
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

        // Get button mode from the input
        const buttonMode = input.buttonMode || 'momentary';

        // Generate CSS class name from input name with state suffix
        const baseClassName = toCSSIdentifier(input.name);

        // Determine suffix based on button mode
        let suffix;
        if (buttonMode === 'toggle') {
            suffix = result.triggerType === 'pressed' ? 'on' : 'off';
        } else {
            suffix = result.triggerType === 'pressed' ? 'down' : 'up';
        }
        const cssClassName = `${baseClassName}-${suffix}`;

        const triggerName = result.actionType === 'animation'
            ? `${input.name}_${result.triggerType}_${result.animation}`
            : `${input.name}_${result.triggerType}_setValue`;

        // Create trigger
        const trigger = new Trigger({
            name: triggerName,
            triggerType: result.triggerType,
            actionType: result.actionType,
            inputDeviceId: input.inputDeviceId,
            inputControlId: input.inputControlId,
            // Animation action properties
            animationName: result.actionType === 'animation' ? result.animation : null,
            targetDeviceIds: result.actionType === 'animation' ? [result.device] : [],
            duration: result.duration,
            easing: result.easing,
            iterations: result.looping ? 'infinite' : 1,
            // SetValue action properties
            setValueDeviceId: result.actionType === 'setValue' ? result.device : null,
            channelValues: result.actionType === 'setValue' ? result.channelValues : {},
            enabledControls: result.actionType === 'setValue' ? result.enabledControls : [],
            cssClassName: cssClassName
        });

        triggerLibrary.add(trigger);
    }

    async function openAutomaticTriggerDialog() {
        const result = await addAutomaticTriggerDialog.open(availableAnimations, devices);

        if (!result) return; // User cancelled

        // Create trigger for automatic (always) trigger
        const trigger = new Trigger({
            name: `always_${result.animation}`,
            triggerType: 'always',
            inputDeviceId: null,
            inputControlId: null,
            animationName: result.animation,
            targetDeviceIds: [result.device],
            duration: result.duration,
            easing: result.easing,
            iterations: result.looping ? 'infinite' : 1,
            cssClassName: 'always'
        });

        triggerLibrary.add(trigger);
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

            // Handle save
            trigger.targetDeviceIds = [result.device];
            trigger.animationName = result.animation;
            trigger.duration = result.duration;
            trigger.easing = result.easing;
            trigger.iterations = result.looping ? 'infinite' : 1;
            trigger.name = `always_${result.animation}`;

            triggerLibrary.update(trigger);
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

            // Update the trigger's input references
            trigger.inputDeviceId = newInputDeviceId;
            trigger.inputControlId = newInputControlId;

            // Get button mode from the input
            const buttonMode = selectedInput.buttonMode || 'momentary';

            // Generate new CSS class name
            const baseClassName = toCSSIdentifier(selectedInput.name);

            // Determine suffix based on button mode
            let suffix;
            if (buttonMode === 'toggle') {
                suffix = result.triggerType === 'pressed' ? 'on' : 'off';
            } else {
                suffix = result.triggerType === 'pressed' ? 'down' : 'up';
            }
            const cssClassName = `${baseClassName}-${suffix}`;

            trigger.triggerType = result.triggerType;
            trigger.actionType = result.actionType;

            if (result.actionType === 'animation') {
                trigger.animationName = result.animation;
                trigger.targetDeviceIds = [result.device];
                trigger.setValueDeviceId = null;
                trigger.channelValues = {};
                trigger.enabledControls = [];
                trigger.name = `${selectedInput.name}_${result.triggerType}_${result.animation}`;
            } else {
                trigger.setValueDeviceId = result.device;
                trigger.channelValues = result.channelValues;
                trigger.enabledControls = result.enabledControls;
                trigger.animationName = null;
                trigger.targetDeviceIds = [];
                trigger.name = `${selectedInput.name}_${result.triggerType}_setValue`;
            }

            trigger.duration = result.duration;
            trigger.easing = result.easing;
            trigger.iterations = result.looping ? 'infinite' : 1;
            trigger.cssClassName = cssClassName;

            triggerLibrary.update(trigger);
        }
    }

    function getInputName(inputDeviceId, inputControlId) {
        const input = availableInputs.find(
            i => i.inputDeviceId === inputDeviceId && i.inputControlId === inputControlId
        );
        return input?.name || `${inputDeviceId}_${inputControlId}`;
    }

    function getDeviceName(deviceId) {
        const device = devices.find(d => d.id === deviceId);
        return device?.name || deviceId;
    }

    function getAnimationDisplayName(cssName) {
        const animation = availableAnimations.find(a => a.cssName === cssName);
        return animation?.name || cssName;
    }

    function getTriggerDisplayText(trigger) {
        const actionType = trigger.actionType || 'animation';

        if (trigger.triggerType === 'always') {
            const deviceName = getDeviceName(trigger.targetDeviceIds[0]);
            const animationName = getAnimationDisplayName(trigger.animationName);
            return `Always → ${animationName} → ${deviceName}`;
        }

        const inputName = getInputName(trigger.inputDeviceId, trigger.inputControlId);
        const typeLabel = trigger.triggerType === 'pressed' ? 'Pressed' : 'Not Pressed';

        if (actionType === 'animation') {
            const deviceName = getDeviceName(trigger.targetDeviceIds[0]);
            const animationName = getAnimationDisplayName(trigger.animationName);
            return `${inputName} → ${typeLabel} → ${animationName} → ${deviceName}`;
        } else {
            const deviceName = getDeviceName(trigger.setValueDeviceId);
            const channelCount = Object.keys(trigger.channelValues || {}).length;
            return `${inputName} → ${typeLabel} → Set ${channelCount} channel(s) → ${deviceName}`;
        }
    }

    // Get input preview color
    function getInputPreview(trigger) {
        const input = availableInputs.find(
            i => i.inputDeviceId === trigger.inputDeviceId &&
                 i.inputControlId === trigger.inputControlId
        );
        return input?.color ? paletteColorToHex(input.color) : '#888';
    }

    // Get input type label (On/Off/Up/Down)
    function getInputTypeLabel(trigger) {
        const input = availableInputs.find(
            i => i.inputDeviceId === trigger.inputDeviceId &&
                 i.inputControlId === trigger.inputControlId
        );

        if (!input) return trigger.triggerType === 'pressed' ? 'Down' : 'Up';

        // Check if it's toggle mode
        if (input.buttonMode === 'toggle') {
            return trigger.triggerType === 'pressed' ? 'On' : 'Off';
        } else {
            return trigger.triggerType === 'pressed' ? 'Down' : 'Up';
        }
    }

    // Get animation preview (stepped gradient)
    function getAnimationPreview(animationCssName) {
        const animation = availableAnimations.find(a => a.cssName === animationCssName);
        if (!animation) return '#888';

        // Check if animation has color-related controls
        const hasColor = animation.controls && (
            animation.controls.includes('Color') ||
            animation.controls.includes('Amber') ||
            animation.controls.includes('White')
        );

        if (!hasColor || !animation.keyframes || animation.keyframes.length === 0) {
            return '#888';
        }

        // Get control and component data for the animation
        const { controls, components } = Animation.getControlsForRendering(animation);

        // Extract colors from each keyframe
        const colors = animation.keyframes.map(keyframe => {
            const values = keyframe.values || [];

            // Find Color control
            const colorControl = controls.find(c => c.name === 'Color' && c.type === 'rgb');
            let r = 0, g = 0, b = 0;

            if (colorControl) {
                const rIdx = colorControl.components.r;
                const gIdx = colorControl.components.g;
                const bIdx = colorControl.components.b;
                r = values[rIdx] || 0;
                g = values[gIdx] || 0;
                b = values[bIdx] || 0;
            }

            // Add Amber if present
            const amberControl = controls.find(c => c.name === 'Amber' && c.type === 'slider');
            if (amberControl) {
                const amberIdx = amberControl.components.value;
                const amber = values[amberIdx] || 0;
                r = Math.min(255, r + (255 * amber / 255));
                g = Math.min(255, g + (191 * amber / 255));
            }

            // Add White if present
            const whiteControl = controls.find(c => c.name === 'White' && c.type === 'slider');
            if (whiteControl) {
                const whiteIdx = whiteControl.components.value;
                const white = values[whiteIdx] || 0;
                r = Math.min(255, r + white);
                g = Math.min(255, g + white);
                b = Math.min(255, b + white);
            }

            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        });

        // Create stepped gradient with equal steps
        const numSteps = colors.length;
        const stepSize = 100 / numSteps;

        const gradientStops = colors.map((color, index) => {
            const start = index * stepSize;
            const end = (index + 1) * stepSize;
            return `${color} ${start}% ${end}%`;
        }).join(', ');

        return `linear-gradient(90deg, ${gradientStops})`;
    }

    // Get preview for value-based trigger
    function getValuePreview(trigger) {
        const device = devices.find(d => d.id === trigger.setValueDeviceId);
        if (!device) return '#888';

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return '#888';

        // Build values array from channelValues
        const values = new Array(deviceType.channels).fill(0);
        for (const [channelIndex, value] of Object.entries(trigger.channelValues || {})) {
            values[parseInt(channelIndex)] = value;
        }

        return getDeviceColor(device.type, values);
    }

    // Get all special controls being set by a setValue trigger
    function getSpecialControls(trigger) {
        if (trigger.actionType !== 'setValue') return null;

        const device = devices.find(d => d.id === trigger.setValueDeviceId);
        if (!device) return null;

        // Check which channels are being set
        const channelIndices = Object.keys(trigger.channelValues || {}).map(k => parseInt(k));
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

    // Get the value for a specific control in a setValue trigger
    function getControlValue(trigger, controlName) {
        const device = devices.find(d => d.id === trigger.setValueDeviceId);
        if (!device) return 0;

        const deviceType = DEVICE_TYPES[device.type];
        if (!deviceType) return 0;

        // Find the channel index for this control
        const channelIndex = deviceType.components.findIndex(c => c.name === controlName);
        if (channelIndex === -1) return 0;

        return trigger.channelValues?.[channelIndex] || 0;
    }

    // Get device ID from trigger (works for both animation and setValue actions)
    function getTriggerDeviceId(trigger) {
        if (trigger.actionType === 'animation') {
            return trigger.targetDeviceIds?.[0];
        } else {
            return trigger.setValueDeviceId;
        }
    }

    // Get device preview based on default values
    function getDevicePreview(trigger) {
        const deviceId = getTriggerDeviceId(trigger);
        const device = devices.find(d => d.id === deviceId);
        if (!device) return '#888';

        return getDeviceColor(device.type, device.defaultValues);
    }

    // Get device controls and data for preview based on device type
    function getDevicePreviewControls(trigger) {
        const deviceId = getTriggerDeviceId(trigger);
        const device = devices.find(d => d.id === deviceId);
        if (!device) {
            return { controls: [], data: {} };
        }

        return getDevicePreviewData(device.type, device.defaultValues);
    }

    // Get device name from trigger
    function getTriggerDeviceName(trigger) {
        const deviceId = getTriggerDeviceId(trigger);
        return getDeviceName(deviceId);
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
            disabled={availableInputs.length === 0 || availableAnimations.length === 0 || devices.length === 0}
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
        {#if availableInputs.length === 0 || availableAnimations.length === 0 || devices.length === 0}
            <div class="empty-state">
                {#if availableInputs.length === 0}
                    <p>No inputs available. Go to the Inputs tab to detect and save inputs first.</p>
                {/if}
                {#if availableAnimations.length === 0}
                    <p>No animations available. Go to the Animations tab to create animations first.</p>
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
            {#each triggers as trigger (`${trigger.id}-${trigger.version}`)}
                <DraggableCard {dnd} item={trigger} class="trigger-card">
                    <!-- Column 1: Input -->
                    <div class="trigger-column trigger-input-column">
                        {#if trigger.triggerType === 'always'}
                            <div class="trigger-text">Always</div>
                        {:else}
                            <Preview
                                type="input"
                                size="medium"
                                data={{ color: getInputPreview(trigger) }}
                                class="trigger-preview"
                            />
                            <div class="trigger-text">
                                {getInputName(trigger.inputDeviceId, trigger.inputControlId)} → {getInputTypeLabel(trigger)}
                            </div>
                        {/if}
                    </div>

                    <!-- Column 2: Device -->
                    <div class="trigger-column trigger-device-column">
                        {#if true}
                            {@const devicePreview = getDevicePreviewControls(trigger)}
                            <Preview
                                type="device"
                                size="medium"
                                controls={devicePreview.controls}
                                data={devicePreview.data}
                                class="trigger-preview"
                            />
                            <div class="trigger-text">
                                {getTriggerDeviceName(trigger)}
                            </div>
                        {/if}
                    </div>

                    <!-- Column 3: Action -->
                    <div class="trigger-column trigger-action-column">
                        {#if trigger.actionType === 'animation'}
                            <Preview
                                type="animation"
                                size="medium"
                                data={{ color: getAnimationPreview(trigger.animationName) }}
                                class="trigger-preview"
                            />
                            <div class="trigger-text">
                                {getAnimationDisplayName(trigger.animationName)}
                            </div>
                        {:else}
                            {@const specialControls = getSpecialControls(trigger)}
                            {#if specialControls}
                                <Preview
                                    type="device"
                                    size="medium"
                                    controls={specialControls}
                                    data={{
                                        fuel: getControlValue(trigger, 'Fuel'),
                                        safety: getControlValue(trigger, 'Safety'),
                                        output: getControlValue(trigger, 'Output')
                                    }}
                                    class="trigger-preview"
                                />
                            {:else}
                                <Preview
                                    type="device"
                                    size="medium"
                                    controls={['color']}
                                    data={{ color: getValuePreview(trigger) }}
                                    class="trigger-preview"
                                />
                            {/if}
                            <div class="trigger-text">
                                {Object.keys(trigger.channelValues || {}).length} values
                            </div>
                        {/if}
                    </div>

                    <IconButton
                        icon={editIcon}
                        onclick={() => openEditDialog(trigger)}
                        title="Edit trigger"
                        size="small"
                    />
                </DraggableCard>
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

    :global(.trigger-card) {
        width: 80vw;
        display: flex;
        align-items: center;
        gap: 20px;
    }

    :global(.trigger-card) .trigger-column {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    :global(.trigger-card) .trigger-input-column {
        min-width: 200px;
    }

    :global(.trigger-card) .trigger-device-column {
        min-width: 150px;
    }

    :global(.trigger-card) .trigger-action-column {
        min-width: 200px;
    }

    :global(.trigger-card) .trigger-preview {
        flex-shrink: 0;
    }

    :global(.trigger-card) .trigger-text {
        font-size: 10pt;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
