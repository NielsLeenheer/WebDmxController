<script>
    import { getDevicePreviewData } from '../../lib/outputs/devices.js';
    import { deviceLibrary, animationLibrary, inputLibrary, triggerLibrary, sceneLibrary } from '../../stores.svelte.js';
    import { isButton, hasValues } from '../../lib/inputs/utils.js';
    import { getInputTypeForInput } from '../../lib/inputs/types/index.js';
    import { AUDIO_BANDS } from '../../lib/inputs/devices/AudioInputDevice.js';
    import Preview from '../common/Preview.svelte';
    import CodeEditor from '../common/CodeEditor.svelte';
    import TabBar from '../common/TabBar.svelte';
    import IconButton from '../common/IconButton.svelte';
    import ContextMenu from '../common/ContextMenu.svelte';
    import ContextAction from '../common/ContextAction.svelte';
    import { css } from '@codemirror/lang-css';

    import dotsIcon from '../../assets/glyphs/dots.svg?raw';
    import openIcon from '../../assets/icons/open.svg?raw';
    import saveIcon from '../../assets/icons/save.svg?raw';

    let {
        cssManager,
        sceneController,
        laserManager = null
    } = $props();

    // Tab state
    let activeTab = $state('custom');
    let menuRef = $state(null);
    let menuButtonRef = $state(null);

    // Get data reactively
    let devices = $derived(deviceLibrary.getAll());
    let sampledDeviceData = $state(new Map());

    let animations = $derived(animationLibrary ? animationLibrary.getAll() : []);
    let inputs = $derived(inputLibrary ? inputLibrary.getAll() : []);
    let scenes = $derived(sceneLibrary ? sceneLibrary.getAll() : []);
    let activeScene = $derived(sceneController?.getActiveScene());

    let generatedCSS = $derived(cssManager?.generatedCSSReactive || '');
    let customCSS = $state(cssManager?.customCSS || '');

    // Sync customCSS when cssManager becomes available
    $effect(() => {
        if (cssManager?.customCSS !== undefined) {
            customCSS = cssManager.customCSS;
        }
    });

    let independentDevices = $derived(
        devices.filter(device => !device.linkedTo || device.syncedControls !== null)
    );

    // Group inputs by device for the reference panel
    let inputGroups = $derived(() => {
        const groups = [];
        const deviceMap = new Map();
        for (const input of inputs) {
            const key = input.deviceId || '_ungrouped';
            if (!deviceMap.has(key)) {
                const group = { deviceName: input.deviceName || null, inputs: [] };
                deviceMap.set(key, group);
                groups.push(group);
            }
            deviceMap.get(key).inputs.push(input);
        }
        return groups;
    });

    function handleCustomCSSInput(newContent) {
        customCSS = newContent;
        if (cssManager) {
            cssManager.updateCustomCSS(newContent);
        }
    }

    // Subscribe to CSS sampling updates
    $effect(() => {
        if (!cssManager) return;
        const unsubscribe = cssManager.subscribe((sampledValues) => {
            sampledDeviceData = sampledValues;
        });
        return unsubscribe;
    });

    function getPreviewData(device) {
        const controlValues = sampledDeviceData.get(device.id);
        if (!controlValues || Object.keys(controlValues).length === 0) {
            return getDevicePreviewData(device.type, device.defaultValues);
        }
        return getDevicePreviewData(device.type, controlValues);
    }

    // Save/Load custom CSS
    function saveCSS() {
        const blob = new Blob([customCSS], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'custom.css';
        a.click();
        URL.revokeObjectURL(url);
    }

    function loadCSS() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.css';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                customCSS = reader.result;
                if (cssManager) cssManager.updateCustomCSS(customCSS);
            };
            reader.readAsText(file);
        };
        input.click();
    }
</script>

