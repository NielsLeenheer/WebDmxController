<script>
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import Controls from '../controls/Controls.svelte';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let {
        animation,
        animationLibrary,
        animationVersion = 0,
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

    // Display keyframes (for rendering) - reactive to animationVersion
    let displayKeyframes = $derived.by(() => {
        animationVersion; // Make reactive to version changes
        return animation ? animation.keyframes : [];
    });

    // Gradient segments for visualization - reactive to animationVersion
    let gradientSegments = $derived.by(() => {
        animationVersion; // Make reactive to version changes

        if (!animation || animation.keyframes.length < 2) return [];

        const segments = [];
        const keyframes = animation.keyframes;

        // Extend gradient from 0% if first keyframe is after the start
        const firstKeyframe = keyframes[0];
        if (firstKeyframe.time > 0) {
            const color = animation.getKeyframeColor(firstKeyframe);
            segments.push({
                left: 0,
                width: firstKeyframe.time * timelineWidth,
                gradient: color // Solid color from start
            });
        }

        // Create segments between keyframes
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

        // Extend gradient to 100% if last keyframe is before the end
        const lastKeyframe = keyframes[keyframes.length - 1];
        if (lastKeyframe.time < 1) {
            const color = animation.getKeyframeColor(lastKeyframe);
            const left = lastKeyframe.time * timelineWidth;
            const width = (1 - lastKeyframe.time) * timelineWidth;

            segments.push({
                left,
                width,
                gradient: color // Solid color to the end
            });
        }

        return segments;
    });

    function getKeyframePosition(keyframe) {
        animationVersion; // Make reactive to version changes
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

        // Prevent if clicking on existing keyframe or keyframe label
        if (e.target.classList.contains('timeline-keyframe-marker') ||
            e.target.classList.contains('keyframe-time')) {
            return;
        }

        // Also check if clicking inside a keyframe marker (e.g., on the time label inside it)
        const keyframeMarker = e.target.closest('.timeline-keyframe-marker');
        if (keyframeMarker) {
            return;
        }

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
            // Wait for the DOM to update with double requestAnimationFrame to ensure render is complete
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const keypointElement = document.getElementById(`keyframe-${animation.name}-${newKeyframeIndex}`);
                    if (keypointElement) {
                        selectKeyframe(newKeyframeIndex, keypointElement);
                    }
                });
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
        {#each displayKeyframes as keyframe, index (keyframe.time + '-' + index + '-' + animationVersion)}
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
    title="Keyframe at {(animation.keyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%"
>
    <Controls
        {...animation.getControlsForRendering()}
        bind:values={editingKeyframeValues}
        onChange={updateKeyframeValues}
    />

    {#snippet tools()}
        <Button
            onclick={confirmDeleteKeyframe}
            variant="secondary"
            disabled={animation.keyframes.length <= 2}
        >
            {@html removeIcon}
            Delete
        </Button>
    {/snippet}
</Dialog>
{/if}

<style>
    .timeline-container {
        padding: 20px 40px;
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
        width: 12px;
        height: 12px;
        margin-left: -6px;
        margin-top: -6px;
        background: var(--keyframe-color, #2196f3);
        outline: 2px solid rgba(255,255,255,0.6);
        border-radius: 50%;
        cursor: grab;
        z-index: 5;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    .timeline-keyframe-marker:hover {
        border-width: 3px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    }

    .timeline-keyframe-marker.dragging {
        cursor: grabbing;
        z-index: 15;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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

</style>
