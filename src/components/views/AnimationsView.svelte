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
            {#each animationsList as animation (animation.name)}
                <div class="animation-card">
                    <div class="animation-header">
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
        overflow: hidden;
    }

    .animation-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        background: #e6e6e6;
        gap: 15px;
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
