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
    let selectedAnimationTarget = $state('RGB|all'); // Format: "deviceType|all" or "deviceType|control|ControlName"

    // Edit dialog states
    let editDialog = null; // DOM reference - should NOT be $state
    let editingAnimation = $state(null);
    let editingName = $state('');

    // Animation version for forcing re-renders
    let animationVersion = $state(0);

    // Drag and drop state
    let draggedAnimation = $state(null);
    let draggedIndex = $state(null);
    let dragOverIndex = $state(null);
    let isAfterMidpoint = $state(false);

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

    function handleDragStart(event, animation) {
        // Only allow dragging if initiated from the header
        if (!event.target.closest('.animation-header')) {
            event.preventDefault();
            return;
        }
        draggedAnimation = animation;
        draggedIndex = animationsList.findIndex(a => a.name === animation.name);
        event.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(event, index) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dragOverIndex = index;

        // Calculate if mouse is in the second half of the card (vertically)
        const rect = event.currentTarget.getBoundingClientRect();
        const mouseY = event.clientY;
        const cardMidpoint = rect.top + rect.height / 2;
        isAfterMidpoint = mouseY > cardMidpoint;
    }

    function isDragAfter(index) {
        return dragOverIndex === index && isAfterMidpoint;
    }

    function handleDragLeave() {
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDrop(event, targetIndex) {
        event.preventDefault();

        if (!draggedAnimation) return;

        const currentIndex = animationsList.findIndex(a => a.name === draggedAnimation.name);
        if (currentIndex === -1) {
            draggedAnimation = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Adjust target index based on whether we're inserting after the midpoint
        let insertIndex = targetIndex;
        if (isAfterMidpoint) {
            insertIndex = targetIndex + 1;
        }

        // If dragging from before to after in the same position, no change needed
        if (currentIndex === insertIndex || currentIndex === insertIndex - 1) {
            draggedAnimation = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Reorder the array
        const newAnimations = [...animationsList];
        const [removed] = newAnimations.splice(currentIndex, 1);
        // Adjust insert position if we removed an item before it
        const finalInsertIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
        newAnimations.splice(finalInsertIndex, 0, removed);
        animationsList = newAnimations;

        // Update the animation library order
        animationLibrary.animations.clear();
        newAnimations.forEach(a => {
            animationLibrary.animations.set(a.name, a);
        });
        animationLibrary.save();

        draggedAnimation = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDragEnd() {
        draggedAnimation = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    // Initialize on mount
    onMount(() => {
        refreshAnimationsList();
    });

    function openNewAnimationDialog() {
        newAnimationName = '';
        selectedAnimationTarget = 'control|Color'; // Default to Color control
        newAnimationDialog?.showModal();
    }

    // Build complete list of animation targets (controls + device types)
    function getAllAnimationTargets() {
        const targets = [];

        // First, collect all unique control names across all device types
        const controlNamesSet = new Set();
        for (const deviceDef of Object.values(DEVICE_TYPES)) {
            for (const control of deviceDef.controls) {
                controlNamesSet.add(control.name);
            }
        }

        // Add individual controls (device-agnostic)
        const sortedControlNames = Array.from(controlNamesSet).sort();
        for (const controlName of sortedControlNames) {
            targets.push({
                type: 'control',
                value: `control|${controlName}`,
                label: controlName
            });
        }

        // Add separator
        targets.push({ type: 'separator' });

        // Add device types (all controls)
        for (const [deviceKey, deviceDef] of Object.entries(DEVICE_TYPES)) {
            targets.push({
                type: 'device',
                value: `device|${deviceKey}`,
                label: deviceDef.name
            });
        }

        return targets;
    }

    // Parse selected target into controls array and displayName
    function parseAnimationTarget(target) {
        const parts = target.split('|');
        const targetType = parts[0];

        if (targetType === 'control') {
            // Single control (device-agnostic)
            const controlName = parts[1];
            return {
                controls: [controlName],
                displayName: controlName
            };
        } else if (targetType === 'device') {
            // All controls for this device type
            const deviceType = parts[1];
            const deviceDef = DEVICE_TYPES[deviceType];
            const controlNames = deviceDef.controls.map(c => c.name);
            return {
                controls: controlNames,  // Array of all control names from this device
                displayName: deviceDef.name
            };
        }

        // Fallback
        return {
            controls: ['Color'],
            displayName: 'Color'
        };
    }

    function createNewAnimation() {
        if (!newAnimationName.trim()) return;

        // Parse selected target
        const parsed = parseAnimationTarget(selectedAnimationTarget);
        const { controls, displayName } = parsed;

        // Create animation with controls array (no deviceType stored)
        const animation = new Animation(newAnimationName.trim(), null, [], null, controls, displayName);

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

    // Generate preview of CSS animation name for new animation
    function getNewAnimationCSSName() {
        if (!newAnimationName.trim()) return '';

        const cssName = newAnimationName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

        return cssName;
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

    // Generate preview gradient for animation
    function getAnimationPreview(animation) {
        // Check if animation has color-related controls
        const hasColor = animation.controls && (
            animation.controls.includes('Color') ||
            animation.controls.includes('Amber') ||
            animation.controls.includes('White')
        );

        if (!hasColor || !animation.keyframes || animation.keyframes.length === 0) {
            return '#888';
        }

        // Get control and component data for the animation
        const { controls, components } = animation.getControlsForRendering();

        // Extract colors from each keyframe
        const colors = animation.keyframes.map(keyframe => {
            const values = keyframe.values || [];

            // Find Color control
            const colorControl = controls.find(c => c.name === 'Color' && c.type === 'rgb');
            let r = 0, g = 0, b = 0;

            if (colorControl) {
                const rIdx = colorControl.components.r;
                const gIdx = colorControl.components.g;
                const bIdx = colorControl.components.b;
                r = values[rIdx] || 0;
                g = values[gIdx] || 0;
                b = values[bIdx] || 0;
            }

            // Add Amber if present
            const amberControl = controls.find(c => c.name === 'Amber' && c.type === 'slider');
            if (amberControl) {
                const amberIdx = amberControl.components.value;
                const amber = values[amberIdx] || 0;
                // Amber is #FFBF00 - adds to red and green
                r = Math.min(255, r + (255 * amber / 255));
                g = Math.min(255, g + (191 * amber / 255));
            }

            // Add White if present
            const whiteControl = controls.find(c => c.name === 'White' && c.type === 'slider');
            if (whiteControl) {
                const whiteIdx = whiteControl.components.value;
                const white = values[whiteIdx] || 0;
                // White adds equally to all channels
                r = Math.min(255, r + white);
                g = Math.min(255, g + white);
                b = Math.min(255, b + white);
            }

            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        });

        // Create stepped gradient with equal steps
        const numSteps = colors.length;
        const stepSize = 100 / numSteps;

        const gradientStops = colors.map((color, index) => {
            const start = index * stepSize;
            const end = (index + 1) * stepSize;
            return `${color} ${start}% ${end}%`;
        }).join(', ');

        return `linear-gradient(90deg, ${gradientStops})`;
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
            {#each animationsList as animation, index (animation.name)}
                <div
                    class="animation-card"
                    class:dragging={draggedAnimation?.name === animation.name}
                    class:drag-over={dragOverIndex === index && !isAfterMidpoint}
                    class:drag-after={isDragAfter(index)}
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, animation)}
                    ondragover={(e) => handleDragOver(e, index)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, index)}
                    ondragend={handleDragEnd}
                >
                    <div class="animation-header">
                        <div
                            class="animation-preview"
                            style="background: {getAnimationPreview(animation)}"
                        ></div>
                        <div class="animation-info">
                            <h3>{animation.name}</h3>
                            <div class="badges">
                                <div class="target-badge">{animation.getDisplayName()}</div>
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
            <div class="css-identifiers">
                <code class="css-identifier">@keyframes {getNewAnimationCSSName()}</code>
            </div>
        </div>

        <div class="dialog-input-group">
            <label for="animation-target">Target:</label>
            <select id="animation-target" bind:value={selectedAnimationTarget} class="animation-target-select">
                {#each getAllAnimationTargets() as target}
                    {#if target.type === 'separator'}
                        <option disabled>──────────</option>
                    {:else}
                        <option value={target.value}>{target.label}</option>
                    {/if}
                {/each}
            </select>
            <small class="help-text">Select a specific control or entire device type</small>
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
            <div class="css-identifiers">
                <code class="css-identifier">@keyframes {getPreviewCSSName()} &lbrace; &rbrace;</code>
            </div>
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
        padding: 20px;
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
        cursor: grab;
        transition: opacity 0.2s, transform 0.2s;
    }

    .animation-card:active {
        cursor: grabbing;
    }

    .animation-card.dragging {
        opacity: 0.4;
    }

    .animation-card.drag-over {
        position: relative;
    }

    .animation-card.drag-over::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: -10px;
        height: 4px;
        background: #2196F3;
        border-radius: 2px;
    }

    .animation-card.drag-after::before {
        top: auto;
        bottom: -10px;
    }

    .animation-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        background: #e6e6e6;
        gap: 15px;
        border-radius: 8px 8px 0 0;
        cursor: grab;
    }

    .animation-header:active {
        cursor: grabbing;
    }

    .animation-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
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

    .target-badge {
        background: #e3f2fd;
        color: #1976d2;
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
