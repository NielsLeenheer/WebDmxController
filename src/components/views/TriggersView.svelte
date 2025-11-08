<script>
    import { onMount, onDestroy } from 'svelte';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';

    let {
        inputController,
        mappingLibrary
    } = $props();

    // Icons
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    const keyboardIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>';
    const midiIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';

    let isListening = $state(false);
    let detectedTriggers = $state([]);
    let configureDialog = $state(null);
    let configuringTrigger = $state(null);
    let triggerName = $state('');
    let savedMappings = $state([]);

    // Event handlers
    let inputEventHandlers = [];

    function startListening() {
        isListening = true;
        detectedTriggers = [];

        // Listen for raw input events
        const triggerHandler = ({ mapping, velocity }) => {
            if (!isListening) return;
            // Ignore if this is a mapped trigger
        };

        const rawInputHandler = (event) => {
            if (!isListening) return;

            const { deviceId, controlId, type, device } = event;

            // Check if this trigger already exists in detected list
            const existing = detectedTriggers.find(
                t => t.deviceId === deviceId && t.controlId === controlId
            );

            if (!existing) {
                const trigger = {
                    id: `${deviceId}-${controlId}`,
                    deviceId,
                    controlId,
                    deviceName: device?.name || deviceId,
                    deviceType: device?.type || 'unknown',
                    type,
                    timestamp: Date.now()
                };

                detectedTriggers = [...detectedTriggers, trigger];
            }
        };

        // Listen to input controller for raw inputs
        const devices = inputController.getInputDevices();
        for (const device of devices) {
            const handler = (eventData) => {
                rawInputHandler({
                    deviceId: device.id,
                    controlId: eventData.controlId,
                    type: eventData.velocity !== undefined ? 'trigger' : 'change',
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

    function handleDeviceAdded(device) {
        if (!isListening) return;

        const handler = (eventData) => {
            const rawInputHandler = (event) => {
                if (!isListening) return;

                const { deviceId, controlId, type, device } = event;

                const existing = detectedTriggers.find(
                    t => t.deviceId === deviceId && t.controlId === controlId
                );

                if (!existing) {
                    const trigger = {
                        id: `${deviceId}-${controlId}`,
                        deviceId,
                        controlId,
                        deviceName: device?.name || deviceId,
                        deviceType: device?.type || 'unknown',
                        type,
                        timestamp: Date.now()
                    };

                    detectedTriggers = [...detectedTriggers, trigger];
                }
            };

            rawInputHandler({
                deviceId: device.id,
                controlId: eventData.controlId,
                type: eventData.velocity !== undefined ? 'trigger' : 'change',
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

    function configureTrigger(trigger) {
        configuringTrigger = trigger;
        triggerName = formatTriggerName(trigger);
        configureDialog?.showModal();
    }

    function formatTriggerName(trigger) {
        const devicePart = trigger.deviceName.replace(/\s+/g, '_');
        const controlPart = trigger.controlId.replace(/[^a-zA-Z0-9]/g, '_');
        return `${devicePart}_${controlPart}`;
    }

    function saveTrigger() {
        if (!configuringTrigger || !triggerName.trim()) return;

        // Create a new mapping
        const mapping = {
            name: triggerName.trim(),
            mode: 'trigger',
            inputDeviceId: configuringTrigger.deviceId,
            inputControlId: configuringTrigger.controlId,
            animationName: null,
            duration: 1000,
            easing: 'linear',
            iterations: 1,
            targetDeviceIds: []
        };

        mappingLibrary.add(mapping);
        refreshMappings();

        // Remove from detected triggers
        detectedTriggers = detectedTriggers.filter(t => t.id !== configuringTrigger.id);

        configureDialog?.close();
        configuringTrigger = null;
        triggerName = '';
    }

    function removeTrigger(trigger) {
        detectedTriggers = detectedTriggers.filter(t => t.id !== trigger.id);
    }

    function deleteMapping(mappingId) {
        mappingLibrary.remove(mappingId);
        refreshMappings();
    }

    function refreshMappings() {
        savedMappings = mappingLibrary.getAll();
    }

    function getTriggerIcon(deviceType) {
        switch (deviceType) {
            case 'keyboard':
                return keyboardIcon;
            case 'midi':
                return midiIcon;
            default:
                return midiIcon;
        }
    }

    onMount(() => {
        refreshMappings();
    });

    onDestroy(() => {
        stopListening();
    });
</script>

<div class="triggers-view">
    <div class="left-panel">
        <div class="panel-header">
            <h3>Listen for Inputs</h3>
        </div>

        <div class="listen-section">
            <p class="instructions">
                Press any MIDI button, keyboard key, or move any MIDI control to detect it.
            </p>

            {#if isListening}
                <Button onclick={stopListening} primary>
                    Stop Listening
                </Button>
            {:else}
                <Button onclick={startListening} primary>
                    Start Listening
                </Button>
            {/if}

            {#if isListening}
                <div class="listening-indicator">
                    <div class="pulse-dot"></div>
                    Listening for inputs...
                </div>
            {/if}
        </div>

        {#if detectedTriggers.length > 0}
            <div class="detected-triggers">
                <h4>Detected Triggers</h4>
                <div class="trigger-list">
                    {#each detectedTriggers as trigger (trigger.id)}
                        <div class="trigger-item">
                            <div class="trigger-icon">
                                {@html getTriggerIcon(trigger.deviceType)}
                            </div>
                            <div class="trigger-info">
                                <div class="trigger-device">{trigger.deviceName}</div>
                                <div class="trigger-control">{trigger.controlId}</div>
                            </div>
                            <div class="trigger-actions">
                                <Button onclick={() => configureTrigger(trigger)} size="small">
                                    Configure
                                </Button>
                                <IconButton
                                    icon={trashIcon}
                                    onclick={() => removeTrigger(trigger)}
                                    size="small"
                                    title="Remove"
                                />
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <div class="right-panel">
        <div class="panel-header">
            <h3>Saved Triggers</h3>
        </div>

        <div class="mappings-list">
            {#if savedMappings.length === 0}
                <p class="empty-state">No triggers configured yet. Start listening to detect inputs!</p>
            {:else}
                {#each savedMappings as mapping (mapping.id)}
                    <div class="mapping-item">
                        <div class="mapping-icon">
                            {@html getTriggerIcon(
                                inputController.getInputDevice(mapping.inputDeviceId)?.type || 'unknown'
                            )}
                        </div>
                        <div class="mapping-info">
                            <div class="mapping-name">{mapping.name}</div>
                            <div class="mapping-details">
                                {#if inputController.getInputDevice(mapping.inputDeviceId)}
                                    {inputController.getInputDevice(mapping.inputDeviceId).name}
                                {:else}
                                    {mapping.inputDeviceId}
                                {/if}
                                &rarr; {mapping.inputControlId}
                            </div>
                            {#if mapping.animationName}
                                <div class="mapping-animation">Animation: {mapping.animationName}</div>
                            {:else}
                                <div class="mapping-warning">No animation assigned</div>
                            {/if}
                        </div>
                        <div class="mapping-actions">
                            <IconButton
                                icon={trashIcon}
                                onclick={() => deleteMapping(mapping.id)}
                                title="Delete trigger"
                            />
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<!-- Configure Trigger Dialog -->
<Dialog bind:dialogRef={configureDialog}>
    <form method="dialog" onsubmit={(e) => { e.preventDefault(); saveTrigger(); }}>
        <h3>Configure Trigger</h3>

        {#if configuringTrigger}
            <div class="dialog-info">
                <p><strong>Device:</strong> {configuringTrigger.deviceName}</p>
                <p><strong>Control:</strong> {configuringTrigger.controlId}</p>
            </div>
        {/if}

        <div class="dialog-field">
            <label for="trigger-name">Trigger Name:</label>
            <input
                id="trigger-name"
                type="text"
                bind:value={triggerName}
                placeholder="e.g., play_button"
                autofocus
            />
        </div>

        <div class="dialog-buttons">
            <Button type="button" onclick={() => configureDialog?.close()}>Cancel</Button>
            <Button type="submit" primary>Save Trigger</Button>
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
        width: 400px;
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
    }

    .panel-header h3 {
        margin: 0;
        font-size: 12pt;
    }

    .listen-section {
        padding: 20px;
        border-bottom: 1px solid #ddd;
    }

    .instructions {
        margin: 0 0 15px 0;
        font-size: 10pt;
        color: #666;
        line-height: 1.5;
    }

    .listening-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
        padding: 12px;
        background: #e3f2fd;
        border-radius: 4px;
        color: #1976d2;
        font-weight: 500;
        font-size: 10pt;
    }

    .pulse-dot {
        width: 12px;
        height: 12px;
        background: #2196f3;
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(0.8);
        }
    }

    .detected-triggers {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .detected-triggers h4 {
        margin: 0 0 10px 0;
        font-size: 11pt;
        color: #333;
    }

    .trigger-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .trigger-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(-10px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    .trigger-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e3f2fd;
        border-radius: 4px;
        color: #2196f3;
    }

    .trigger-icon :global(svg) {
        width: 20px;
        height: 20px;
    }

    .trigger-info {
        flex: 1;
    }

    .trigger-device {
        font-weight: 600;
        font-size: 10pt;
        margin-bottom: 2px;
    }

    .trigger-control {
        font-size: 9pt;
        color: #666;
        font-family: var(--font-stack-mono);
    }

    .trigger-actions {
        display: flex;
        gap: 8px;
    }

    .mappings-list {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .mapping-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .mapping-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e8f5e9;
        border-radius: 4px;
        color: #4caf50;
    }

    .mapping-icon :global(svg) {
        width: 20px;
        height: 20px;
    }

    .mapping-info {
        flex: 1;
    }

    .mapping-name {
        font-weight: 600;
        font-size: 10pt;
        margin-bottom: 4px;
    }

    .mapping-details {
        font-size: 9pt;
        color: #666;
        margin-bottom: 4px;
    }

    .mapping-animation {
        font-size: 9pt;
        color: #4caf50;
    }

    .mapping-warning {
        font-size: 9pt;
        color: #ff9800;
    }

    .mapping-actions {
        display: flex;
        gap: 8px;
    }

    .empty-state {
        text-align: center;
        color: #999;
        font-size: 10pt;
        padding: 40px 20px;
    }

    .dialog-info {
        margin-bottom: 20px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 10pt;
    }

    .dialog-info p {
        margin: 4px 0;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }

    .dialog-field input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 10pt;
    }

    .dialog-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
</style>
