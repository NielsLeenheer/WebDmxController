<script>
    import { onMount } from 'svelte';
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';
    import DeviceControls from '../controls/DeviceControls.svelte';

    let {
        animationLibrary,
        cssGenerator,
        devices = []
    } = $props();

    // Icons
    const plusIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    const trashIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

    let selectedAnimation = $state(null);
    let selectedKeyframeIndex = $state(null);
    let animationsList = $state([]);
    let previewElement = $state(null);

    // Dialog states
    let newAnimationDialog = $state(null);
    let newAnimationName = $state('');
    let newAnimationDeviceType = $state('RGB');
    let deleteConfirmDialog = $state(null);
    let animationToDelete = $state(null);

    // Keyframe editing
    let editingKeyframeValues = $state([0, 0, 0]);

    // Timeline settings
    const timelineWidth = 800; // Fixed width for animation timeline (represents 0% to 100%)

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
        // If selected animation was deleted, clear selection
        if (selectedAnimation && !animationsList.find(a => a.name === selectedAnimation.name)) {
            selectedAnimation = null;
            selectedKeyframeIndex = null;
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
        animationLibrary.save();
        refreshAnimationsList();
        animationVersion++;

        // Reselect to update reference
        selectedAnimation = animationLibrary.get(selectedAnimation.name);

        // Select the new keyframe for editing
        const newKeyframeIndex = selectedAnimation.keyframes.findIndex(kf => kf.time === time);
        if (newKeyframeIndex !== -1) {
            selectKeyframe(newKeyframeIndex);
        }
    }

    function deleteKeyframe(index) {
        if (!selectedAnimation || selectedAnimation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        selectedAnimation.keyframes.splice(index, 1);
        animationLibrary.save();
        refreshAnimationsList();
        animationVersion++;
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
        selectedKeyframeIndex = null;
    }

    function selectKeyframe(index) {
        if (!selectedAnimation) return;

        selectedKeyframeIndex = index;
        const keyframe = selectedAnimation.keyframes[index];

        // Load keyframe values into editor
        editingKeyframeValues = [...keyframe.values];
    }

    function updateKeyframeValues() {
        if (!selectedAnimation || selectedKeyframeIndex === null) return;

        const keyframe = selectedAnimation.keyframes[selectedKeyframeIndex];
        keyframe.values = [...editingKeyframeValues];

        animationLibrary.save();
        refreshAnimationsList();
        animationVersion++;
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
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

        // Re-sort keyframes
        selectedAnimation.keyframes.sort((a, b) => a.time - b.time);

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
        refreshAnimationsList();
        selectedAnimation = animationLibrary.get(selectedAnimation.name);

        draggingKeyframe = null;
    }

    function getKeyframePosition(keyframe) {
        animationVersion; // Make reactive
        return keyframe.time * timelineWidth;
    }

    function previewAnimation() {
        if (!selectedAnimation || !previewElement) return;

        // Apply animation to preview element
        previewElement.style.animation = 'none';
        setTimeout(() => {
            previewElement.style.animation = `${selectedAnimation.name} 3s linear infinite`;
        }, 10);
    }

    // Generate CSS for preview (reactive to animationVersion)
    let previewCSS = $derived.by(() => {
        animationVersion; // Make reactive to animationVersion
        return selectedAnimation ? selectedAnimation.toCSS() : '';
    });

    // Get gradient segments (reactive to animationVersion)
    let gradientSegments = $derived.by(() => {
        animationVersion; // Make reactive to animationVersion
        return selectedAnimation ? selectedAnimation.getGradientSegments(timelineWidth) : [];
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
                <div class="header-actions">
                    <Button onclick={previewAnimation}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Preview
                    </Button>
                </div>
            </div>

            <div class="timeline-container">
                <div class="timeline-instructions">
                    Click on the timeline to add a keyframe
                </div>
                <div
                    class="timeline"
                    style="width: {timelineWidth}px"
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
                    {#each selectedAnimation.keyframes as keyframe, index}
                        <div
                            class="timeline-keyframe-marker"
                            class:selected={selectedKeyframeIndex === index}
                            class:dragging={draggingKeyframe?.keyframe === keyframe}
                            style="left: {getKeyframePosition(keyframe)}px; --keyframe-color: {selectedAnimation.getKeyframeColor(keyframe)}"
                            onmousedown={(e) => handleKeyframeMouseDown(e, keyframe, index)}
                            onclick={(e) => {
                                e.stopPropagation();
                                // Only select if we didn't just drag
                                if (!hasActuallyDragged) {
                                    selectKeyframe(index);
                                }
                            }}
                            title="{(keyframe.time * 100).toFixed(0)}%"
                        >
                            <div class="keyframe-time">{(keyframe.time * 100).toFixed(0)}%</div>
                        </div>
                    {/each}
                </div>
            </div>

            {#if selectedKeyframeIndex !== null}
                <div class="keyframe-editor">
                    <h4>Keyframe at {(selectedAnimation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%</h4>

                    <DeviceControls
                        deviceType={selectedAnimation.deviceType}
                        bind:values={editingKeyframeValues}
                        onChange={updateKeyframeValues}
                    />

                    <div class="property-actions">
                        <Button
                            onclick={() => deleteKeyframe(selectedKeyframeIndex)}
                            disabled={selectedAnimation.keyframes.length <= 2}
                        >
                            Delete Keyframe
                        </Button>
                    </div>
                </div>
            {:else}
                <p class="empty-state">Select a keyframe to edit its values</p>
            {/if}
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
                <div class="preview-container">
                    <div class="preview-box" bind:this={previewElement}></div>
                </div>
            </div>

            <div class="css-section">
                <h4>Generated CSS</h4>
                <pre class="css-output">{previewCSS}</pre>
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

<!-- Inject preview animation CSS -->
{#if selectedAnimation}
    <style>
        {@html previewCSS}
    </style>
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

    .header-actions {
        display: flex;
        gap: 10px;
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
        align-items: center;
        gap: 10px;
    }

    .timeline-instructions {
        font-size: 9pt;
        color: #888;
        font-style: italic;
    }

    .timeline {
        position: relative;
        height: 60px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: crosshair;
        overflow: visible;
    }

    .timeline:hover {
        background: #f0f0f0;
    }

    .gradient-segment {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        height: 20px;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.15);
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
        border: 3px solid white;
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

    .timeline-keyframe-marker.selected {
        border-color: #ffd700;
        box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
        width: 20px;
        height: 20px;
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

    .preview-container {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 150px;
    }

    .preview-box {
        width: 80px;
        height: 80px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
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
