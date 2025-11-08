<script>
    import { Animation } from '../../lib/animations.js';
    import Button from '../common/Button.svelte';
    import Dialog from '../common/Dialog.svelte';
    import IconButton from '../common/IconButton.svelte';

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
    let deleteConfirmDialog = $state(null);
    let animationToDelete = $state(null);

    // Keyframe editing
    let editingKeyframeTime = $state(0);
    let editingKeyframeColor = $state('#ffffff');
    let editingKeyframeOpacity = $state('1');
    let editingKeyframeTranslate = $state('0% 0%');

    // Load animations from library
    function refreshAnimationsList() {
        animationsList = animationLibrary.getAll();
        // If selected animation was deleted, clear selection
        if (selectedAnimation && !animationsList.find(a => a.name === selectedAnimation.name)) {
            selectedAnimation = null;
            selectedKeyframeIndex = null;
        }
    }

    // Initialize
    $effect(() => {
        refreshAnimationsList();
    });

    function selectAnimation(animation) {
        selectedAnimation = animation;
        selectedKeyframeIndex = null;
    }

    function openNewAnimationDialog() {
        newAnimationName = '';
        newAnimationDialog?.showModal();
    }

    function createNewAnimation() {
        if (!newAnimationName.trim()) return;

        const animation = new Animation(newAnimationName.trim());
        // Add default keyframes
        animation.addKeyframe(0, { color: 'rgb(255, 255, 255)' });
        animation.addKeyframe(1, { color: 'rgb(255, 255, 255)' });

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

    function addKeyframe() {
        if (!selectedAnimation) return;

        // Find a good time position (middle of largest gap)
        const times = selectedAnimation.keyframes.map(kf => kf.time).sort((a, b) => a - b);
        let newTime = 0.5;

        if (times.length > 0) {
            let maxGap = times[0];
            newTime = maxGap / 2;

            for (let i = 0; i < times.length - 1; i++) {
                const gap = times[i + 1] - times[i];
                if (gap > maxGap) {
                    maxGap = gap;
                    newTime = times[i] + gap / 2;
                }
            }

            const lastGap = 1 - times[times.length - 1];
            if (lastGap > maxGap) {
                newTime = times[times.length - 1] + lastGap / 2;
            }
        }

        selectedAnimation.addKeyframe(newTime, { color: 'rgb(255, 255, 255)' });
        animationLibrary.save();
        refreshAnimationsList();
        // Reselect to update reference
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
    }

    function deleteKeyframe(index) {
        if (!selectedAnimation || selectedAnimation.keyframes.length <= 2) {
            alert('Animation must have at least 2 keyframes');
            return;
        }

        selectedAnimation.keyframes.splice(index, 1);
        animationLibrary.save();
        refreshAnimationsList();
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
        selectedKeyframeIndex = null;
    }

    function selectKeyframe(index) {
        if (!selectedAnimation) return;

        selectedKeyframeIndex = index;
        const keyframe = selectedAnimation.keyframes[index];

        // Load keyframe values into editor
        editingKeyframeTime = keyframe.time;
        editingKeyframeColor = keyframe.properties.color || '#ffffff';
        editingKeyframeOpacity = keyframe.properties.opacity || '1';
        editingKeyframeTranslate = keyframe.properties.translate || '0% 0%';
    }

    function updateKeyframeTime() {
        if (!selectedAnimation || selectedKeyframeIndex === null) return;

        const keyframe = selectedAnimation.keyframes[selectedKeyframeIndex];
        keyframe.time = Math.max(0, Math.min(1, editingKeyframeTime));

        // Re-sort keyframes
        selectedAnimation.keyframes.sort((a, b) => a.time - b.time);

        animationLibrary.save();
        refreshAnimationsList();
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
    }

    function updateKeyframeProperty(property, value) {
        if (!selectedAnimation || selectedKeyframeIndex === null) return;

        const keyframe = selectedAnimation.keyframes[selectedKeyframeIndex];

        if (value === null || value === undefined || value === '') {
            delete keyframe.properties[property];
        } else {
            keyframe.properties[property] = value;
        }

        animationLibrary.save();
        refreshAnimationsList();
        selectedAnimation = animationLibrary.get(selectedAnimation.name);
    }

    function previewAnimation() {
        if (!selectedAnimation || !previewElement) return;

        // Apply animation to preview element
        previewElement.style.animation = 'none';
        setTimeout(() => {
            previewElement.style.animation = `${selectedAnimation.name} 3s linear infinite`;
        }, 10);
    }

    // Generate CSS for preview
    let previewCSS = $derived(selectedAnimation ? selectedAnimation.toCSS() : '');
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
                <div class="header-actions">
                    <Button onclick={addKeyframe}>Add Keyframe</Button>
                    <Button onclick={previewAnimation}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Preview
                    </Button>
                </div>
            </div>

            <div class="timeline-container">
                <div class="timeline">
                    <div class="timeline-track">
                        {#each selectedAnimation.keyframes as keyframe, index}
                            {@const percent = keyframe.time * 100}
                            <div
                                class="timeline-keyframe"
                                class:selected={selectedKeyframeIndex === index}
                                style="left: {percent}%"
                                onclick={() => selectKeyframe(index)}
                            >
                                <div class="keyframe-marker"></div>
                                <div class="keyframe-time">{(keyframe.time * 100).toFixed(0)}%</div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            {#if selectedKeyframeIndex !== null}
                <div class="keyframe-editor">
                    <h4>Keyframe Properties</h4>

                    <div class="property-group">
                        <label for="keyframe-time">Time (0-1):</label>
                        <input
                            id="keyframe-time"
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            bind:value={editingKeyframeTime}
                            oninput={updateKeyframeTime}
                        />
                    </div>

                    <div class="property-group">
                        <label for="keyframe-color">Color:</label>
                        <div class="color-input-group">
                            <input
                                id="keyframe-color"
                                type="color"
                                value={editingKeyframeColor}
                                oninput={(e) => {
                                    editingKeyframeColor = e.target.value;
                                    const hex = e.target.value;
                                    const r = parseInt(hex.slice(1, 3), 16);
                                    const g = parseInt(hex.slice(3, 5), 16);
                                    const b = parseInt(hex.slice(5, 7), 16);
                                    updateKeyframeProperty('color', `rgb(${r}, ${g}, ${b})`);
                                }}
                            />
                            <input
                                type="text"
                                value={editingKeyframeColor}
                                oninput={(e) => {
                                    editingKeyframeColor = e.target.value;
                                    updateKeyframeProperty('color', e.target.value);
                                }}
                                placeholder="rgb(255, 255, 255)"
                            />
                        </div>
                    </div>

                    <div class="property-group">
                        <label for="keyframe-opacity">Opacity (0-1):</label>
                        <input
                            id="keyframe-opacity"
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            bind:value={editingKeyframeOpacity}
                            oninput={(e) => updateKeyframeProperty('opacity', e.target.value)}
                        />
                    </div>

                    <div class="property-group">
                        <label for="keyframe-translate">Translate (pan/tilt):</label>
                        <input
                            id="keyframe-translate"
                            type="text"
                            bind:value={editingKeyframeTranslate}
                            oninput={(e) => updateKeyframeProperty('translate', e.target.value)}
                            placeholder="0% 0%"
                        />
                        <small>Format: x% y% (e.g., "50% 25%")</small>
                    </div>

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
                <p class="empty-state">Select a keyframe to edit its properties</p>
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
<Dialog bind:this={newAnimationDialog}>
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

        <div class="dialog-buttons">
            <Button type="button" onclick={() => newAnimationDialog?.close()}>Cancel</Button>
            <Button type="submit" primary>Create</Button>
        </div>
    </form>
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog bind:this={deleteConfirmDialog}>
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

    .timeline-container {
        padding: 20px;
        border-bottom: 1px solid #ddd;
    }

    .timeline {
        position: relative;
        height: 60px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .timeline-track {
        position: relative;
        height: 100%;
    }

    .timeline-keyframe {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        z-index: 1;
    }

    .keyframe-marker {
        width: 12px;
        height: 12px;
        background: #2196f3;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        margin: 0 auto;
    }

    .timeline-keyframe.selected .keyframe-marker {
        background: #ff9800;
        width: 16px;
        height: 16px;
    }

    .keyframe-time {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 5px;
        font-size: 8pt;
        color: #666;
        white-space: nowrap;
    }

    .keyframe-editor {
        padding: 20px;
        overflow-y: auto;
    }

    .keyframe-editor h4 {
        margin: 0 0 15px 0;
        font-size: 11pt;
    }

    .property-group {
        margin-bottom: 15px;
    }

    .property-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        font-size: 10pt;
    }

    .property-group input[type="number"],
    .property-group input[type="text"] {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 10pt;
    }

    .color-input-group {
        display: flex;
        gap: 10px;
    }

    .color-input-group input[type="color"] {
        width: 60px;
        height: 38px;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
    }

    .color-input-group input[type="text"] {
        flex: 1;
    }

    .property-group small {
        display: block;
        margin-top: 5px;
        font-size: 9pt;
        color: #888;
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

    .dialog-field input {
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
