<script>
    import { onMount, onDestroy } from 'svelte';
    import { getDeviceColor } from '../../lib/colorUtils.js';

    let {
        dmxController,
        devices = [],
        animationLibrary,
        mappingLibrary,
        cssGenerator,
        cssSampler,
        triggerManager,
        customPropertyManager,
        isActive = false
    } = $props();

    // Separate generated and custom CSS
    let generatedCSS = $state('');
    let customCSS = $state('');

    // Load custom CSS from localStorage
    function loadCustomCSS() {
        const saved = localStorage.getItem('dmx-custom-css');
        return saved || '/* Add your custom CSS here to override device defaults and apply animations */\n';
    }

    // Regenerate generated CSS from current state
    function regenerateCSS() {
        generatedCSS = cssGenerator.generate(devices);
    }

    let animationFrameId;
    let previewColors = $state({});
    let deviceOpacities = $state({});
    let devicePanTilt = $state({});
    let deviceFlamethrower = $state({});
    let deviceSmoke = $state({});

    // Get animations for display
    let animations = $derived(
        animationLibrary ? animationLibrary.getAll() : []
    );

    // Filter devices to only show those with independent controls
    // A device has independent controls if:
    // - It's not linked to another device (linkedTo === null), OR
    // - It's linked but not all controls are synced (syncedControls !== null)
    let independentDevices = $derived(
        devices.filter(device => !device.linkedTo || device.syncedControls !== null)
    );

    // Get all mappings for display (trigger and direct modes)
    let allMappings = $state([]);

    // Style elements and containers
    let styleElement;
    let animationTargetsContainer;
    let triggerClassesContainer;
    let customCSSEditor;

    /**
     * Convert sampled channel object to device channel array
     * Maps channel names to the correct array indices for each device type
     */
    function convertChannelsToArray(deviceType, channels) {
        switch (deviceType) {
            case 'RGB':
                return [
                    channels.Red || 0,
                    channels.Green || 0,
                    channels.Blue || 0
                ];

            case 'RGBA':
                return [
                    channels.Red || 0,
                    channels.Green || 0,
                    channels.Blue || 0,
                    channels.Amber || 0
                ];

            case 'RGBW':
                return [
                    channels.Red || 0,
                    channels.Green || 0,
                    channels.Blue || 0,
                    channels.White || 0
                ];

            case 'DIMMER':
                return [
                    channels.Intensity || 0
                ];

            case 'SMOKE':
                return [
                    channels.Output || 0
                ];

            case 'MOVING_HEAD':
                return [
                    channels.Pan || 127,
                    channels.Tilt || 127,
                    channels.Dimmer || 0,
                    channels.Red || 0,
                    channels.Green || 0,
                    channels.Blue || 0,
                    channels.White || 0
                ];

            case 'FLAMETHROWER':
                return [
                    channels.Safety || 0,
                    channels.Fuel || 0
                ];

            default:
                console.warn(`Unknown device type: ${deviceType}`);
                return [];
        }
    }

    function updateDMXFromCSS() {
        if (!cssSampler) return;

        // Always sample to update preview, regardless of isActive state
        const sampledValues = cssSampler.sampleAll(devices);

        devices.forEach(device => {
            const channels = sampledValues.get(device.id);
            if (!channels) return;

            // Convert sampled channels to device channel array based on device type
            const newValues = convertChannelsToArray(device.type, channels);

            // ALWAYS update preview colors (even when not active)
            if (channels.Red !== undefined && channels.Green !== undefined && channels.Blue !== undefined) {
                // Use getDeviceColor for consistent color calculation
                const color = getDeviceColor(device.type, newValues);
                previewColors[device.id] = color;

                // For moving heads, dimmer controls opacity separately
                if (device.type === 'MOVING_HEAD' && channels.Dimmer !== undefined) {
                    deviceOpacities[device.id] = channels.Dimmer / 255;
                } else {
                    deviceOpacities[device.id] = 1;
                }
            } else if (channels.Intensity !== undefined || channels.Dimmer !== undefined) {
                // Dimmer/Intensity for non-color devices
                const intensity = (channels.Intensity || channels.Dimmer || 0) / 255;
                deviceOpacities[device.id] = intensity;
            }

            // Update pan/tilt preview for moving heads
            if (device.type === 'MOVING_HEAD' && channels.Pan !== undefined && channels.Tilt !== undefined) {
                devicePanTilt[device.id] = {
                    pan: channels.Pan,
                    tilt: channels.Tilt
                };
            }

            // Update flamethrower preview
            if (device.type === 'FLAMETHROWER' && channels.Safety !== undefined && channels.Fuel !== undefined) {
                deviceFlamethrower[device.id] = {
                    safety: channels.Safety,
                    fuel: channels.Fuel
                };
            }

            // Update smoke machine preview
            if (device.type === 'SMOKE' && channels.Output !== undefined) {
                deviceSmoke[device.id] = {
                    output: channels.Output
                };
            }

            // Always update DMX hardware with CSS-sampled values
            if (dmxController) {
                updateDeviceToDMX(device, newValues);
            }
        });

        // Continue animation loop
        animationFrameId = requestAnimationFrame(updateDMXFromCSS);
    }

    function parseColor(colorStr) {
        // Parse rgba(r, g, b, a) or rgb(r, g, b)
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? Math.round(parseFloat(match[4]) * 255) : 255
            };
        }
        return null;
    }

    function parseTransform(transformStr) {
        // Parse matrix(a, b, c, d, tx, ty)
        const match = transformStr.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (match) {
            return {
                x: parseFloat(match[1]),
                y: parseFloat(match[2])
            };
        }
        return null;
    }

    function parsePercentage(str) {
        if (str.endsWith('%')) {
            return parseFloat(str);
        }
        return null;
    }

    function updateDeviceToDMX(device, values) {
        if (!dmxController) return;

        for (let i = 0; i < values.length; i++) {
            const channel = device.startChannel + i;
            dmxController.setChannel(channel, values[i]);
        }
    }

    function handleCustomCSSInput(event) {
        // Read the content from the contenteditable element
        const newContent = event.target.textContent;

        // Update custom CSS
        customCSS = newContent;
        localStorage.setItem('dmx-custom-css', newContent);

        // Update the combined style element
        updateStyleElement();
    }

    function updateStyleElement() {
        if (styleElement) {
            // Combine generated CSS and custom CSS, wrap in @scope
            const combinedCSS = generatedCSS + '\n\n' + customCSS;
            styleElement.textContent = `@scope (.animation-targets) {\n${combinedCSS}\n}`;
        }
    }

    // Regenerate CSS when mappings or animations change
    function handleMappingChange() {
        allMappings = mappingLibrary.getAll();
        regenerateCSS();
        updateStyleElement();
    }

    function handleAnimationChange() {
        regenerateCSS();
        updateStyleElement();
    }

    onMount(() => {
        // Create style element for @property definitions (must be at document level)
        const propertyDefsElement = document.createElement('style');
        propertyDefsElement.id = 'css-property-definitions';
        propertyDefsElement.textContent = `
/* CSS Custom Property Definitions */
@property --safety {
  syntax: "none | probably";
  inherits: false;
  initial-value: none;
}

@property --fuel {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --smoke {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --pan {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --tilt {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --amber {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
`;
        document.head.appendChild(propertyDefsElement);

        // Create style element for user CSS
        styleElement = document.createElement('style');
        styleElement.id = 'css-animation-styles';
        document.head.appendChild(styleElement);

        // Create inner trigger-classes container
        if (animationTargetsContainer) {
            triggerClassesContainer = document.createElement('div');
            triggerClassesContainer.className = 'trigger-classes';
            animationTargetsContainer.appendChild(triggerClassesContainer);
        }

        // Initialize CSS sampler with the inner container (where devices will be)
        if (cssSampler && triggerClassesContainer) {
            cssSampler.initialize(triggerClassesContainer);
            cssSampler.updateDevices(devices);
        }

        // Set trigger manager container to inner container (where classes go)
        if (triggerManager && triggerClassesContainer) {
            triggerManager.setContainer(triggerClassesContainer);
        }

        // Listen for mapping and animation changes to update CSS automatically
        mappingLibrary.on('changed', handleMappingChange);
        animationLibrary.on('changed', handleAnimationChange);

        // Initialize mappings list
        allMappings = mappingLibrary.getAll();

        // Initialize CSS
        customCSS = loadCustomCSS();
        regenerateCSS();

        // Set initial content in the editors
        if (customCSSEditor) {
            customCSSEditor.textContent = customCSS;
        }
        updateStyleElement();

        // Initialize preview colors
        devices.forEach(device => {
            previewColors[device.id] = getDeviceColor(device.type, device.defaultValues);
            deviceOpacities[device.id] = 1;
            if (device.type === 'MOVING_HEAD') {
                devicePanTilt[device.id] = {
                    pan: device.defaultValues[0] || 127,
                    tilt: device.defaultValues[1] || 127
                };
            }
        });

        // Start animation loop (for preview updates and DMX output, always running)
        // DMX controller is always updated with CSS-sampled values
        if (!animationFrameId) {
            updateDMXFromCSS();
        }
    });

    // Watch for device changes and regenerate CSS
    $effect(() => {
        if (cssSampler && devices) {
            cssSampler.updateDevices(devices);
            regenerateCSS();
            updateStyleElement();
        }
    });

    onDestroy(() => {
        // Stop animation loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Remove style elements
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }

        const propertyDefsElement = document.getElementById('css-property-definitions');
        if (propertyDefsElement && propertyDefsElement.parentNode) {
            propertyDefsElement.parentNode.removeChild(propertyDefsElement);
        }

        mappingLibrary.off('changed', handleMappingChange);
        animationLibrary.off('changed', handleAnimationChange);
    });
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
                            <div class="device-preview-item">
                                <div
                                    class="device-preview"
                                    style="background-color: {previewColors[device.id] || getDeviceColor(device.type, device.defaultValues)}; opacity: {deviceOpacities[device.id] || 1}"
                                    title={device.name}
                                >
                                    {#if device.type === 'MOVING_HEAD' && devicePanTilt[device.id]}
                                        {@const panTilt = devicePanTilt[device.id]}
                                        {@const dotX = (panTilt.pan / 255) * 100}
                                        {@const dotY = (1 - panTilt.tilt / 255) * 100}
                                        <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
                                    {/if}
                                    {#if device.type === 'FLAMETHROWER' && deviceFlamethrower[device.id]}
                                        {@const flame = deviceFlamethrower[device.id]}
                                        {@const safetyOff = flame.safety < 125}
                                        {@const fuelPercent = (flame.fuel / 255) * 100}
                                        {#if safetyOff}
                                            <div class="flamethrower-cross"></div>
                                        {:else}
                                            <div class="flamethrower-fire" style="height: {fuelPercent}%"></div>
                                        {/if}
                                    {/if}
                                    {#if device.type === 'SMOKE' && deviceSmoke[device.id]}
                                        {@const smoke = deviceSmoke[device.id]}
                                        {@const smokePercent = (smoke.output / 255) * 100}
                                        <div class="smoke-effect" style="opacity: {smokePercent / 100}"></div>
                                    {/if}
                                </div>
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
            {#if allMappings.length > 0}
                <div class="reference-section">
                    <h4>Inputs</h4>
                    <div class="css-identifiers">
                        {#each allMappings as mapping (mapping.id)}
                            {#if mapping.mode === 'input'}
                                {#if mapping.isButtonInput()}
                                    <!-- Buttons show classes based on mode -->
                                    {#if mapping.buttonMode === 'toggle'}
                                        <!-- Toggle buttons show on and off classes -->
                                        <code class="css-identifier">.{mapping.getButtonOnClass()}</code>
                                        <code class="css-identifier">.{mapping.getButtonOffClass()}</code>
                                    {:else}
                                        <!-- Momentary buttons show down and up classes -->
                                        <code class="css-identifier">.{mapping.getButtonDownClass()}</code>
                                        <code class="css-identifier">.{mapping.getButtonUpClass()}</code>
                                    {/if}
                                {:else}
                                    <!-- Sliders/Knobs show custom property -->
                                    <code class="css-identifier">{mapping.getInputPropertyName()}</code>
                                {/if}
                            {:else if mapping.mode === 'direct'}
                                <code class="css-identifier">{mapping.getPropertyName()}</code>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Off-screen animation targets (managed by cssSampler) -->
        <div class="animation-targets" bind:this={animationTargetsContainer}></div>
    </div>

    <div class="right-column">
        <div class="css-scroll-container">
            <pre class="css-editor readonly">{generatedCSS}</pre>
            <pre
                class="css-editor editable"
                contenteditable="true"
                oninput={handleCustomCSSInput}
                spellcheck="false"
                bind:this={customCSSEditor}
            ></pre>
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

    .device-preview {
        position: relative;
        width: 50px;
        height: 50px;
        border-radius: 6px;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .pan-tilt-indicator {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #888;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 10;
    }

    .flamethrower-cross {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 70%;
        height: 70%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    .flamethrower-cross::before,
    .flamethrower-cross::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 2px;
        background: #666;
        top: 50%;
        left: 0;
    }

    .flamethrower-cross::before {
        transform: translateY(-50%) rotate(45deg);
    }

    .flamethrower-cross::after {
        transform: translateY(-50%) rotate(-45deg);
    }

    .flamethrower-fire {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, #ff5722 0%, #ff9800 50%, #ffc107 100%);
        border-radius: 0 0 6px 6px;
        pointer-events: none;
        transition: height 0.1s ease-out;
    }

    .smoke-effect {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(ellipse at center, rgba(200, 200, 220, 0.9) 0%, rgba(150, 150, 180, 0.6) 50%, rgba(100, 100, 140, 0.3) 100%);
        border-radius: 6px;
        pointer-events: none;
        transition: opacity 0.2s ease-out;
    }

    .device-id {
        font-family: var(--font-stack-mono);
        font-size: 8pt;
        color: #007acc;
        text-align: center;
    }

    .animation-targets {
        position: absolute;
        left: -9999px;
        top: -9999px;
        pointer-events: none;
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