<div class="editor-view">
    <!-- Editor (full width, with right padding for preview overlap) -->
    <div class="editor-column">
        <div class="column-header">
            <TabBar
                tabs={[
                    { id: 'default', label: 'Default' },
                    { id: 'custom', label: 'Custom' }
                ]}
                bind:activeTab
            />

            <div class="header-kebab">
                <IconButton
                    bind:buttonRef={menuButtonRef}
                    icon={dotsIcon}
                    onclick={() => menuRef?.show(null, menuButtonRef)}
                    title="Options"
                    size="small"
                />
            </div>
        </div>

        <div class="editor-area">
            {#if activeTab === 'default'}
                <CodeEditor
                    value={generatedCSS}
                    language={css()}
                    readonly={true}
                />
            {:else}
                <CodeEditor
                    bind:value={customCSS}
                    language={css()}
                    oninput={handleCustomCSSInput}
                />
            {/if}
        </div>
    </div>

    <!-- Reference panel (overlapping, positioned absolutely) -->
    <div class="reference-panel">
        <div class="reference-card">
            {#if independentDevices.length > 0}
                <div class="reference-section">
                    <h4>Devices</h4>
                    <div class="device-previews">
                        {#each independentDevices as device (device.id)}
                            {@const previewData = getPreviewData(device)}
                            <div class="device-preview-item">
                                <Preview
                                    type="controls"
                                    size="large"
                                    controls={previewData.controls}
                                    data={previewData.data}
                                    title={device.name}
                                    {laserManager}
                                />
                                <code class="device-id">#{device.cssIdentifier}</code>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if animations.length > 0}
                <div class="reference-section">
                    <h4>Animations</h4>
                    <div class="css-identifiers">
                        {#each animations as animation (animation.id)}
                            <code class="css-identifier">{animation.cssIdentifier}</code>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if scenes.length > 0}
                <div class="reference-section">
                    <h4>Scenes</h4>
                    <div class="css-identifiers">
                        {#each scenes as scene (scene.id)}
                            <code class="css-identifier" class:active={activeScene?.id === scene.id}>[scene="{scene.cssIdentifier}"]</code>
                        {/each}
                    </div>
                </div>
            {/if}

            {#each inputGroups() as group}
                <div class="reference-section">
                    <h4>{group.deviceName || 'Inputs'}</h4>
                    <div class="css-identifiers">
                        {#each group.inputs as input (input.id)}
                            {#if input.type === 'audio'}
                                {#each AUDIO_BANDS as band}
                                    <code class="css-identifier">.{input.cssIdentifier}-{band.id}</code>
                                {/each}
                                {#each AUDIO_BANDS as band}
                                    <code class="css-identifier">--{input.cssIdentifier}-{band.id}</code>
                                {/each}
                                <code class="css-identifier">--{input.cssIdentifier}-volume</code>
                            {:else if isButton(input)}
                                {#if input.buttonMode === 'toggle'}
                                    <code class="css-identifier">.{input.cssIdentifier}-on</code>
                                    <code class="css-identifier">.{input.cssIdentifier}-off</code>
                                {:else if input.buttonMode === 'beat'}
                                    <code class="css-identifier">.{input.cssIdentifier}-beat</code>
                                {:else}
                                    <code class="css-identifier">.{input.cssIdentifier}-down</code>
                                    <code class="css-identifier">.{input.cssIdentifier}-up</code>
                                {/if}
                                {#if hasValues(input)}
                                    {#each getInputTypeForInput(input).getExportedValues(input) as val}
                                        <code class="css-identifier">{val.cssProperty}</code>
                                    {/each}
                                {/if}
                            {:else if hasValues(input)}
                                {#each getInputTypeForInput(input).getExportedValues(input) as val}
                                    <code class="css-identifier">{val.cssProperty}</code>
                                {/each}
                            {:else}
                                <code class="css-identifier">--{input.cssIdentifier}</code>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<ContextMenu bind:contextRef={menuRef}>
    <ContextAction onclick={loadCSS} disabled={activeTab !== 'custom'}>{@html openIcon} Load CSS</ContextAction>
    <ContextAction onclick={saveCSS} disabled={activeTab !== 'custom'}>{@html saveIcon} Save CSS</ContextAction>
</ContextMenu>

<style>
    .editor-view {
        position: relative;
        height: 100%;
        overflow: hidden;
    }

    .editor-column {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .column-header {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px 40px;
        padding-right: 364px;
        position: relative;
    }

    .header-kebab {
        position: absolute;
        right: 40px;
    }

    .editor-area {
        flex: 1;
        overflow: hidden;
        padding: 0 0 0 40px;
    }

    /* Right padding inside CodeMirror so text doesn't go under the preview panel */
    .editor-area :global(.cm-content) {
        padding-right: 324px !important;
    }

    /* Reference panel - overlapping, positioned on the right */
    .reference-panel {
        position: absolute;
        top: 68px;
        right: 40px;
        bottom: 40px;
        width: 264px;
        padding: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
    }

    .reference-card {
        background: #f0f0f0;
        backdrop-filter: blur(8px);
        border-radius: 8px;
        overflow: hidden;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        flex: 1;
        pointer-events: auto;
    }

    .reference-section {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
    }

    .reference-section:last-child {
        border-bottom: none;
    }

    .reference-section h4 {
        margin: 0 0 15px 0;
        font-size: 8pt;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .reference-section .css-identifiers {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .reference-section .css-identifiers code {
        font-size: 8pt;
    }

    .css-identifier.active {
        font-weight: 700;
        color: #1565c0;
    }

    .device-previews {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .device-preview-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
    }

    .device-id {
        font-family: var(--font-stack-mono);
        font-size: 8pt;
        color: #007acc;
        text-align: center;
    }
</style>
