<script>
    import { onMount } from 'svelte';
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import TimelineEditor from '../animations/TimelineEditor.svelte';
    import AnimationPreview from '../animations/AnimationPreview.svelte';

    let {
        animationLibrary,
        cssGenerator,
        devices = []
    } = $props();

    // Icons
    const plusIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

    let selectedAnimation = $state(null);
    let animationsList = $state([]);

    // Dialog states
    let newAnimationDialog = $state(null);
    let newAnimationName = $state('');
    let newAnimationDeviceType = $state('RGB');
    let deleteConfirmDialog = $state(null);
    let animationToDelete = $state(null);

    // Animation version for forcing re-renders
    let animationVersion = $state(0);

    // Load animations from library
    function refreshAnimationsList() {
        animationsList = animationLibrary.getAll();

        // Update selectedAnimation reference to the refreshed copy
        if (selectedAnimation) {
            const refreshedAnimation = animationsList.find(a => a.name === selectedAnimation.name);
            if (refreshedAnimation) {
                selectedAnimation = refreshedAnimation;
            } else {
                // Animation was deleted
                selectedAnimation = null;
            }
        }
    }

    // Initialize on mount
    onMount(() => {
        refreshAnimationsList();
    });

    function selectAnimation(animation) {
        selectedAnimation = animation;
    }

    function openNewAnimationDialog() {
        newAnimationName = '';
        newAnimationDeviceType = 'RGB';
        newAnimationDialog?.showModal();
    }

    function createNewAnimation() {
        if (!newAnimationName.trim()) return;

        const deviceType = newAnimationDeviceType;
        const numChannels = DEVICE_TYPES[deviceType].channels;
        const defaultValues = new Array(numChannels).fill(0);

        const animation = new Animation(newAnimationName.trim(), deviceType);
        // Add default keyframes at start and end
        animation.addKeyframe(0, [...defaultValues]);
        animation.addKeyframe(1, [...defaultValues]);

        animationLibrary.add(animation);
        refreshAnimationsList();
        selectAnimation(animation);
        newAnimationDialog?.close();
    }

    function confirmDeleteAnimation(animation) {
        animationToDelete = animation;
        deleteConfirmDialog?.showModal();
    }

    function deleteAnimation() {
        if (!animationToDelete) return;

        animationLibrary.remove(animationToDelete.name);
        refreshAnimationsList();
        deleteConfirmDialog?.close();
        animationToDelete = null;
    }

    function handleAnimationUpdate() {
        animationVersion++;
    }
</script>

