<script>
    import { onMount } from 'svelte';
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import DeviceControls from '../controls/DeviceControls.svelte';
    import AnimationPreview from '../animations/AnimationPreview.svelte';

    let {
        animationLibrary,
        cssGenerator,
        devices = []
    } = $props();

    // Icons
    const plusIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

    import removeIcon from '../../assets/icons/remove.svg?raw';

    let selectedAnimation = $state(null);
    let selectedKeyframeIndex = $state(null);
    let animationsList = $state([]);

    // Dialog states
    let newAnimationDialog = $state(null);
    let newAnimationName = $state('');
    let newAnimationDeviceType = $state('RGB');
    let deleteConfirmDialog = $state(null);
    let animationToDelete = $state(null);

    // Keyframe editing
    let editingKeyframeValues = $state([0, 0, 0]);
    let editDialog = $state(null);
    let editButtonRef = $state(null);

    // Timeline settings
    let timelineElement = $state(null);
    let timelineWidth = $state(800); // Dynamic width for animation timeline (represents 0% to 100%)

    // Keyframe dragging
    let draggingKeyframe = $state(null);
    let dragStartX = $state(0);
    let dragStartTime = $state(0);
    let hasActuallyDragged = $state(false);

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
                selectedKeyframeIndex = null;
            }
        }
    }

    // Initialize on mount
    onMount(() => {
        refreshAnimationsList();
    });

    function selectAnimation(animation) {
        selectedAnimation = animation;
        selectedKeyframeIndex = null;
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

    function addKeyframeAtTime(time) {
        if (!selectedAnimation) return;

        const numChannels = DEVICE_TYPES[selectedAnimation.deviceType].channels;
        const defaultValues = new Array(numChannels).fill(0);

        selectedAnimation.addKeyframe(time, defaultValues);

        // Force Svelte to detect the change by reassigning
        selectedAnimation = selectedAnimation;
        animationVersion++;

        animationLibrary.save();

        // Select the new keyframe for editing
        const newKeyframeIndex = selectedAnimation.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.001);
        if (newKeyframeIndex !== -1) {
            // Wait for the DOM to update, then get the element reference and open dialog
            requestAnimationFrame(() => {
                const keypointElement = document.getElementById(`keyframe-${selectedAnimation.name}-${newKeyframeIndex}`);
                selectKeyframe(newKeyframeIndex, keypointElement);
            });
        }
    }

    function deleteKeyframe(index) {
        if (!selectedAnimation || selectedAnimation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        selectedAnimation.keyframes = selectedAnimation.keyframes.filter((_, i) => i !== index);
        selectedAnimation = selectedAnimation;
        animationVersion++;

        animationLibrary.save();
        selectedKeyframeIndex = null;
    }

    function selectKeyframe(index, buttonElement = null) {
        if (!selectedAnimation) return;

        selectedKeyframeIndex = index;
        const keyframe = selectedAnimation.keyframes[index];

        // Load keyframe values into editor
        editingKeyframeValues = [...keyframe.values];
        editButtonRef = buttonElement;

        // Show dialog after a brief delay to ensure keyframe is rendered
        requestAnimationFrame(() => {
            editDialog?.showModal();
        });
    }

    function closeEditDialog() {
        editDialog?.close();
        selectedKeyframeIndex = null;
        editButtonRef = null;
    }

    function handleEditDialogClick(event) {
        if (event.target === editDialog) {
            closeEditDialog();
        }
    }

    function updateKeyframeValues() {
        if (!selectedAnimation || selectedKeyframeIndex === null) return;

        const keyframe = selectedAnimation.keyframes[selectedKeyframeIndex];
        keyframe.values = [...editingKeyframeValues];

        selectedAnimation = selectedAnimation;
        animationVersion++;
        animationLibrary.save();
    }

    function confirmDeleteKeyframe() {
        if (!selectedAnimation || selectedKeyframeIndex === null) return;

        if (selectedAnimation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        if (confirm(`Delete keyframe at ${(selectedAnimation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%?`)) {
            deleteKeyframe(selectedKeyframeIndex);
            closeEditDialog();
        }
    }

    // Timeline interaction functions
    function handleTimelineClick(e) {
        if (!selectedAnimation) return;

        // Prevent if clicking on existing keyframe
        if (e.target.classList.contains('timeline-keyframe-marker')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedTime = Math.max(0, Math.min(1, x / timelineWidth));

        addKeyframeAtTime(clickedTime);
    }

    function handleKeyframeMouseDown(e, keyframe, index) {
        e.stopPropagation();
        e.preventDefault();

        draggingKeyframe = { keyframe, index };
        dragStartX = e.clientX;
        dragStartTime = keyframe.time;
        hasActuallyDragged = false;

        document.addEventListener('mousemove', handleKeyframeMouseMove);
        document.addEventListener('mouseup', handleKeyframeMouseUp);
    }

    function handleKeyframeMouseMove(e) {
        if (!draggingKeyframe || !selectedAnimation) return;

        const deltaX = e.clientX - dragStartX;

        // Only start dragging if we've moved more than 3 pixels
        if (Math.abs(deltaX) > 3) {
            hasActuallyDragged = true;
        }

        const deltaTime = deltaX / timelineWidth;
        let newTime = dragStartTime + deltaTime;

        // Clamp to 0-1 range
        newTime = Math.max(0, Math.min(1, newTime));

        // Update keyframe time
        const keyframe = draggingKeyframe.keyframe;
        keyframe.time = newTime;

        // Re-sort keyframes and create new array reference for reactivity
        selectedAnimation.keyframes = [...selectedAnimation.keyframes].sort((a, b) => a.time - b.time);
        selectedAnimation = selectedAnimation;

        // Find new index after sorting
        const newIndex = selectedAnimation.keyframes.indexOf(keyframe);
        selectedKeyframeIndex = newIndex;
        draggingKeyframe.index = newIndex;

        animationVersion++;
    }

    function handleKeyframeMouseUp() {
        if (!draggingKeyframe) return;

        document.removeEventListener('mousemove', handleKeyframeMouseMove);
        document.removeEventListener('mouseup', handleKeyframeMouseUp);

        animationLibrary.save();

        draggingKeyframe = null;
    }

    function getKeyframePosition(keyframe) {
        animationVersion; // Make reactive
        return keyframe.time * timelineWidth;
    }

    // Get gradient segments (reactive to animationVersion)
    let gradientSegments = $derived.by(() => {
        animationVersion; // Make reactive to animationVersion
        return selectedAnimation ? selectedAnimation.getGradientSegments(timelineWidth) : [];
    });

    // Get keyframes (reactive to animationVersion)
    let displayKeyframes = $derived.by(() => {
        animationVersion; // Make reactive to animationVersion
        return selectedAnimation ? selectedAnimation.keyframes : [];
    });
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

            <div class="timeline-container">
                <div
                    class="timeline"
                    bind:this={timelineElement}
                    bind:clientWidth={timelineWidth}
                    onclick={handleTimelineClick}
                >
                    <!-- Gradient segments showing color transitions -->
                    {#each gradientSegments as segment}
                        <div
                            class="gradient-segment"
                            style="left: {segment.left}px; width: {segment.width}px; background: {segment.gradient}"
                        ></div>
                    {/each}

                    <!-- Keyframe markers -->
                    {#each displayKeyframes as keyframe, index (keyframe.time + '-' + index + '-' + animationVersion)}
                        <div
                            id="keyframe-{selectedAnimation.name}-{index}"
                            class="timeline-keyframe-marker"
                            class:dragging={draggingKeyframe?.keyframe === keyframe}
                            style="left: {getKeyframePosition(keyframe)}px; --keyframe-color: {selectedAnimation.getKeyframeColor(keyframe)}; anchor-name: --keyframe-{selectedAnimation.name}-{index}"
                            onmousedown={(e) => handleKeyframeMouseDown(e, keyframe, index)}
                            onclick={(e) => {
                                e.stopPropagation();
                                // Only select if we didn't just drag
                                if (!hasActuallyDragged) {
                                    selectKeyframe(index, e.currentTarget);
                                }
                            }}
                            title="{(keyframe.time * 100).toFixed(0)}%"
                        >
                            <div class="keyframe-time">{(keyframe.time * 100).toFixed(0)}%</div>
                        </div>
                    {/each}
                </div>
            </div>
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

<!-- Keyframe Edit Dialog -->
{#if editButtonRef && selectedAnimation && selectedKeyframeIndex !== null}
<dialog
    bind:this={editDialog}
    class="keyframe-edit-dialog"
    style="position-anchor: --keyframe-{selectedAnimation.name}-{selectedKeyframeIndex}"
    onclick={handleEditDialogClick}
>
    <div class="dialog-header">
        <div class="dialog-title">
            Keyframe at {(selectedAnimation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%
        </div>
    </div>

    <div class="dialog-content">
        <DeviceControls
            deviceType={selectedAnimation.deviceType}
            bind:values={editingKeyframeValues}
            onChange={updateKeyframeValues}
        />

        <div class="dialog-actions">
            <button
                type="button"
                class="delete-btn"
                onclick={confirmDeleteKeyframe}
                title="Delete keyframe"
                disabled={selectedAnimation.keyframes.length <= 2}
            >
                {@html removeIcon}
            </button>
            <div class="action-buttons">
                <Button onclick={closeEditDialog} variant="secondary">Close</Button>
            </div>
        </div>
    </div>
</dialog>
{/if}

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

    .timeline-container {
        padding: 20px;
        border-bottom: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        overflow: visible;
    }

    .timeline {
        position: relative;
        width: 100%;
        max-width: 100%;
        height: 60px;
        cursor: crosshair;
    }

    .gradient-segment {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        height: 8px;
        border-radius: 10px;
        pointer-events: none;
        z-index: 1;
    }

    .timeline-keyframe-marker {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        background: var(--keyframe-color, #2196f3);
        border: 2px solid white;
        border-radius: 50%;
        cursor: grab;
        z-index: 5;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        transition: all 0.15s ease;
    }

    .timeline-keyframe-marker:hover {
        width: 20px;
        height: 20px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    }

    .timeline-keyframe-marker.dragging {
        cursor: grabbing;
        z-index: 15;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        transition: none;
    }

    .keyframe-time {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 8px;
        font-size: 8pt;
        color: #666;
        white-space: nowrap;
        font-weight: 500;
    }

    .keyframe-editor {
        padding: 20px;
        overflow-y: auto;
    }

    .keyframe-editor h4 {
        margin: 0 0 15px 0;
        font-size: 11pt;
    }


    .property-actions {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
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

    /* Keyframe Edit Dialog */
    .keyframe-edit-dialog {
        position: fixed;
        position-anchor: var(--position-anchor);
        top: anchor(bottom);
        left: anchor(left);
        translate: calc(-50% + 8px) 8px;
        margin: 0;
        padding: 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        min-width: 300px;
        max-width: 400px;
        overflow: visible;
    }

    .keyframe-edit-dialog::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }

    /* Dialog arrow pointing up */
    .keyframe-edit-dialog::before {
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid #fff;
        filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
    }

    .keyframe-edit-dialog .dialog-header {
        padding: 15px;
        border-bottom: 1px solid #e0e0e0;
    }

    .keyframe-edit-dialog .dialog-title {
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .keyframe-edit-dialog .dialog-content {
        padding: 15px;
        max-height: 500px;
        overflow-y: auto;
    }

    .keyframe-edit-dialog .dialog-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e0e0e0;
    }

    .keyframe-edit-dialog .delete-btn {
        padding: 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: #d13438;
        transition: background 0.2s;
    }

    .keyframe-edit-dialog .delete-btn:hover:not(:disabled) {
        background: #ffe0e0;
    }

    .keyframe-edit-dialog .delete-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .keyframe-edit-dialog .delete-btn :global(svg) {
        width: 20px;
        height: 20px;
    }

    .keyframe-edit-dialog .action-buttons {
        display: flex;
        gap: 8px;
    }
</style>
