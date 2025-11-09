<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';

    let {
        mappingLibrary,
        animationLibrary,
        devices = []
    } = $props();

    // Icons
    const plusIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

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
            iterations: newTriggerLooping ? 'infinite' : 1
        });

        mappingLibrary.add(trigger);
        refreshData();
        newTriggerDialog?.close();
    }

    function deleteTrigger(triggerId) {
        mappingLibrary.remove(triggerId);
        refreshData();
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
        // Generate CSS class name from input name
        // Get the input to access its name
        const input = availableInputs.find(
            i => i.inputDeviceId === trigger.inputDeviceId && i.inputControlId === trigger.inputControlId
        );

        // Convert name to lowercase, replace spaces and special chars with dashes
        const baseName = input?.name || `${trigger.inputDeviceId}_${trigger.inputControlId}`;
        const className = baseName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        return className;
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
    <div class="left-panel">
        <div class="panel-header">
            <h3>Create Trigger</h3>
            <IconButton
                icon={plusIcon}
                onclick={openNewTriggerDialog}
                title="Create new trigger"
                disabled={availableInputs.length === 0 || availableAnimations.length === 0 || devices.length === 0}
            />
        </div>

        <div class="info-section">
            {#if availableInputs.length === 0}
                <p class="warning">No inputs available. Go to the Inputs tab to detect and save inputs first.</p>
            {/if}
            {#if availableAnimations.length === 0}
                <p class="warning">No animations available. Go to the Animations tab to create animations first.</p>
            {/if}
            {#if devices.length === 0}
                <p class="warning">No devices available. Go to the Devices tab to add devices first.</p>
            {/if}

            {#if availableInputs.length > 0 && availableAnimations.length > 0 && devices.length > 0}
                <div class="trigger-types">
                    <h4>Trigger Types</h4>
                    {#each TRIGGER_TYPES as type}
                        <div class="type-info">
                            <strong>{type.label}:</strong>
                            <span>{type.description}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="right-panel">
        <div class="panel-header">
            <h3>Triggers</h3>
        </div>

        <div class="triggers-list">
            {#if triggers.length === 0}
                <p class="empty-state">No triggers created yet. Click the + button to create one!</p>
            {:else}
                {#each triggers as trigger (trigger.id)}
                    <div class="trigger-item">
                        <div class="trigger-header">
                            <div class="trigger-name">{trigger.name}</div>
                            <IconButton
                                icon={trashIcon}
                                onclick={() => deleteTrigger(trigger.id)}
                                title="Delete trigger"
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
</div>

<!-- New Trigger Dialog -->
<Dialog bind:dialogRef={newTriggerDialog}>
    <form method="dialog" onsubmit={(e) => { e.preventDefault(); createTrigger(); }}>
        <h3>Create New Trigger</h3>

        <div class="dialog-field">
            <label for="trigger-input">Input:</label>
            <select id="trigger-input" bind:value={newTriggerInput}>
                {#each availableInputs as input}
                    <option value={input.id}>{input.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-field">
            <label for="trigger-type">Trigger Type:</label>
            <select id="trigger-type" bind:value={newTriggerType}>
                {#each TRIGGER_TYPES as type}
                    <option value={type.value}>{type.label} - {type.description}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-field">
            <label for="trigger-device">Device:</label>
            <select id="trigger-device" bind:value={newTriggerDevice}>
                {#each devices as device}
                    <option value={device.id}>{device.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-field">
            <label for="trigger-animation">Animation:</label>
            <select id="trigger-animation" bind:value={newTriggerAnimation}>
                {#each availableAnimations as animation}
                    <option value={animation.name}>{animation.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-field">
            <label for="trigger-duration">Duration (ms):</label>
            <input
                id="trigger-duration"
                type="number"
                bind:value={newTriggerDuration}
                min="100"
                step="100"
            />
        </div>

        <div class="dialog-field">
            <label for="trigger-easing">Easing:</label>
            <select id="trigger-easing" bind:value={newTriggerEasing}>
                {#each EASING_FUNCTIONS as easing}
                    <option value={easing}>{easing}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-field checkbox-field">
            <label>
                <input
                    type="checkbox"
                    bind:checked={newTriggerLooping}
                />
                Loop animation infinitely
            </label>
        </div>

        <div class="dialog-buttons">
            <Button type="button" onclick={() => newTriggerDialog?.close()}>Cancel</Button>
            <Button type="submit" primary>Create Trigger</Button>
        </div>
    </form>
</Dialog>

<style>
    .triggers-view {
        display: flex;
        height: 100%;
        overflow: hidden;
    }

    .left-panel {
        width: 350px;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        background: #f9f9f9;
    }

    .right-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .panel-header {
        padding: 15px;
        border-bottom: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 12pt;
    }

    .info-section {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
    }

    .warning {
        padding: 12px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        color: #856404;
        font-size: 10pt;
        line-height: 1.5;
        margin-bottom: 15px;
    }

    .trigger-types {
        margin-top: 20px;
    }

    .trigger-types h4 {
        margin: 0 0 12px 0;
        font-size: 11pt;
    }

    .type-info {
        padding: 10px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
        font-size: 9pt;
        line-height: 1.5;
    }

    .type-info strong {
        display: block;
        margin-bottom: 4px;
        color: #333;
    }

    .type-info span {
        color: #666;
    }

    .triggers-list {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .trigger-item {
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 12px;
        overflow: hidden;
    }

    .trigger-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        background: white;
        border-bottom: 1px solid #ddd;
    }

    .trigger-name {
        font-weight: 600;
        font-size: 11pt;
    }

    .trigger-details {
        padding: 12px;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 9pt;
        border-bottom: 1px solid #eee;
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

    .empty-state {
        text-align: center;
        color: #999;
        font-size: 10pt;
        padding: 40px 20px;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        font-size: 10pt;
    }

    .dialog-field input,
    .dialog-field select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 10pt;
    }

    .checkbox-field label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }

    .checkbox-field input[type="checkbox"] {
        width: auto;
        margin: 0;
    }

    .dialog-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
</style>
