<script>
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import Controls from '../controls/Controls.svelte';
    import { getControlsForRendering, getKeyframeColor, getValuesAtTime } from '../../lib/animations/utils.js';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let {
        animation,
        animationLibrary,
        onUpdate = null
    } = $props();

    // Keyframe editing
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
    
    // Local state for smooth dragging and consistent display
    let localKeyframes = $state([]);
    let isDragging = $state(false);

    // Sync local keyframes from animation when external changes occur (but not during drag)
    $effect(() => {
        if (!isDragging && animation) {
            localKeyframes = $state.snapshot(animation.keyframes);
        }
    });

    // Always display from local keyframes
    let displayKeyframes = $derived(localKeyframes);

    // Gradient segments for visualization using local keyframes
    let gradientSegments = $derived.by(() => {
        if (!animation || localKeyframes.length < 2) return [];

        const segments = [];

        // Extend gradient from 0% if first keyframe is after the start
        const firstKeyframe = localKeyframes[0];
        if (firstKeyframe.time > 0) {
            const color = getKeyframeColor(firstKeyframe);
            segments.push({
                left: 0,
                width: firstKeyframe.time * timelineWidth,
                gradient: color // Solid color from start
            });
        }

        // Create segments between keyframes
        for (let i = 0; i < localKeyframes.length - 1; i++) {
            const kf1 = localKeyframes[i];
            const kf2 = localKeyframes[i + 1];

            const color1 = getKeyframeColor(kf1);
            const color2 = getKeyframeColor(kf2);

            const left = kf1.time * timelineWidth;
            const width = (kf2.time - kf1.time) * timelineWidth;

            segments.push({
                left,
                width,
                gradient: `linear-gradient(to right, ${color1}, ${color2})`
            });
        }

        // Extend gradient to 100% if last keyframe is before the end
        const lastKeyframe = localKeyframes[localKeyframes.length - 1];
        if (lastKeyframe.time < 1) {
            const color = getKeyframeColor(lastKeyframe);
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
        return keyframe.time * timelineWidth;
    }

    function getKeyframePercentage(keyframe) {
        return (keyframe.time * 100).toFixed(0);
    }

    function selectKeyframe(index, buttonElement = null) {
        if (!animation) return;

        selectedKeyframeIndex = index;
        editButtonRef = buttonElement;

        // Show dialog after a brief delay to ensure keyframe is rendered
        requestAnimationFrame(() => {
            editDialog?.showModal();
        });
    }

    function closeEditDialog() {
        // Save changes to library when dialog closes
        if (selectedKeyframeIndex !== null) {
            animationLibrary.updateKeyframe(animation.id, selectedKeyframeIndex, {
                values: localKeyframes[selectedKeyframeIndex].values
            });

            if (onUpdate) onUpdate();
        }

        editDialog?.close();
        selectedKeyframeIndex = null;
        editButtonRef = null;
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

        // Use library method to remove keyframe
        animationLibrary.removeKeyframe(animation.id, index);

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
        const values = getValuesAtTime(animation, roundedTime);

        // Add new keyframe using library method
        animationLibrary.addKeyframe(animation.id, roundedTime, values);

        if (onUpdate) onUpdate();
        if (onUpdate) onUpdate();

        // Select the new keyframe for editing
        const newKeyframeIndex = animation.keyframes.findIndex(kf => Math.abs(kf.time - roundedTime) < 0.001);
        if (newKeyframeIndex !== -1) {
            // Wait for the DOM to update with double requestAnimationFrame to ensure render is complete
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const keypointElement = document.getElementById(`keyframe-${animation.order}-${newKeyframeIndex}`);
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

        isDragging = true;
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
        const firstKeyframe = localKeyframes[0];
        const lastKeyframe = localKeyframes[localKeyframes.length - 1];

        if (draggingKeyframe.index !== 0 && newTime === 0 && firstKeyframe.time === 0) {
            return;
        }
        if (draggingKeyframe.index !== localKeyframes.length - 1 && newTime === 1 && lastKeyframe.time === 1) {
            return;
        }

        // Update time in local keyframes only (for smooth dragging)
        draggingKeyframe.keyframe.time = newTime;

        // Re-sort local keyframes by time (create new array for proper reactivity)
        localKeyframes = [...localKeyframes].sort((a, b) => a.time - b.time);

        // Update the dragging index in case it changed due to sorting
        draggingKeyframe.index = localKeyframes.indexOf(draggingKeyframe.keyframe);

        if (Math.abs(deltaX) > 3) {
            hasActuallyDragged = true;
        }
    }

    function handleKeyframeMouseUp() {
        try {
            // Only save if we actually dragged
            if (draggingKeyframe && animation && hasActuallyDragged) {
                // Use library method to update the keyframe's time
                const newTime = draggingKeyframe.keyframe.time;
                animationLibrary.updateKeyframe(animation.id, draggingKeyframe.index, { time: newTime });
                
                if (onUpdate) onUpdate();
            }
        } finally {
            // Always cleanup event listeners and state
            isDragging = false;
            draggingKeyframe = null;
            document.removeEventListener('mousemove', handleKeyframeMouseMove);
            document.removeEventListener('mouseup', handleKeyframeMouseUp);
            hasActuallyDragged = false;
        }
    }
</script>

<div class="timeline-container">
    <div
        class="timeline"
        bind:this={timelineElement}
        bind:clientWidth={timelineWidth}
        onclick={handleTimelineClick}
        draggable="false"
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
                id="keyframe-{animation.order}-{index}"
                class="timeline-keyframe-marker"
                class:dragging={draggingKeyframe?.keyframe === keyframe}
                style="left: {getKeyframePosition(keyframe)}px; --keyframe-color: {getKeyframeColor(keyframe)}; anchor-name: --keyframe-{animation.order}-{index}"
                onmousedown={(e) => handleKeyframeMouseDown(e, keyframe, index)}
                onclick={(e) => {
                    e.stopPropagation();
                    // Only select if we didn't just drag
                    if (!hasActuallyDragged) {
                        selectKeyframe(index, e.currentTarget);
                    }
                }}
                draggable="false"
                title="{getKeyframePercentage(keyframe)}%"
            >
                <div class="keyframe-time">{getKeyframePercentage(keyframe)}%</div>
            </div>
        {/each}
    </div>
</div>

<!-- Keyframe Edit Dialog -->
{#if editButtonRef && animation && selectedKeyframeIndex !== null}
<Dialog
    bind:dialogRef={editDialog}
    anchored={true}
    anchorId={`keyframe-${animation.order}-${selectedKeyframeIndex}`}
    showArrow={true}
    lightDismiss={true}
    onclose={closeEditDialog}
    title="Keyframe at {(localKeyframes[selectedKeyframeIndex].time * 100).toFixed(0)}%"
>
    <Controls
        controls={getControlsForRendering(animation)}
        bind:values={localKeyframes[selectedKeyframeIndex].values}
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
