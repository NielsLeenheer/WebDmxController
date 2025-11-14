<script>
    import { onMount } from 'svelte';
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import TimelineEditor from '../animations/TimelineEditor.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';
    import editIcon from '../../assets/glyphs/edit.svg?raw';

    let {
        animationLibrary,
        cssGenerator,
        devices = []
    } = $props();

    let animationsList = $state([]);

    // Dialog states
    let newAnimationDialog = null; // DOM reference - should NOT be $state
    let newAnimationName = $state('');
    let newAnimationDeviceType = $state('RGB');
    let selectedAnimationOption = $state('__all__'); // Selected option from the list

    // Edit dialog states
    let editDialog = null; // DOM reference - should NOT be $state
    let editingAnimation = $state(null);
    let editingName = $state('');

    // Animation version for forcing re-renders
    let animationVersion = $state(0);

    // Load animations from library
    function refreshAnimationsList() {
        animationsList = animationLibrary.getAll();

        // Update editingAnimation reference to the refreshed copy
        if (editingAnimation) {
            const refreshedAnimation = animationsList.find(a => a.name === editingAnimation.name);
            if (refreshedAnimation) {
                editingAnimation = refreshedAnimation;
            } else {
                // Animation was deleted
                editingAnimation = null;
            }
        }
    }

    // Initialize on mount
    onMount(() => {
        refreshAnimationsList();
    });

    function openNewAnimationDialog() {
        newAnimationName = '';
        newAnimationDeviceType = 'RGB';
        selectedAnimationOption = '__all__';
        newAnimationDialog?.showModal();
    }

    // Get animation options for the selected device type
    function getAnimationOptions() {
        if (!newAnimationDeviceType) return [];

        const deviceControls = DEVICE_TYPES[newAnimationDeviceType]?.controls || [];
        const options = [];

        // Add individual controls at the top
        for (const control of deviceControls) {
            options.push({
                type: 'control',
                value: control.name,
                label: control.name
            });
        }

        // Add separator
        if (deviceControls.length > 0) {
            options.push({ type: 'separator' });
        }

        // Add "All controls" option
        options.push({
            type: 'all',
            value: '__all__',
            label: `All controls (${DEVICE_TYPES[newAnimationDeviceType].name})`
        });

        return options;
    }

    // Update animation options when device type changes
    function handleDeviceTypeChange() {
        selectedAnimationOption = '__all__';
    }

    function createNewAnimation() {
        if (!newAnimationName.trim()) return;

        const deviceType = newAnimationDeviceType;

        // Convert selected option to controls array
        let controls = null;
        if (selectedAnimationOption === '__all__') {
            // Animate all controls
            controls = null;
        } else {
            // Animate specific control
            controls = [selectedAnimationOption];
        }

        // Create animation with controls array
        const animation = new Animation(newAnimationName.trim(), deviceType, [], null, controls);

        // Determine number of channels based on control selection
        const numChannels = animation.getNumChannels();
        const defaultValues = new Array(numChannels).fill(0);

        // Add default keyframes at start and end
        animation.addKeyframe(0, [...defaultValues]);
        animation.addKeyframe(1, [...defaultValues]);

        animationLibrary.add(animation);
        refreshAnimationsList();
        newAnimationDialog?.close();
    }

    function openEditDialog(animation) {
        editingAnimation = animation;
        editingName = animation.name;

        requestAnimationFrame(() => {
            editDialog?.showModal();
        });
    }

    function closeEditDialog() {
        editDialog?.close();
        editingAnimation = null;
        editingName = '';
    }

    function saveEdit() {
        if (!editingAnimation || !editingName.trim()) return;

        // Update animation name
        const oldName = editingAnimation.name;
        editingAnimation.name = editingName.trim();
        // Update CSS name based on new animation name
        editingAnimation.updateCSSName();

        // Save to library
        animationLibrary.save();
        refreshAnimationsList();
        closeEditDialog();
    }

    // Generate preview of CSS animation name based on current editing name
    function getPreviewCSSName() {
        if (!editingName.trim()) return '';

        const cssName = editingName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        return cssName;
    }

    function confirmDeleteAnimation() {
        if (!editingAnimation) return;

        if (confirm(`Are you sure you want to delete "${editingAnimation.name}"?`)) {
            animationLibrary.remove(editingAnimation.name);
            refreshAnimationsList();
            closeEditDialog();
        }
    }

    function handleAnimationUpdate() {
        animationVersion++;
    }
</script>

