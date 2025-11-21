<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { Animation } from '../../lib/animations.js';
    import { animationLibrary, deviceLibrary } from '../../lib/libraries.svelte.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import AnimationCard from '../cards/AnimationCard.svelte';
    import Button from '../common/Button.svelte';
    import AddAnimationDialog from '../dialogs/AddAnimationDialog.svelte';
    import EditAnimationDialog from '../dialogs/EditAnimationDialog.svelte';

    // Get data reactively
    let devices = $derived(deviceLibrary.getAll());
    let animations = $derived(animationLibrary.getAll());

    // Dialog references
    let addAnimationDialog;
    let editAnimationDialog;

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => animations,
        onReorder: (orderedIds) => {
            animationLibrary.reorder(orderedIds);
        },
        getItemId: (item) => item.id,
        dragByHeader: true,
        orientation: 'vertical'
    });

    async function openNewAnimationDialog() {
        const result = await addAnimationDialog.open();

        if (!result) return; // User cancelled

        // Parse selected target
        const parsed = parseAnimationTarget(result.target);
        const { controls, displayName } = parsed;

        // Create animation using library
        const animation = animationLibrary.create(result.name, controls, displayName);

        // Determine device type for initial keyframes
        const deviceType = getDeviceTypeForControls(controls);

        // Determine number of channels based on control selection
        const numChannels = Animation.getNumChannels(animation);
        const defaultValues = new Array(numChannels).fill(0);

        // Add default keyframes at start and end
        animationLibrary.addKeyframe(animation.id, 0, deviceType, defaultValues);
        animationLibrary.addKeyframe(animation.id, 1, deviceType, defaultValues);
    }

    // Get a device type that has the specified controls (for keyframe rendering)
    function getDeviceTypeForControls(controls) {
        for (const [deviceKey, deviceDef] of Object.entries(DEVICE_TYPES)) {
            const hasAllControls = controls.every(controlName =>
                deviceDef.controls.some(c => c.name === controlName)
            );
            if (hasAllControls) {
                return deviceKey;
            }
        }
        return 'RGB'; // Fallback
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
            animationLibrary.remove(animation.id);
            return;
        }

        // Handle update - library method handles reactivity
        if (result.name !== animation.name) {
            animationLibrary.update(animation.id, { name: result.name });
        }
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
            {#each animations as animation (animation.id)}
                <AnimationCard
                    {animation}
                    {dnd}
                    {animationLibrary}
                    onSettings={openEditDialog}
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
