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
        triggerManager
    } = $props();

    // Generate CSS-safe ID from device name
    function getDeviceId(device) {
        return device.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/_+/g, '_')          // Collapse multiple underscores
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
    }

    // Load CSS from localStorage or generate from libraries
    function getInitialCSS() {
        const saved = localStorage.getItem('dmx-css');
        if (saved) {
            return saved;
        }

        // Generate from animation and mapping libraries if they have content
        const generated = cssGenerator.generate(devices);
        if (generated && generated.trim().length > 200) {
            return generated;
        }

        // Otherwise use default example CSS
        return `/* CSS Animation Mode

Target devices using ID selectors: #device-{deviceId}

Supported properties:
- color: Maps to RGB(W) channels
- opacity: Maps to dimmer channel
- translate: x → pan, y → tilt (for moving heads)
- --smoke-output: For smoke machines (0-255)

Example animations:
*/

@keyframes rainbow {
    0%   { color: rgb(255, 0, 0); }
    16%  { color: rgb(255, 127, 0); }
    33%  { color: rgb(255, 255, 0); }
    50%  { color: rgb(0, 255, 0); }
    66%  { color: rgb(0, 0, 255); }
    83%  { color: rgb(75, 0, 130); }
    100% { color: rgb(148, 0, 211); }
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
}

@keyframes pan-tilt {
    0%   { translate: 0% 0%; }
    25%  { translate: 100% 0%; }
    50%  { translate: 100% 100%; }
    75%  { translate: 0% 100%; }
    100% { translate: 0% 0%; }
}

/* Apply rainbow animation to all devices */
* {
    animation: rainbow 5s linear infinite;
}
`;
    }

    let currentCSS = $state(getInitialCSS());

    let animationFrameId;
    let isActive = false;
    let previewColors = $state({});
    let deviceOpacities = $state({});
    let devicePanTilt = $state({});

    // Create a style element for the user's CSS
    let styleElement;
    let animationTargetsContainer;
    let cssEditorElement;

    function updateDMXFromCSS() {
        if (!dmxController || !isActive || !cssSampler) return;

        // Sample all devices using the new cssSampler
        const sampledValues = cssSampler.sampleAll(devices);

        devices.forEach(device => {
            const channels = sampledValues.get(device.id);
            if (!channels) return;

            // Convert channel values to array based on device type
            const newValues = device.getChannelValues();

            // Update values from sampled channels
            for (const [channelName, value] of Object.entries(channels)) {
                const channelIndex = Object.keys(channels).indexOf(channelName);
                if (channelIndex !== -1 && channelIndex < newValues.length) {
                    newValues[channelIndex] = value;
                }
            }

            // Update preview colors based on sampled RGB values
            if (channels.Red !== undefined && channels.Green !== undefined && channels.Blue !== undefined) {
                const alpha = channels.White !== undefined ? channels.White : 255;
                previewColors[device.id] = `rgba(${channels.Red}, ${channels.Green}, ${channels.Blue}, ${alpha / 255})`;
            } else if (channels.Intensity !== undefined) {
                // Dimmer preview
                const intensity = channels.Intensity / 255;
                deviceOpacities[device.id] = intensity;
            }

            // Update pan/tilt preview for moving heads
            if (device.type === 'MOVING_HEAD' && channels.Pan !== undefined && channels.Tilt !== undefined) {
                devicePanTilt[device.id] = {
                    pan: channels.Pan,
                    tilt: channels.Tilt
                };
            }

            // Update DMX controller
            updateDeviceToDMX(device, newValues);
        });

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

    function handleStyleInput(event) {
        // Read the content from the contenteditable element
        const newContent = event.target.textContent;

        // Update the style element directly without updating state
        // This prevents cursor position reset
        if (styleElement) {
            // Wrap user CSS in @scope to limit it to animation targets only
            styleElement.textContent = `@scope (.animation-targets) {\n${newContent}\n}`;
        }

        // Save to localStorage
        currentCSS = newContent;
        localStorage.setItem('dmx-css', newContent);
    }

    function updateStyleElement(content) {
        if (styleElement) {
            // Wrap user CSS in @scope to limit it to animation targets only
            styleElement.textContent = `@scope (.animation-targets) {\n${content}\n}`;
        }
    }

    function startAnimation() {
        isActive = true;
        if (!animationFrameId) {
            updateDMXFromCSS();
        }
    }

    function stopAnimation() {
        isActive = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    onMount(() => {
        // Create style element for user CSS
        styleElement = document.createElement('style');
        styleElement.id = 'css-animation-styles';
        document.head.appendChild(styleElement);

        // Initialize CSS sampler with the animation targets container
        if (cssSampler && animationTargetsContainer) {
            cssSampler.initialize(animationTargetsContainer);
            cssSampler.updateDevices(devices);
        }

        // Set trigger manager container for input mappings
        if (triggerManager && animationTargetsContainer) {
            triggerManager.setContainer(animationTargetsContainer);
        }

        // Set initial content in the editor
        if (cssEditorElement) {
            cssEditorElement.textContent = currentCSS;
        }
        updateStyleElement(currentCSS);

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

        // Start animation loop
        startAnimation();
    });

    // Watch for device changes and update sampler
    $effect(() => {
        if (cssSampler && devices) {
            cssSampler.updateDevices(devices);
        }
    });

    onDestroy(() => {
        stopAnimation();
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
    });
</script>

<div class="css-view">
    <div class="left-column">
        <div class="device-list">
            {#each devices as device (device.id)}
                <div class="device-item">
                    <div class="device-preview-container">
                        <div
                            class="device-preview"
                            style="background-color: {previewColors[device.id] || getDeviceColor(device.type, device.defaultValues)}; opacity: {deviceOpacities[device.id] || 1}"
                        >
                            {#if device.type === 'MOVING_HEAD' && devicePanTilt[device.id]}
                                {@const panTilt = devicePanTilt[device.id]}
                                {@const dotX = (panTilt.pan / 255) * 100}
                                {@const dotY = (1 - panTilt.tilt / 255) * 100}
                                <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
                            {/if}
                        </div>
                    </div>
                    <div class="device-info">
                        <div class="device-id">#device-{device.id}</div>
                        <div class="device-name">{device.name}</div>
                    </div>
                </div>
            {/each}
        </div>

        <!-- Off-screen animation targets (managed by cssSampler) -->
        <div class="animation-targets" bind:this={animationTargetsContainer}></div>
    </div>

    <div class="right-column">
        <pre
            class="css-editor"
            contenteditable="true"
            oninput={handleStyleInput}
            spellcheck="false"
            bind:this={cssEditorElement}
        ></pre>
    </div>
</div>

<style>
    .css-view {
        display: flex;
        height: 100%;
        overflow: hidden;
    }

    .left-column {
        width: 250px;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        background: #f9f9f9;
    }

    .right-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .device-list {
        flex: 1;
        overflow-y: auto;
        padding-top: 15px;
    }

    .device-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 0 15px;
        margin-bottom: 15px;
    }

    .device-preview-container {
        flex-shrink: 0;
    }

    .device-preview {
        position: relative;
        width: 50px;
        height: 50px;
        border-radius: 6px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .pan-tilt-indicator {
        position: absolute;
        width: 10px;
        height: 10px;
        background: transparent;
        outline: 2px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        z-index: 10;
    }

    .device-info {
        flex: 1;
    }

    .device-name {
        font-weight: 600;
        font-size: 11pt;
        margin-bottom: 4px;
    }

    .device-id {
        font-family: var(--font-stack-mono);
        font-size: 8pt;
    }

    .device-type {
        font-size: 9pt;
        color: #666;
    }

    .animation-targets {
        position: absolute;
        left: -9999px;
        top: -9999px;
        pointer-events: none;
    }

    .animation-target {
        width: 100px;
        height: 100px;
        opacity: 0;
    }

    .css-editor {
        flex: 1;
        margin: 0;
        padding: 20px;
        background: #fff;
        color: #333;
        font-family: var(--font-stack-mono);
        font-size: 10pt;
        line-height: 1.6;
        overflow: auto;
        border: none;
        outline: none;
        white-space: pre;
        tab-size: 4;
    }

    .css-editor:focus {
        outline: none;
    }

    /* CSS syntax highlighting via basic styling */
    .css-editor::selection {
        background: #264f78;
    }
</style>
