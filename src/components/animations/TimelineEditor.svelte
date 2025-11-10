<script>
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import DeviceControls from '../controls/DeviceControls.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let {
        animation,
        animationLibrary,
        onUpdate = null
    } = $props();

    // Keyframe editing
    let editingKeyframeValues = $state([0, 0, 0]);
    let selectedKeyframeIndex = $state(null);
    let editDialog = $state(null);
    let editButtonRef = $state(null);

    // Timeline settings
    let timelineElement = $state(null);
    let timelineWidth = $state(800);

    // Keyframe dragging
    let draggingKeyframe = $state(null);
    let dragStartX = $state(0);
    let dragStartTime = $state(0);
    let hasActuallyDragged = $state(false);

    // Display keyframes (for rendering)
    let displayKeyframes = $derived(animation ? [...animation.keyframes] : []);

    // Gradient segments for visualization
    let gradientSegments = $derived.by(() => {
        if (!animation || animation.keyframes.length < 2) return [];

        const segments = [];
        const keyframes = animation.keyframes;

        for (let i = 0; i < keyframes.length - 1; i++) {
            const kf1 = keyframes[i];
            const kf2 = keyframes[i + 1];

            const color1 = animation.getKeyframeColor(kf1);
            const color2 = animation.getKeyframeColor(kf2);

            const left = kf1.time * timelineWidth;
            const width = (kf2.time - kf1.time) * timelineWidth;

            segments.push({
                left,
                width,
                gradient: `linear-gradient(to right, ${color1}, ${color2})`
            });
        }

        return segments;
    });

    function getKeyframePosition(keyframe) {
        return keyframe.time * timelineWidth;
    }

    function selectKeyframe(index, buttonElement = null) {
        if (!animation) return;

        selectedKeyframeIndex = index;
        const keyframe = animation.keyframes[index];

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

    function updateKeyframeValues() {
        if (!animation || selectedKeyframeIndex === null) return;

        const keyframe = animation.keyframes[selectedKeyframeIndex];
        keyframe.values = [...editingKeyframeValues];

        animationLibrary.save();
        if (onUpdate) onUpdate();
    }

    function confirmDeleteKeyframe() {
        if (!animation || selectedKeyframeIndex === null) return;

        if (animation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        if (confirm(`Delete keyframe at ${(animation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%?`)) {
            deleteKeyframe(selectedKeyframeIndex);
            closeEditDialog();
        }
    }

    function deleteKeyframe(index) {
        if (!animation || animation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        animation.keyframes = animation.keyframes.filter((_, i) => i !== index);
        animationLibrary.save();
        if (onUpdate) onUpdate();
        selectedKeyframeIndex = null;
    }

    function handleTimelineClick(e) {
        if (!animation) return;

        // Prevent if clicking on existing keyframe
        if (e.target.classList.contains('timeline-keyframe-marker')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.max(0, Math.min(1, x / timelineWidth));

        // Round to nearest 5%
        const roundedTime = Math.round(time * 20) / 20;

        // Check if keyframe already exists at this time
        const exists = animation.keyframes.some(kf => Math.abs(kf.time - roundedTime) < 0.001);
        if (exists) return;

        // Get interpolated values at this time
        const values = animation.getValuesAtTime(roundedTime);

        // Add new keyframe
        animation.addKeyframe(roundedTime, values);
        animationLibrary.save();
        if (onUpdate) onUpdate();

        // Select the new keyframe for editing
        const newKeyframeIndex = animation.keyframes.findIndex(kf => Math.abs(kf.time - roundedTime) < 0.001);
        if (newKeyframeIndex !== -1) {
            // Wait for the DOM to update, then get the element reference and open dialog
            requestAnimationFrame(() => {
                const keypointElement = document.getElementById(`keyframe-${animation.name}-${newKeyframeIndex}`);
                selectKeyframe(newKeyframeIndex, keypointElement);
            });
        }
    }

    function handleKeyframeMouseDown(e, keyframe, index) {
        e.preventDefault();
        e.stopPropagation();

        draggingKeyframe = { keyframe, index };
        dragStartX = e.clientX;
        dragStartTime = keyframe.time;
        hasActuallyDragged = false;

        document.addEventListener('mousemove', handleKeyframeMouseMove);
        document.addEventListener('mouseup', handleKeyframeMouseUp);
    }

    function handleKeyframeMouseMove(e) {
        if (!draggingKeyframe || !animation) return;

        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / timelineWidth;
        let newTime = dragStartTime + deltaTime;

        // Clamp between 0 and 1
        newTime = Math.max(0, Math.min(1, newTime));

        // Round to nearest 1%
        newTime = Math.round(newTime * 100) / 100;

        // Don't allow dragging to 0 or 1 if those positions already have keyframes
        const firstKeyframe = animation.keyframes[0];
        const lastKeyframe = animation.keyframes[animation.keyframes.length - 1];

        if (draggingKeyframe.index !== 0 && newTime === 0 && firstKeyframe.time === 0) {
            return;
        }
        if (draggingKeyframe.index !== animation.keyframes.length - 1 && newTime === 1 && lastKeyframe.time === 1) {
            return;
        }

        // Update time
        draggingKeyframe.keyframe.time = newTime;

        // Re-sort keyframes by time
        animation.keyframes.sort((a, b) => a.time - b.time);

        // Update the dragging index in case it changed due to sorting
        draggingKeyframe.index = animation.keyframes.indexOf(draggingKeyframe.keyframe);

        if (Math.abs(deltaX) > 3) {
            hasActuallyDragged = true;
        }

        if (onUpdate) onUpdate();
    }

    function handleKeyframeMouseUp() {
        if (draggingKeyframe && animation) {
            animationLibrary.save();
        }

        draggingKeyframe = null;
        document.removeEventListener('mousemove', handleKeyframeMouseMove);
        document.removeEventListener('mouseup', handleKeyframeMouseUp);

        // Reset drag detection after a brief delay
        setTimeout(() => {
            hasActuallyDragged = false;
        }, 10);
    }
</script>

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
        {#each displayKeyframes as keyframe, index (keyframe.time + '-' + index)}
            <div
                id="keyframe-{animation.name}-{index}"
                class="timeline-keyframe-marker"
                class:dragging={draggingKeyframe?.keyframe === keyframe}
                style="left: {getKeyframePosition(keyframe)}px; --keyframe-color: {animation.getKeyframeColor(keyframe)}; anchor-name: --keyframe-{animation.name}-{index}"
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

<!-- Keyframe Edit Dialog -->
{#if editButtonRef && animation && selectedKeyframeIndex !== null}
<Dialog
    bind:dialogRef={editDialog}
    anchored={true}
    anchorId={`keyframe-${animation.name}-${selectedKeyframeIndex}`}
    showArrow={true}
    lightDismiss={true}
    onclose={closeEditDialog}
>
    <div class="keyframe-editor-content">
        <h4>Keyframe at {(animation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%</h4>

        <DeviceControls
            deviceType={animation.deviceType}
            bind:values={editingKeyframeValues}
            onChange={updateKeyframeValues}
        />

        <div class="keyframe-actions">
            <button
                type="button"
                class="delete-btn"
                onclick={confirmDeleteKeyframe}
                title="Delete keyframe"
                disabled={animation.keyframes.length <= 2}
            >
                {@html removeIcon}
            </button>
            <div class="action-buttons">
                <Button onclick={closeEditDialog} variant="secondary">Close</Button>
            </div>
        </div>
    </div>
</Dialog>
{/if}

<style>
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
        width: 16px;
        height: 16px;
        margin-left: -8px;
        margin-top: -8px;
        background: var(--keyframe-color, #2196f3);
        border: 2px solid white;
        border-radius: 50%;
        cursor: grab;
        z-index: 5;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        transition: all 0.15s ease;
    }

    .timeline-keyframe-marker:hover {
        border-width: 3px;
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
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9pt;
        color: #666;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
    }

    /* Keyframe Editor Content */
    .keyframe-editor-content {
        max-height: 500px;
        overflow-y: auto;
    }

    .keyframe-editor-content h4 {
        margin: 0 0 15px 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .keyframe-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e0e0e0;
    }

    .delete-btn {
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

    .delete-btn:hover:not(:disabled) {
        background: #ffe0e0;
    }

    .delete-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .delete-btn :global(svg) {
        width: 20px;
        height: 20px;
    }

    .action-buttons {
        display: flex;
        gap: 8px;
    }
</style>
