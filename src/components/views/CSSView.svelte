<script>
    import { onMount } from 'svelte';
    import { getDevicePreviewData } from '../../lib/outputs/devices.js';
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { deviceLibrary, animationLibrary, inputLibrary, triggerLibrary } from '../../stores.svelte.js';
    import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
    import Preview from '../common/Preview.svelte';

    let {
        cssManager
    } = $props();

    // Get devices reactively from library
    let devices = $derived(deviceLibrary.getAll());

    // Store sampled device data (Map of deviceId -> channels object)
    let sampledDeviceData = $state(new Map());

    // Get animations for display (reactive)
    let animations = $derived(
        animationLibrary ? animationLibrary.getAll() : []
    );

    // Get inputs for display (reactive)
    let inputs = $derived(
        inputLibrary ? inputLibrary.getAll() : []
    );

    // Get triggers for tracking changes (reactive)
    let triggers = $derived(
        triggerLibrary ? triggerLibrary.getAll() : []
    );

    // Get CSS from manager (re-evaluated when library data changes)
    let generatedCSS = $derived.by(() => {
        // Access library arrays to subscribe to changes
        animations.length;
        inputs.length;
        triggers.length;
        devices.length;
        return cssManager?.generatedCSS || '';
    });
    let customCSS = $derived(cssManager?.customCSS || '');

    // Filter devices to only show those with independent controls
    // A device has independent controls if:
    // - It's not linked to another device (linkedTo === null), OR
    // - It's linked but not all controls are synced (syncedControls !== null)
    let independentDevices = $derived(
        devices.filter(device => !device.linkedTo || device.syncedControls !== null)
    );

    function handleCustomCSSInput(event) {
        // Read the content from the contenteditable element
        const newContent = event.target.textContent;

        // Update custom CSS via manager
        if (cssManager) {
            cssManager.updateCustomCSS(newContent);
        }
    }

    // Subscribe to CSS sampling updates
    $effect(() => {
        if (!cssManager) return;

        // Subscribe to sampled values and store them directly
        const unsubscribe = cssManager.subscribe((sampledValues) => {
            sampledDeviceData = sampledValues;
        });

        // Cleanup subscription on destroy or when cssManager changes
        return unsubscribe;
    });

    /**
     * Convert component values from CSS sampler to control values
     * The CSS sampler returns component values like { Red: 255, Green: 0, Blue: 0 }
     * We need to convert to control values like { "Color": { r: 255, g: 0, b: 0 } }
     */
    function convertComponentsToControlValues(deviceType, componentValues) {
        const controlValues = {};
        const deviceTypeDef = DEVICE_TYPES[deviceType];
        if (!deviceTypeDef) return controlValues;

        // Map components back to controls
        for (const control of deviceTypeDef.controls) {
            if (control.type.type === 'rgb' || control.type.type === 'rgba') {
                // RGB control - gather r, g, b from component values
                controlValues[control.name] = {
                    r: componentValues.Red ?? 0,
                    g: componentValues.Green ?? 0,
                    b: componentValues.Blue ?? 0
                };
            } else if (control.type.type === 'xypad' || control.type.type === 'xypad16') {
                // XY Pad control
                controlValues[control.name] = {
                    x: componentValues.Pan ?? 128,
                    y: componentValues.Tilt ?? 128
                };
            } else if (control.type.type === 'slider' || control.type.type === 'toggle') {
                // Slider/Toggle control - direct mapping by control name
                if (componentValues[control.name] !== undefined) {
                    controlValues[control.name] = componentValues[control.name];
                }
            }
        }

        return controlValues;
    }

    // Get preview data for a device
    function getPreviewData(device) {
        const componentValues = sampledDeviceData.get(device.id);
        if (!componentValues) {
            // Use default values if no sampled data
            return getDevicePreviewData(device.type, device.defaultValues);
        }

        // Convert component values to control values for preview
        const controlValues = convertComponentsToControlValues(device.type, componentValues);
        return getDevicePreviewData(device.type, controlValues);
    }
</script>

<div class="css-view">
    <div class="left-column">
        <div class="reference-card">
            <!-- Devices Section -->
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
                                />
                                <code class="device-id">#{device.cssId}</code>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Animations Section -->
            {#if animations.length > 0}
                <div class="reference-section">
                    <h4>Animations</h4>
                    <div class="css-identifiers">
                        {#each animations as animation (animation.name)}
                            <code class="css-identifier">{animation.cssName}</code>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Inputs Section -->
            {#if inputs.length > 0}
                <div class="reference-section">
                    <h4>Inputs</h4>
                    <div class="css-identifiers">
                        {#each inputs as input (input.id)}
                            {#if isButton(input)}
                                <!-- Buttons show classes based on mode -->
                                {#if input.buttonMode === 'toggle'}
                                    <!-- Toggle buttons show on and off classes -->
                                    <code class="css-identifier">.{input.cssClassOn}</code>
                                    <code class="css-identifier">.{input.cssClassOff}</code>
                                {:else}
                                    <!-- Momentary buttons show down and up classes -->
                                    <code class="css-identifier">.{input.cssClassDown}</code>
                                    <code class="css-identifier">.{input.cssClassUp}</code>
                                {/if}
                            {:else}
                                <!-- Sliders/Knobs show custom property -->
                                <code class="css-identifier">{getInputPropertyName(input)}</code>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <div class="right-column">
        <div class="css-scroll-container">
            <pre class="css-editor readonly">{generatedCSS}</pre>
            <pre
                class="css-editor editable"
                contenteditable="plaintext-only"
                oninput={handleCustomCSSInput}
                spellcheck="false"
            >{customCSS}</pre>
        </div>
    </div>
</div>

<style>
    .css-view {
        display: flex;
        height: 100%;
        overflow: hidden;
        gap: 20px;
        padding: 0 0 0 20px;
    }

    .left-column {
        width: 280px;
        flex-shrink: 0;
        padding: 20px 0;
    }

    .reference-card {
        background: #f5f5f5;
        border-radius: 8px;
        overflow: hidden;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        height: 100%;
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

    .right-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .css-scroll-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100%;
    }

    .css-editor {
        display: block;
        margin: 0;
        padding: 20px;
        background: white;
        color: #333;
        font-family: var(--font-stack-mono);
        font-size: 9pt;
        line-height: 1.6;
        border: none;
        outline: none;
        white-space: pre;
        tab-size: 4;
        min-height: auto;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .css-editor.readonly {
        background: #fafafa;
        color: #666;
        cursor: default;
        user-select: text;
        padding-bottom: 10px;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        box-shadow: none;
    }

    .css-editor.editable {
        background: transparent;
        padding-top: 10px;
        min-height: 200px;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
    }

    .css-editor.editable:focus {
        outline: none;
    }

    .css-editor::selection {
        background: #264f78;
        color: white;
    }
</style>
