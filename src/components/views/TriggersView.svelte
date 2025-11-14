<script>
    import { onMount, onDestroy } from 'svelte';
    import { InputMapping } from '../../lib/mappings.js';
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Controls from '../controls/Controls.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';
    import editIcon from '../../assets/glyphs/edit.svg?raw';

    let {
        mappingLibrary,
        animationLibrary,
        devices = []
    } = $props();

    let availableInputs = $state([]);
    let availableAnimations = $state([]);
    let triggers = $state([]);

    let manualTriggerDialog = $state(null);
    let automaticTriggerDialog = $state(null);
    let newTriggerInput = $state(null);
    let newTriggerType = $state('pressed');
    let newTriggerActionType = $state('animation'); // 'animation' or 'setValue'
    let newTriggerDevice = $state(null);
    let newTriggerAnimation = $state(null);
    let newTriggerDuration = $state(1000);
    let newTriggerLooping = $state(false);
    let newTriggerEasing = $state('linear');
    let newTriggerChannelValues = $state({}); // For setValue actions
    let newTriggerEnabledControls = $state([]); // For setValue: which controls to set

    // Edit dialog states
    let editDialog = $state(null);
    let editingTrigger = $state(null);
    let editTriggerInput = $state(null);
    let editTriggerType = $state('pressed');
    let editTriggerActionType = $state('animation');
    let editTriggerDevice = $state(null);
    let editTriggerAnimation = $state(null);
    let editTriggerDuration = $state(1000);
    let editTriggerLooping = $state(false);
    let editTriggerEasing = $state('linear');
    let editTriggerChannelValues = $state({});
    let editTriggerEnabledControls = $state([]);

    // Get trigger type options based on the selected input's button mode
    function getTriggerTypeOptions(inputId) {
        const input = availableInputs.find(i => i.id === inputId);
        if (!input || !input.isButtonInput()) {
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

    // Get trigger type options for a trigger being edited
    function getTriggerTypeOptionsForTrigger(trigger) {
        const input = availableInputs.find(i =>
            i.inputDeviceId === trigger.inputDeviceId &&
            i.inputControlId === trigger.inputControlId
        );
        if (!input || !input.isButtonInput()) {
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

    const ACTION_TYPES = [
        { value: 'animation', label: 'Run Animation' },
        { value: 'setValue', label: 'Set values' }
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

    function openManualTriggerDialog() {
        newTriggerInput = availableInputs[0]?.id || null;
        newTriggerType = 'pressed';
        newTriggerActionType = 'animation';
        newTriggerDevice = devices[0]?.id || null;
        newTriggerAnimation = availableAnimations[0]?.name || null;
        newTriggerDuration = 1000;
        newTriggerLooping = false;
        newTriggerEasing = 'linear';
        newTriggerChannelValues = {};

        // Initialize enabled controls with all controls for setValue
        const device = devices.find(d => d.id === newTriggerDevice);
        if (device) {
            const deviceType = DEVICE_TYPES[device.type];
            newTriggerEnabledControls = deviceType.controls.map(c => c.name);
        } else {
            newTriggerEnabledControls = [];
        }

        manualTriggerDialog?.showModal();
    }

    function openAutomaticTriggerDialog() {
        newTriggerDevice = devices[0]?.id || null;
        newTriggerAnimation = availableAnimations[0]?.name || null;
        newTriggerDuration = 1000;
        newTriggerLooping = false;
        newTriggerEasing = 'linear';

        requestAnimationFrame(() => {
            automaticTriggerDialog?.showModal();
        });
    }

    function createManualTrigger() {
        if (!newTriggerInput || !newTriggerDevice) return;
        if (newTriggerActionType === 'animation' && !newTriggerAnimation) return;

        const inputMapping = mappingLibrary.get(newTriggerInput);
        if (!inputMapping) return;

        // Get button mode from the input mapping
        const buttonMode = inputMapping.buttonMode || 'momentary';

        // Generate CSS class name from input name with state suffix
        const baseClassName = inputMapping.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        // Determine suffix based on button mode
        let suffix;
        if (buttonMode === 'toggle') {
            suffix = newTriggerType === 'pressed' ? 'on' : 'off';
        } else {
            suffix = newTriggerType === 'pressed' ? 'down' : 'up';
        }
        const cssClassName = `${baseClassName}-${suffix}`;

        const triggerName = newTriggerActionType === 'animation'
            ? `${inputMapping.name}_${newTriggerType}_${newTriggerAnimation}`
            : `${inputMapping.name}_${newTriggerType}_setValue`;

        // Create trigger mapping
        const trigger = new InputMapping({
            name: triggerName,
            mode: 'trigger',
            triggerType: newTriggerType,
            actionType: newTriggerActionType,
            inputDeviceId: inputMapping.inputDeviceId,
            inputControlId: inputMapping.inputControlId,
            // Animation action properties
            animationName: newTriggerActionType === 'animation' ? newTriggerAnimation : null,
            targetDeviceIds: newTriggerActionType === 'animation' ? [newTriggerDevice] : [],
            duration: newTriggerDuration,
            easing: newTriggerEasing,
            iterations: newTriggerLooping ? 'infinite' : 1,
            // SetValue action properties
            setValueDeviceId: newTriggerActionType === 'setValue' ? newTriggerDevice : null,
            channelValues: newTriggerActionType === 'setValue' ? {...newTriggerChannelValues} : {},
            enabledControls: newTriggerActionType === 'setValue' ? [...newTriggerEnabledControls] : [],
            cssClassName: cssClassName
        });

        mappingLibrary.add(trigger);
        refreshData();
        manualTriggerDialog?.close();
    }

    function createAutomaticTrigger() {
        if (!newTriggerDevice || !newTriggerAnimation) return;

        // Create trigger mapping for automatic (always) trigger
        const trigger = new InputMapping({
            name: `always_${newTriggerAnimation}`,
            mode: 'trigger',
            triggerType: 'always',
            inputDeviceId: null,
            inputControlId: null,
            animationName: newTriggerAnimation,
            targetDeviceIds: [newTriggerDevice],
            duration: newTriggerDuration,
            easing: newTriggerEasing,
            iterations: newTriggerLooping ? 'infinite' : 1,
            cssClassName: 'always'
        });

        mappingLibrary.add(trigger);
        refreshData();
        automaticTriggerDialog?.close();
    }

    function openEditDialog(trigger) {
        editingTrigger = trigger;
        editTriggerInput = trigger.inputDeviceId + '_' + trigger.inputControlId;
        editTriggerType = trigger.triggerType;
        editTriggerActionType = trigger.actionType || 'animation';

        if (trigger.actionType === 'setValue') {
            editTriggerDevice = trigger.setValueDeviceId;
            editTriggerChannelValues = {...trigger.channelValues};
            editTriggerEnabledControls = trigger.enabledControls ? [...trigger.enabledControls] : [];

            // If enabledControls is empty, initialize with all controls
            if (editTriggerEnabledControls.length === 0 && editTriggerDevice) {
                const device = devices.find(d => d.id === editTriggerDevice);
                if (device) {
                    const deviceType = DEVICE_TYPES[device.type];
                    editTriggerEnabledControls = deviceType.controls.map(c => c.name);
                }
            }
        } else {
            editTriggerDevice = trigger.targetDeviceIds[0];
            editTriggerAnimation = trigger.animationName;
            editTriggerEnabledControls = [];
        }

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

        // Update trigger properties
        if (editingTrigger.triggerType === 'always') {
            // Automatic trigger
            editingTrigger.targetDeviceIds = [editTriggerDevice];
            editingTrigger.animationName = editTriggerAnimation;
            editingTrigger.duration = editTriggerDuration;
            editingTrigger.easing = editTriggerEasing;
            editingTrigger.iterations = editTriggerLooping ? 'infinite' : 1;
            editingTrigger.name = `always_${editTriggerAnimation}`;
        } else {
            // Manual trigger
            const selectedInput = availableInputs.find(input =>
                input.inputDeviceId === editingTrigger.inputDeviceId &&
                input.inputControlId === editingTrigger.inputControlId
            );

            if (!selectedInput) return;

            // Get button mode from the input mapping
            const buttonMode = selectedInput.buttonMode || 'momentary';

            // Generate new CSS class name
            const baseClassName = selectedInput.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            // Determine suffix based on button mode
            let suffix;
            if (buttonMode === 'toggle') {
                suffix = editTriggerType === 'pressed' ? 'on' : 'off';
            } else {
                suffix = editTriggerType === 'pressed' ? 'down' : 'up';
            }
            const cssClassName = `${baseClassName}-${suffix}`;

            editingTrigger.triggerType = editTriggerType;
            editingTrigger.actionType = editTriggerActionType;

            if (editTriggerActionType === 'animation') {
                editingTrigger.animationName = editTriggerAnimation;
                editingTrigger.targetDeviceIds = [editTriggerDevice];
                editingTrigger.setValueDeviceId = null;
                editingTrigger.channelValues = {};
                editingTrigger.enabledControls = [];
                editingTrigger.name = `${selectedInput.name}_${editTriggerType}_${editTriggerAnimation}`;
            } else {
                editingTrigger.setValueDeviceId = editTriggerDevice;
                editingTrigger.channelValues = {...editTriggerChannelValues};
                editingTrigger.enabledControls = [...editTriggerEnabledControls];
                editingTrigger.animationName = null;
                editingTrigger.targetDeviceIds = [];
                editingTrigger.name = `${selectedInput.name}_${editTriggerType}_setValue`;
            }

            editingTrigger.duration = editTriggerDuration;
            editingTrigger.easing = editTriggerEasing;
            editingTrigger.iterations = editTriggerLooping ? 'infinite' : 1;
            editingTrigger.cssClassName = cssClassName;
        }

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

    function setChannelValue(channelValues, channelIndex, value) {
        const newValues = {...channelValues};
        if (value === '' || value === null || value === undefined) {
            delete newValues[channelIndex];
        } else {
            newValues[channelIndex] = Math.max(0, Math.min(255, parseInt(value) || 0));
        }
        return newValues;
    }

    function getChannelValue(channelValues, channelIndex) {
        return channelValues[channelIndex] !== undefined ? channelValues[channelIndex] : '';
    }

    // Convert channelValues object to full values array for Controls
    function getValuesArrayForDevice(deviceId, channelValues) {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return [];

        const numChannels = DEVICE_TYPES[device.type].channels;
        const values = new Array(numChannels).fill(0);

        // Fill in values from channelValues object
        for (let i = 0; i < numChannels; i++) {
            if (channelValues[i] !== undefined) {
                values[i] = channelValues[i];
            }
        }

        return values;
    }

    // Handle device control changes for setValue triggers
    function handleSetValueChange(channelIndex, value) {
        newTriggerChannelValues = setChannelValue(newTriggerChannelValues, channelIndex, value);
    }

    function handleEditSetValueChange(channelIndex, value) {
        editTriggerChannelValues = setChannelValue(editTriggerChannelValues, channelIndex, value);
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
            {#each triggers as trigger (trigger.id)}
                <div class="trigger-card">
                    <div class="trigger-content">
                        <span class="trigger-text">{getTriggerDisplayText(trigger)}</span>
                        <IconButton
                            icon={editIcon}
                            onclick={() => openEditDialog(trigger)}
                            title="Edit trigger"
                            size="small"
                        />
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- Manual Trigger Dialog -->
<Dialog bind:dialogRef={manualTriggerDialog} title="Create Manual Trigger" onclose={() => manualTriggerDialog?.close()}>
    <form id="manual-trigger-form" method="dialog" onsubmit={(e) => { e.preventDefault(); createManualTrigger(); }}>
        <div class="trigger-columns">
            <!-- Column 1: Trigger Configuration -->
            <div class="trigger-column">
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
                        {#each getTriggerTypeOptions(newTriggerInput) as type}
                            <option value={type.value}>{type.label}</option>
                        {/each}
                    </select>
                </div>
            </div>

            <!-- Column 2: Device Configuration -->
            <div class="trigger-column">
                <div class="dialog-input-group">
                    <label for="trigger-action-type">Action:</label>
                    <select id="trigger-action-type" bind:value={newTriggerActionType}>
                        {#each ACTION_TYPES as type}
                            <option value={type.value}>{type.label}</option>
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
            </div>

            <!-- Column 3: Action Configuration -->
            <div class="trigger-column">
                {#if newTriggerActionType === 'animation'}
                    <div class="dialog-input-group">
                        <label for="trigger-animation">Animation:</label>
                        <select id="trigger-animation" bind:value={newTriggerAnimation}>
                            {#each availableAnimations as animation}
                                <option value={animation.cssName}>{animation.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="dialog-input-group">
                        <label for="trigger-duration">Duration (ms):</label>
                        <div class="duration-with-loop">
                            <input
                                id="trigger-duration"
                                type="number"
                                bind:value={newTriggerDuration}
                                min="100"
                                step="100"
                                disabled={!newTriggerAnimation}
                            />
                            <div class="checkbox-field">
                                <label>
                                    <input
                                        type="checkbox"
                                        bind:checked={newTriggerLooping}
                                        disabled={!newTriggerAnimation}
                                    />
                                    Loop
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="dialog-input-group">
                        <label for="trigger-easing">Easing:</label>
                        <select id="trigger-easing" bind:value={newTriggerEasing} disabled={!newTriggerAnimation}>
                            {#each EASING_FUNCTIONS as easing}
                                <option value={easing}>{easing}</option>
                            {/each}
                        </select>
                    </div>
                {:else if newTriggerActionType === 'setValue' && newTriggerDevice}
                    {@const selectedDevice = devices.find(d => d.id === newTriggerDevice)}
                    {#if selectedDevice}
                        <div class="dialog-input-group">
                            <label>Set Channel Values:</label>
                            <div class="controls-info">Select which controls to set when triggered:</div>
                            <Controls
                                controls={DEVICE_TYPES[selectedDevice.type].controls}
                                components={DEVICE_TYPES[selectedDevice.type].components}
                                values={getValuesArrayForDevice(newTriggerDevice, newTriggerChannelValues)}
                                onChange={handleSetValueChange}
                                showCheckboxes={true}
                                bind:enabledControls={newTriggerEnabledControls}
                            />
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </form>

    {#snippet buttons()}
        <Button type="button" onclick={() => manualTriggerDialog?.close()} variant="secondary">Cancel</Button>
        <Button type="submit" form="manual-trigger-form" variant="primary">Create</Button>
    {/snippet}
</Dialog>

<!-- Automatic Trigger Dialog -->
<Dialog bind:dialogRef={automaticTriggerDialog} title="Create Automatic Trigger" onclose={() => automaticTriggerDialog?.close()}>
    <form id="automatic-trigger-form" method="dialog" onsubmit={(e) => { e.preventDefault(); createAutomaticTrigger(); }}>
        <div class="trigger-columns">
            <!-- Column 1: Device Configuration -->
            <div class="trigger-column">
                <div class="dialog-input-group">
                    <label for="auto-trigger-device">Device:</label>
                    <select id="auto-trigger-device" bind:value={newTriggerDevice}>
                        {#each devices as device}
                            <option value={device.id}>{device.name}</option>
                        {/each}
                    </select>
                </div>
            </div>

            <!-- Column 2: Action Configuration -->
            <div class="trigger-column">
                <div class="dialog-input-group">
                    <label for="auto-trigger-animation">Animation:</label>
                    <select id="auto-trigger-animation" bind:value={newTriggerAnimation}>
                        {#each availableAnimations as animation}
                            <option value={animation.cssName}>{animation.name}</option>
                        {/each}
                    </select>
                </div>

                <div class="dialog-input-group">
                    <label for="auto-trigger-duration">Duration (ms):</label>
                    <div class="duration-with-loop">
                        <input
                            id="auto-trigger-duration"
                            type="number"
                            bind:value={newTriggerDuration}
                            min="100"
                            step="100"
                            disabled={!newTriggerAnimation}
                        />
                        <div class="checkbox-field">
                            <label>
                                <input
                                    type="checkbox"
                                    bind:checked={newTriggerLooping}
                                    disabled={!newTriggerAnimation}
                                />
                                Loop
                            </label>
                        </div>
                    </div>
                </div>

                <div class="dialog-input-group">
                    <label for="auto-trigger-easing">Easing:</label>
                    <select id="auto-trigger-easing" bind:value={newTriggerEasing} disabled={!newTriggerAnimation}>
                        {#each EASING_FUNCTIONS as easing}
                            <option value={easing}>{easing}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
    </form>

    {#snippet buttons()}
        <Button type="button" onclick={() => automaticTriggerDialog?.close()} variant="secondary">Cancel</Button>
        <Button type="submit" form="automatic-trigger-form" variant="primary">Create</Button>
    {/snippet}
</Dialog>

<!-- Edit Trigger Dialog -->
{#if editingTrigger}
<Dialog bind:dialogRef={editDialog} title="Trigger" onclose={closeEditDialog}>
    <form id="edit-trigger-form" method="dialog" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
        <div class="trigger-columns">
            {#if editingTrigger.triggerType !== 'always'}
                <!-- Column 1: Trigger Configuration (Manual only) -->
                <div class="trigger-column">
                    <div class="dialog-input-group">
                        <label for="edit-trigger-type">Trigger Type:</label>
                        <select id="edit-trigger-type" bind:value={editTriggerType}>
                            {#each getTriggerTypeOptionsForTrigger(editingTrigger) as type}
                                <option value={type.value}>{type.label}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <!-- Column 2: Device Configuration (Manual) -->
                <div class="trigger-column">
                    <div class="dialog-input-group">
                        <label for="edit-trigger-action-type">Action:</label>
                        <select id="edit-trigger-action-type" bind:value={editTriggerActionType}>
                            {#each ACTION_TYPES as type}
                                <option value={type.value}>{type.label}</option>
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
                </div>

                <!-- Column 3: Action Configuration (Manual) -->
                <div class="trigger-column">
                    {#if editTriggerActionType === 'animation'}
                        <div class="dialog-input-group">
                            <label for="edit-trigger-animation">Animation:</label>
                            <select id="edit-trigger-animation" bind:value={editTriggerAnimation}>
                                {#each availableAnimations as animation}
                                    <option value={animation.cssName}>{animation.name}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="dialog-input-group">
                            <label for="edit-trigger-duration">Duration (ms):</label>
                            <div class="duration-with-loop">
                                <input
                                    id="edit-trigger-duration"
                                    type="number"
                                    bind:value={editTriggerDuration}
                                    min="100"
                                    step="100"
                                    disabled={!editTriggerAnimation}
                                />
                                <div class="checkbox-field">
                                    <label>
                                        <input
                                            type="checkbox"
                                            bind:checked={editTriggerLooping}
                                            disabled={!editTriggerAnimation}
                                        />
                                        Loop
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="dialog-input-group">
                            <label for="edit-trigger-easing">Easing:</label>
                            <select id="edit-trigger-easing" bind:value={editTriggerEasing} disabled={!editTriggerAnimation}>
                                {#each EASING_FUNCTIONS as easing}
                                    <option value={easing}>{easing}</option>
                                {/each}
                            </select>
                        </div>
                    {:else if editTriggerActionType === 'setValue' && editTriggerDevice}
                        {@const selectedDevice = devices.find(d => d.id === editTriggerDevice)}
                        {#if selectedDevice}
                            <div class="dialog-input-group">
                                <label>Set Channel Values:</label>
                                <div class="controls-info">Select which controls to set when triggered:</div>
                                <Controls
                                    controls={DEVICE_TYPES[selectedDevice.type].controls}
                                    components={DEVICE_TYPES[selectedDevice.type].components}
                                    values={getValuesArrayForDevice(editTriggerDevice, editTriggerChannelValues)}
                                    onChange={handleEditSetValueChange}
                                    showCheckboxes={true}
                                    bind:enabledControls={editTriggerEnabledControls}
                                />
                            </div>
                        {/if}
                    {/if}
                </div>
            {:else}
                <!-- Automatic trigger: Only 2 columns -->
                <!-- Column 1: Device Configuration (Automatic) -->
                <div class="trigger-column">
                    <div class="dialog-input-group">
                        <label for="edit-trigger-device">Device:</label>
                        <select id="edit-trigger-device" bind:value={editTriggerDevice}>
                            {#each devices as device}
                                <option value={device.id}>{device.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <!-- Column 2: Action Configuration (Automatic) -->
                <div class="trigger-column">
                    <div class="dialog-input-group">
                        <label for="edit-trigger-animation">Animation:</label>
                        <select id="edit-trigger-animation" bind:value={editTriggerAnimation}>
                            {#each availableAnimations as animation}
                                <option value={animation.cssName}>{animation.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="dialog-input-group">
                        <label for="edit-trigger-duration">Duration (ms):</label>
                        <div class="duration-with-loop">
                            <input
                                id="edit-trigger-duration"
                                type="number"
                                bind:value={editTriggerDuration}
                                min="100"
                                step="100"
                                disabled={!editTriggerAnimation}
                            />
                            <div class="checkbox-field">
                                <label>
                                    <input
                                        type="checkbox"
                                        bind:checked={editTriggerLooping}
                                        disabled={!editTriggerAnimation}
                                    />
                                    Loop
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="dialog-input-group">
                        <label for="edit-trigger-easing">Easing:</label>
                        <select id="edit-trigger-easing" bind:value={editTriggerEasing} disabled={!editTriggerAnimation}>
                            {#each EASING_FUNCTIONS as easing}
                                <option value={easing}>{easing}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            {/if}
        </div>
    </form>

    {#snippet tools()}
        <Button onclick={confirmDeleteTrigger} variant="secondary">
            {@html removeIcon}
            Delete
        </Button>
    {/snippet}

    {#snippet buttons()}
        <Button onclick={closeEditDialog} variant="secondary">Cancel</Button>
        <Button type="submit" form="edit-trigger-form" variant="primary">Save</Button>
    {/snippet}
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
        gap: 10px;
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
    }

    .trigger-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        gap: 15px;
    }

    .trigger-text {
        flex: 1;
        font-size: 11pt;
        color: #333;
    }

    /* Dialog column layout */
    .trigger-columns {
        display: flex;
        gap: 20px;
    }

    .trigger-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .duration-with-loop {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .duration-with-loop input {
        width: 100%;
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
