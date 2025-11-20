<script>
    import { onMount } from 'svelte';
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import DraggableCard from '../common/DraggableCard.svelte';
    import CardHeader from '../common/CardHeader.svelte';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Preview from '../common/Preview.svelte';
    import TimelineEditor from '../animations/TimelineEditor.svelte';
    import AddAnimationDialog from '../dialogs/AddAnimationDialog.svelte';
    import EditAnimationDialog from '../dialogs/EditAnimationDialog.svelte';
    import editIcon from '../../assets/glyphs/edit.svg?raw';

    let {
        animationLibrary,
        deviceLibrary
    } = $props();

    // Get devices reactively - automatic thanks to $state in library!
    let devices = $derived(deviceLibrary.getAll());

    let animationsList = $state([]);

    // Dialog references
    let addAnimationDialog;
    let editAnimationDialog;

    // Load animations from library
    function refreshAnimationsList() {
        animationsList = animationLibrary.getAll();
    }

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => animationsList,
        onReorder: (newAnimations) => {
            animationsList = newAnimations;
            animationLibrary.reorder(newAnimations);
        },
        getItemId: (item) => item.name,
        dragByHeader: true,
        orientation: 'vertical'
    });

    // Initialize on mount
    onMount(() => {
        refreshAnimationsList();
    });

    async function openNewAnimationDialog() {
        const result = await addAnimationDialog.open();

        if (!result) return; // User cancelled

        // Parse selected target
        const parsed = parseAnimationTarget(result.target);
        const { controls, displayName } = parsed;

        // Create animation with controls array (no deviceType stored)
        const animation = new Animation(result.name, null, [], null, controls, displayName);

        // Determine number of channels based on control selection
        const numChannels = animation.getNumChannels();
        const defaultValues = new Array(numChannels).fill(0);

        // Add default keyframes at start and end
        animation.addKeyframe(0, [...defaultValues]);
        animation.addKeyframe(1, [...defaultValues]);

        animationLibrary.add(animation);
        refreshAnimationsList();
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

    async function openEditDialog(animation) {
        const result = await editAnimationDialog.open(animation);

        if (!result) return; // User cancelled

        if (result.delete) {
            // Handle delete
            animationLibrary.remove(animation.name);
            refreshAnimationsList();
            return;
        }

        // Handle save
        animation.name = result.name;
        animation.updateCSSName();
        animation.version = (animation.version || 0) + 1;
        animationLibrary.save();
        refreshAnimationsList();
    }

    function handleAnimationUpdate(animation) {
        animation.version = (animation.version || 0) + 1;
        animationLibrary.save();
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
            {#each animationsList as animation, index (`${animation.name}-${animation.version}`)}
                <DraggableCard {dnd} item={animation} {index} class="animation-card">
                    <CardHeader>
                        <Preview
                            type="animation"
                            size="medium"
                            data={{ color: getAnimationPreview(animation) }}
                        />
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
                    </CardHeader>

                    <TimelineEditor
                        {animation}
                        {animationLibrary}
                        onUpdate={() => handleAnimationUpdate(animation)}
                    />
                </DraggableCard>
            {/each}
        {/if}
    </div>
</div>

<!-- Add Animation Dialog -->
<AddAnimationDialog
    bind:this={addAnimationDialog}
/>

<!-- Edit Animation Dialog -->
<EditAnimationDialog
    bind:this={editAnimationDialog}
/>

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

    :global(.animation-card) {
        width: 80vw;
    }

    :global(.animation-card) .animation-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    :global(.animation-card) .animation-info h3 {
        margin: 0;
        font-size: 11pt;
        color: #333;
    }

    :global(.animation-card) .badges {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    :global(.animation-card) .target-badge {
        background: #f6f6f6;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 9pt;
        font-weight: 500;
        box-shadow: 0px 2px 0px rgba(0,0,0,0.2)
    }

    .help-text {
        display: block;
        margin-top: 4px;
        font-size: 9pt;
        color: #888;
    }
</style>
