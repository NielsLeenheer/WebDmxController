<script>
    import { Animation } from '../../lib/animations.js';
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import AnimationCard from '../cards/AnimationCard.svelte';
    import Button from '../common/Button.svelte';
    import AddAnimationDialog from '../dialogs/AddAnimationDialog.svelte';
    import EditAnimationDialog from '../dialogs/EditAnimationDialog.svelte';

    let {
        animationLibrary,
        deviceLibrary
    } = $props();

    // Get data reactively
    let devices = $derived(deviceLibrary.getAll());
    let animations = $derived(animationLibrary.getAll());

    // Dialog references
    let addAnimationDialog;
    let editAnimationDialog;

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => animations,
        onReorder: (orderedNames) => {
            animationLibrary.reorder(orderedNames);
        },
        getItemId: (item) => item.name,
        dragByHeader: true,
        orientation: 'vertical'
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
            animationLibrary.remove(animation.name);
            return;
        }

        // Handle save - reactivity handles updates
        animation.name = result.name;
        animation.updateCSSName();
        animation.version = (animation.version || 0) + 1;
        animationLibrary.save();
    }

    function handleAnimationUpdate(animation) {
        animation.version = (animation.version || 0) + 1;
        animationLibrary.save();
    }
</script>

<div class="animations-view">
    <div class="add-animation-section">
        <Button onclick={openNewAnimationDialog} variant="secondary">
            Add Animation
        </Button>
    </div>

    <div class="animations-list">
        {#if animations.length === 0}
            <div class="empty-state">
                <p>No animations yet. Create one to get started!</p>
            </div>
        {:else}
            {#each animations as animation (`${animation.name}-${animation.version}`)}
                <AnimationCard
                    {animation}
                    {dnd}
                    {animationLibrary}
                    onSettings={openEditDialog}
                    onUpdate={handleAnimationUpdate}
                />
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
</style>