<div class="animations-view">
    <div class="left-panel">
        <div class="panel-header">
            <h3>Animations</h3>
            <IconButton
                icon={plusIcon}
                onclick={openNewAnimationDialog}
                title="Create new animation"
            />
        </div>

        <div class="animations-list">
            {#if animationsList.length === 0}
                <p class="empty-state">No animations yet. Create one to get started!</p>
            {:else}
                {#each animationsList as animation}
                    <div
                        class="animation-item"
                        class:selected={selectedAnimation?.name === animation.name}
                        onclick={() => selectAnimation(animation)}
                    >
                        <span class="animation-name">{animation.name}</span>
                        <span class="keyframe-count">{animation.keyframes.length} keyframes</span>
                        <IconButton
                            icon={trashIcon}
                            onclick={(e) => { e.stopPropagation(); confirmDeleteAnimation(animation); }}
                            size="small"
                            title="Delete animation"
                        />
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <div class="center-panel">
        {#if selectedAnimation}
            <div class="panel-header">
                <h3>{selectedAnimation.name}</h3>
                <div class="device-type-badge">{DEVICE_TYPES[selectedAnimation.deviceType].name}</div>
            </div>

            <TimelineEditor
                animation={selectedAnimation}
                animationLibrary={animationLibrary}
                onUpdate={handleAnimationUpdate}
            />
        {:else}
            <div class="empty-state-large">
                <p>Select an animation to edit, or create a new one</p>
            </div>
        {/if}
    </div>

    <div class="right-panel">
        <div class="panel-header">
            <h3>Preview & CSS</h3>
        </div>

        {#if selectedAnimation}
            <div class="preview-section">
                <h4>Animation Preview</h4>
                <AnimationPreview animation={selectedAnimation} animationVersion={animationVersion} />
            </div>

            <div class="css-section">
                <h4>Generated CSS</h4>
                <pre class="css-output">{selectedAnimation.toCSS()}</pre>
            </div>
        {:else}
            <p class="empty-state">No animation selected</p>
        {/if}
    </div>
</div>

<!-- New Animation Dialog -->
<Dialog bind:dialogRef={newAnimationDialog}>
    <form method="dialog" onsubmit={(e) => { e.preventDefault(); createNewAnimation(); }}>
        <h3>Create New Animation</h3>

        <div class="dialog-field">
            <label for="animation-name">Animation Name:</label>
            <input
                id="animation-name"
                type="text"
                bind:value={newAnimationName}
                placeholder="e.g., rainbow, pulse, sweep"
                autofocus
            />
        </div>

        <div class="dialog-field">
            <label for="device-type">Device Type:</label>
            <select id="device-type" bind:value={newAnimationDeviceType}>
                {#each Object.entries(DEVICE_TYPES) as [key, deviceType]}
                    <option value={key}>{deviceType.name}</option>
                {/each}
            </select>
        </div>

        <div class="dialog-buttons">
            <Button type="button" onclick={() => newAnimationDialog?.close()}>Cancel</Button>
            <Button type="submit" primary>Create</Button>
        </div>
    </form>
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog bind:dialogRef={deleteConfirmDialog}>
    <h3>Delete Animation</h3>
    <p>Are you sure you want to delete "{animationToDelete?.name}"?</p>
    <p class="warning">This cannot be undone.</p>

    <div class="dialog-buttons">
        <Button onclick={() => deleteConfirmDialog?.close()}>Cancel</Button>
        <Button onclick={deleteAnimation} primary>Delete</Button>
    </div>
</Dialog>

<style>
    .animations-view {
        display: flex;
        height: 100%;
        overflow: hidden;
    }

    .left-panel {
        width: 250px;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        background: #f9f9f9;
    }

    .center-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .right-panel {
        width: 350px;
        border-left: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        background: #f9f9f9;
        overflow-y: auto;
    }

    .panel-header {
        padding: 15px;
        border-bottom: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 12pt;
        flex: 1;
    }

    .animations-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
    }

    .animation-item {
        padding: 10px;
        margin-bottom: 5px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s;
    }

    .animation-item:hover {
        background: #f0f0f0;
        border-color: #999;
    }

    .animation-item.selected {
        background: #e3f2fd;
        border-color: #2196f3;
    }

    .animation-name {
        flex: 1;
        font-weight: 500;
    }

    .keyframe-count {
        font-size: 9pt;
        color: #666;
    }

    .device-type-badge {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 9pt;
        font-weight: 500;
        margin-left: auto;
        margin-right: 10px;
    }

    .preview-section {
        padding: 15px;
        border-bottom: 1px solid #ddd;
    }

    .preview-section h4 {
        margin: 0 0 10px 0;
        font-size: 10pt;
    }

    .css-section {
        padding: 15px;
    }

    .css-section h4 {
        margin: 0 0 10px 0;
        font-size: 10pt;
    }

    .css-output {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        font-family: var(--font-stack-mono);
        font-size: 9pt;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-x: auto;
    }

    .empty-state {
        padding: 20px;
        text-align: center;
        color: #999;
        font-size: 10pt;
    }

    .empty-state-large {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 12pt;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }

    .dialog-field input,
    .dialog-field select {
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

    .warning {
        color: #f44336;
        font-size: 10pt;
    }
</style>