<div class="animations-view">
    <div class="add-animation-section">
        <Button onclick={openNewAnimationDialog} variant="secondary">
            Add Animation
        </Button>
    </div>

    <div class="animations-list">
        {#if animationsList.length === 0}
            <div class="empty-state">
                <p>No animations yet. Create one to get started!</p>
            </div>
        {:else}
            {#each animationsList as animation (animation.name)}
                <div class="animation-card">
                    <div class="animation-header">
                        <div class="animation-info">
                            <h3>{animation.name}</h3>
                            <div class="badges">
                                <div class="device-type-badge">{DEVICE_TYPES[animation.deviceType].name}</div>
                                {#each animation.getControlNames() as controlName}
                                    <div class="control-badge">{controlName}</div>
                                {/each}
                            </div>
                        </div>
                        <IconButton
                            icon={editIcon}
                            onclick={() => openEditDialog(animation)}
                            title="Edit animation"
                            size="small"
                        />
                    </div>

                    <TimelineEditor
                        {animation}
                        {animationLibrary}
                        {animationVersion}
                        onUpdate={handleAnimationUpdate}
                    />
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- New Animation Dialog -->
<Dialog bind:dialogRef={newAnimationDialog} title="Create New Animation" onclose={() => newAnimationDialog?.close()}>
    <form id="new-animation-form" method="dialog" onsubmit={(e) => { e.preventDefault(); createNewAnimation(); }}>
        <div class="dialog-input-group">
            <label for="animation-name">Animation Name:</label>
            <input
                id="animation-name"
                type="text"
                bind:value={newAnimationName}
                placeholder="e.g., rainbow, pulse, sweep"
                autofocus
            />
        </div>

        <div class="dialog-input-group">
            <label for="device-type">Device Type:</label>
            <select id="device-type" bind:value={newAnimationDeviceType} onchange={handleDeviceTypeChange}>
                {#each Object.entries(DEVICE_TYPES) as [key, deviceType]}
                    <option value={key}>{deviceType.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-input-group">
            <label for="animation-target">Animate:</label>
            <select id="animation-target" bind:value={selectedAnimationOption} class="animation-target-select">
                {#each getAnimationOptions() as option}
                    {#if option.type === 'separator'}
                        <option disabled>──────────</option>
                    {:else}
                        <option value={option.value}>{option.label}</option>
                    {/if}
                {/each}
            </select>
            <small class="help-text">Select a specific control or all controls together</small>
        </div>
    </form>

    {#snippet buttons()}
        <Button type="button" onclick={() => newAnimationDialog?.close()} variant="secondary">Cancel</Button>
        <Button type="submit" form="new-animation-form" variant="primary">Create</Button>
    {/snippet}
</Dialog>

<!-- Edit Animation Dialog -->
{#if editingAnimation}
<Dialog bind:dialogRef={editDialog} title="Animation" onclose={closeEditDialog}>
    <form id="edit-animation-form" method="dialog" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
        <div class="dialog-input-group">
            <label for="edit-animation-name">Name:</label>
            <input
                id="edit-animation-name"
                type="text"
                bind:value={editingName}
                placeholder="Animation name"
                autofocus
            />
            <small class="css-preview">@keyframes {getPreviewCSSName()}</small>
        </div>
    </form>

    {#snippet tools()}
        <Button onclick={confirmDeleteAnimation} variant="secondary">
            {@html removeIcon}
            Delete
        </Button>
    {/snippet}

    {#snippet buttons()}
        <Button onclick={closeEditDialog} variant="secondary">Cancel</Button>
        <Button type="submit" form="edit-animation-form" variant="primary">Save</Button>
    {/snippet}
</Dialog>
{/if}

<style>
    .animations-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .add-animation-section {
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .animations-list {
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
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 10pt;
    }

    .empty-state p {
        margin: 0;
    }

    .animation-card {
        width: 80vw;
        background: #f0f0f0;
        border-radius: 8px;
        overflow: hidden;
    }

    .animation-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        background: #e6e6e6;
        gap: 15px;
    }

    .animation-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    .animation-info h3 {
        margin: 0;
        font-size: 11pt;
        color: #333;
    }

    .badges {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .device-type-badge {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 9pt;
        font-weight: 500;
    }

    .control-badge {
        background: #f3e5f5;
        color: #7b1fa2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 9pt;
        font-weight: 500;
    }

    .help-text {
        display: block;
        margin-top: 4px;
        font-size: 9pt;
        color: #888;
    }
</style>
