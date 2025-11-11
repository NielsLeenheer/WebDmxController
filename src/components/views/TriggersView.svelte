<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';
    import settingsIcon from '../../assets/icons/settings.svg?raw';

    let {
        mappingLibrary,
        animationLibrary,
        devices = []
    } = $props();

    let availableInputs = $state([]);
    let availableAnimations = $state([]);
    let triggers = $state([]);

    let newTriggerDialog = $state(null);
    let newTriggerInput = $state(null);
    let newTriggerType = $state('pressed');
    let newTriggerDevice = $state(null);
    let newTriggerAnimation = $state(null);
    let newTriggerDuration = $state(1000);
    let newTriggerLooping = $state(false);
    let newTriggerEasing = $state('linear');

    // Edit dialog states
    let editDialog = $state(null);
    let editingTrigger = $state(null);
    let editTriggerInput = $state(null);
    let editTriggerType = $state('pressed');
    let editTriggerDevice = $state(null);
    let editTriggerAnimation = $state(null);
    let editTriggerDuration = $state(1000);
    let editTriggerLooping = $state(false);
    let editTriggerEasing = $state('linear');

    const TRIGGER_TYPES = [
        { value: 'pressed', label: 'Pressed', description: 'Trigger when key/button is pressed down' },
        { value: 'not-pressed', label: 'Not Pressed', description: 'Active when key/button is NOT pressed' },
        { value: 'always', label: 'Always', description: 'Infinite loop animation' }
    ];

    const EASING_FUNCTIONS = [
        'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
        'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
        'cubic-bezier(0.68, -0.55, 0.265, 1.55)' // Back easing
    ];

    function refreshData() {
        availableInputs = mappingLibrary.getAll().filter(m => m.mode === 'input');
        availableAnimations = animationLibrary.getAll();
        triggers = mappingLibrary.getAll().filter(m => m.mode === 'trigger');
    }

    function handleMappingChange() {
        refreshData();
    }

    function openNewTriggerDialog() {
        newTriggerInput = availableInputs[0]?.id || null;
        newTriggerType = 'pressed';
        newTriggerDevice = devices[0]?.id || null;
        newTriggerAnimation = availableAnimations[0]?.name || null;
        newTriggerDuration = 1000;
        newTriggerLooping = false;
        newTriggerEasing = 'linear';
        newTriggerDialog?.showModal();
    }

    function createTrigger() {
        if (!newTriggerInput || !newTriggerDevice || !newTriggerAnimation) return;

        const inputMapping = mappingLibrary.get(newTriggerInput);
        if (!inputMapping) return;

        // Generate CSS class name from input name with state suffix
        const baseClassName = inputMapping.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        const suffix = newTriggerType === 'pressed' ? 'down' :
                       newTriggerType === 'not-pressed' ? 'up' : 'always';
        const cssClassName = `${baseClassName}-${suffix}`;

        // Create trigger mapping
        const trigger = new InputMapping({
            name: `${inputMapping.name}_${newTriggerType}_${newTriggerAnimation}`,
            mode: 'trigger',
            triggerType: newTriggerType,
            inputDeviceId: inputMapping.inputDeviceId,
            inputControlId: inputMapping.inputControlId,
            animationName: newTriggerAnimation,
            targetDeviceIds: [newTriggerDevice],
            duration: newTriggerDuration,
            easing: newTriggerEasing,
            iterations: newTriggerLooping ? 'infinite' : 1,
            cssClassName: cssClassName
        });

        mappingLibrary.add(trigger);
        refreshData();
        newTriggerDialog?.close();
    }

    function openEditDialog(trigger) {
        editingTrigger = trigger;
        editTriggerInput = trigger.inputDeviceId + '_' + trigger.inputControlId;
        editTriggerType = trigger.triggerType;
        editTriggerDevice = trigger.targetDeviceIds[0];
        editTriggerAnimation = trigger.animationName;
        editTriggerDuration = trigger.duration;
        editTriggerLooping = trigger.iterations === 'infinite';
        editTriggerEasing = trigger.easing;

        requestAnimationFrame(() => {
            editDialog?.showModal();
        });
    }

    function closeEditDialog() {
        editDialog?.close();
        editingTrigger = null;
    }

    function saveEdit() {
        if (!editingTrigger) return;

        // Get the input mapping from the selected input
        const selectedInput = availableInputs.find(input =>
            input.inputDeviceId === editingTrigger.inputDeviceId &&
            input.inputControlId === editingTrigger.inputControlId
        );

        if (!selectedInput) return;

        // Generate new CSS class name
        const baseClassName = selectedInput.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const suffix = editTriggerType === 'pressed' ? 'down' :
                       editTriggerType === 'not-pressed' ? 'up' : 'always';
        const cssClassName = `${baseClassName}-${suffix}`;

        // Update trigger properties
        editingTrigger.triggerType = editTriggerType;
        editingTrigger.targetDeviceIds = [editTriggerDevice];
        editingTrigger.animationName = editTriggerAnimation;
        editingTrigger.duration = editTriggerDuration;
        editingTrigger.easing = editTriggerEasing;
        editingTrigger.iterations = editTriggerLooping ? 'infinite' : 1;
        editingTrigger.cssClassName = cssClassName;
        editingTrigger.name = `${selectedInput.name}_${editTriggerType}_${editTriggerAnimation}`;

        mappingLibrary.save();
        refreshData();
        closeEditDialog();
    }

    function confirmDeleteTrigger() {
        if (!editingTrigger) return;

        if (confirm(`Are you sure you want to delete this trigger?`)) {
            mappingLibrary.remove(editingTrigger.id);
            refreshData();
            closeEditDialog();
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

    function getTriggerTypeLabel(type) {
        const typeInfo = TRIGGER_TYPES.find(t => t.value === type);
        return typeInfo?.label || type;
    }

    function getTriggerClassName(trigger) {
        return trigger.cssClassName;
    }

    onMount(() => {
        refreshData();
        mappingLibrary.on('changed', handleMappingChange);
    });

    onDestroy(() => {
        mappingLibrary.off('changed', handleMappingChange);
    });
</script>

<div class="triggers-view">
    <div class="add-trigger-section">
        <Button
            onclick={openNewTriggerDialog}
            variant="secondary"
            disabled={availableInputs.length === 0 || availableAnimations.length === 0 || devices.length === 0}
        >
            Add Trigger
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
            {#each triggers as trigger (trigger.id)}
                <div class="trigger-card">
                    <div class="trigger-header">
                        <h3>{trigger.name}</h3>
                        <IconButton
                            icon={settingsIcon}
                            onclick={() => openEditDialog(trigger)}
                            title="Edit trigger"
                            size="small"
                        />
                    </div>
                    <div class="trigger-details">
                        <div class="detail-row">
                            <span class="label">Input:</span>
                            <span class="value">{getInputName(trigger.inputDeviceId, trigger.inputControlId)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Type:</span>
                            <span class="value type-{trigger.triggerType}">{getTriggerTypeLabel(trigger.triggerType)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Device:</span>
                            <span class="value">{trigger.targetDeviceIds.map(id => getDeviceName(id)).join(', ')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Animation:</span>
                            <span class="value">{trigger.animationName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Duration:</span>
                            <span class="value">{trigger.duration}ms</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Loop:</span>
                            <span class="value">{trigger.iterations === 'infinite' ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">CSS Class:</span>
                            <span class="value css-class">.{getTriggerClassName(trigger)}</span>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- New Trigger Dialog -->
<Dialog bind:dialogRef={newTriggerDialog} title="Create New Trigger" onclose={() => newTriggerDialog?.close()}>
    <form method="dialog" onsubmit={(e) => { e.preventDefault(); createTrigger(); }}>
        <div class="dialog-input-group">
            <label for="trigger-input">Input:</label>
            <select id="trigger-input" bind:value={newTriggerInput}>
                {#each availableInputs as input}
                    <option value={input.id}>{input.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="trigger-type">Trigger Type:</label>
            <select id="trigger-type" bind:value={newTriggerType}>
                {#each TRIGGER_TYPES as type}
                    <option value={type.value}>{type.label} - {type.description}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="trigger-device">Device:</label>
            <select id="trigger-device" bind:value={newTriggerDevice}>
                {#each devices as device}
                    <option value={device.id}>{device.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="trigger-animation">Animation:</label>
            <select id="trigger-animation" bind:value={newTriggerAnimation}>
                {#each availableAnimations as animation}
                    <option value={animation.name}>{animation.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="trigger-duration">Duration (ms):</label>
            <input
                id="trigger-duration"
                type="number"
                bind:value={newTriggerDuration}
                min="100"
                step="100"
            />
        </div>

        <div class="dialog-input-group">
            <label for="trigger-easing">Easing:</label>
            <select id="trigger-easing" bind:value={newTriggerEasing}>
                {#each EASING_FUNCTIONS as easing}
                    <option value={easing}>{easing}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group checkbox-field">
            <label>
                <input
                    type="checkbox"
                    bind:checked={newTriggerLooping}
                />
                Loop animation infinitely
            </label>
        </div>

        <div class="dialog-buttons">
            <Button type="button" onclick={() => newTriggerDialog?.close()} variant="secondary">Cancel</Button>
            <Button type="submit" variant="primary">Create</Button>
        </div>
    </form>
</Dialog>

<!-- Edit Trigger Dialog -->
{#if editingTrigger}
<Dialog bind:dialogRef={editDialog} title="Trigger" onclose={closeEditDialog}>
    <form method="dialog" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
        <div class="dialog-input-group">
            <label for="edit-trigger-type">Trigger Type:</label>
            <select id="edit-trigger-type" bind:value={editTriggerType}>
                {#each TRIGGER_TYPES as type}
                    <option value={type.value}>{type.label} - {type.description}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="edit-trigger-device">Device:</label>
            <select id="edit-trigger-device" bind:value={editTriggerDevice}>
                {#each devices as device}
                    <option value={device.id}>{device.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="edit-trigger-animation">Animation:</label>
            <select id="edit-trigger-animation" bind:value={editTriggerAnimation}>
                {#each availableAnimations as animation}
                    <option value={animation.name}>{animation.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="edit-trigger-duration">Duration (ms):</label>
            <input
                id="edit-trigger-duration"
                type="number"
                bind:value={editTriggerDuration}
                min="100"
                step="100"
            />
        </div>

        <div class="dialog-input-group">
            <label for="edit-trigger-easing">Easing:</label>
            <select id="edit-trigger-easing" bind:value={editTriggerEasing}>
                {#each EASING_FUNCTIONS as easing}
                    <option value={easing}>{easing}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group checkbox-field">
            <label>
                <input
                    type="checkbox"
                    bind:checked={editTriggerLooping}
                />
                Loop animation infinitely
            </label>
        </div>

        <div class="dialog-buttons">
            <Button onclick={confirmDeleteTrigger} variant="secondary">
                {@html removeIcon}
                Delete
            </Button>
            <div class="dialog-buttons-right">
                <Button onclick={closeEditDialog} variant="secondary">Cancel</Button>
                <Button type="submit" variant="primary">Save</Button>
            </div>
        </div>
    </form>
</Dialog>
{/if}

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
    }

    .triggers-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 20px 20px;
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
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        color: #856404;
        max-width: 500px;
    }

    .trigger-card {
        width: 80vw;
        background: #f0f0f0;
        border-radius: 8px;
        overflow: hidden;
    }

    .trigger-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        background: #e6e6e6;
        gap: 15px;
    }

    .trigger-header h3 {
        margin: 0;
        font-size: 11pt;
        color: #333;
        flex: 1;
    }

    .trigger-details {
        padding: 15px 20px;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        font-size: 10pt;
        border-bottom: 1px solid #e0e0e0;
    }

    .detail-row:last-child {
        border-bottom: none;
    }

    .detail-row .label {
        color: #666;
        font-weight: 500;
    }

    .detail-row .value {
        color: #333;
        text-align: right;
    }

    .detail-row .value.type-pressed {
        color: #4caf50;
        font-weight: 600;
    }

    .detail-row .value.type-not-pressed {
        color: #ff9800;
        font-weight: 600;
    }

    .detail-row .value.type-always {
        color: #2196f3;
        font-weight: 600;
    }

    .detail-row .value.css-class {
        font-family: var(--font-stack-mono);
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
    }

    .dialog-input-group {
        margin-bottom: 20px;
    }

    .dialog-input-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 10pt;
        font-weight: 400;
        color: #555;
    }

    .dialog-input-group input,
    .dialog-input-group select {
        width: 100%;
        padding: 8px 12px;
        font-size: 11pt;
        font-family: var(--font-stack-mono);
        border: 2px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .dialog-input-group input:focus,
    .dialog-input-group select:focus {
        outline: none;
        border-color: #2196F3;
    }

    .checkbox-field label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-family: inherit;
    }

    .checkbox-field input[type="checkbox"] {
        width: auto;
        margin: 0;
        font-family: inherit;
    }

    .dialog-buttons {
        display: flex;
        gap: 10px;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
    }

    .dialog-buttons-right {
        display: flex;
        gap: 10px;
    }

    .dialog-buttons :global(svg) {
        width: 16px;
        height: 16px;
        margin-right: 6px;
    }
</style>
