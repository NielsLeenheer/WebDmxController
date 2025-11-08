<script>
    import { onMount, onDestroy } from 'svelte';
    import { getDeviceColor } from '../../lib/colorUtils.js';

    let {
        dmxController,
        devices = []
    } = $props();

    // Generate CSS-safe ID from device name
    function getDeviceId(device) {
        return device.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/_+/g, '_')          // Collapse multiple underscores
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
    }

    const initialStyleContent = `/* CSS Animation Mode

Target devices using ID selectors based on device names.
Example: "Moving Head (Basic) 9" becomes #moving_head_basic_9

Note: Your CSS is automatically scoped to only affect animation targets.
You can write CSS freely without worrying about affecting the rest of the page.

Supported properties:
- color: Maps to RGB(W) channels, opacity alpha to W channel
- opacity: Maps to dimmer channel
- translate: x → pan, y → tilt (for moving heads)

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

/* Apply animations to specific devices by name-based ID */
/* Example: #moving_head_1 { animation: pan-tilt 10s linear infinite; } */

/* Apply rainbow animation to all devices */
* {
    animation: rainbow 5s linear infinite;
}
`;

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
        if (!dmxController || !isActive) return;

        devices.forEach(device => {
            const deviceId = getDeviceId(device);
            const element = document.getElementById(deviceId);
            if (!element) return;

            const computedStyle = window.getComputedStyle(element);
            const newValues = [...device.defaultValues];

            // Parse CSS color property → DMX RGB(W)
            const color = computedStyle.color;
            if (color && color !== 'rgba(0, 0, 0, 0)') {
                const rgba = parseColor(color);
                if (rgba) {
                    // Map to device channels based on type
                    if (device.type === 'RGB') {
                        newValues[0] = rgba.r;
                        newValues[1] = rgba.g;
                        newValues[2] = rgba.b;
                    } else if (device.type === 'RGBA') {
                        newValues[0] = rgba.r;
                        newValues[1] = rgba.g;
                        newValues[2] = rgba.b;
                        newValues[3] = rgba.a;
                    } else if (device.type === 'RGBW') {
                        newValues[0] = rgba.r;
                        newValues[1] = rgba.g;
                        newValues[2] = rgba.b;
                        newValues[3] = rgba.a; // Use alpha for white channel
                    } else if (device.type === 'MOVING_HEAD') {
                        // Moving head: pan, tilt, dimmer, r, g, b, w
                        newValues[3] = rgba.r;
                        newValues[4] = rgba.g;
                        newValues[5] = rgba.b;
                        newValues[6] = rgba.a; // white channel
                    }

                    // Update preview color
                    previewColors[device.id] = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a / 255})`;
                }
            }

            // Track opacity for preview
            let opacityValue = 1;

            // Parse CSS opacity → DMX dimmer
            const opacity = parseFloat(computedStyle.opacity);
            if (!isNaN(opacity)) {
                opacityValue = opacity;
                const dimmerValue = Math.round(opacity * 255);
                if (device.type === 'DIMMER') {
                    newValues[0] = dimmerValue;
                } else if (device.type === 'MOVING_HEAD') {
                    newValues[2] = dimmerValue; // Dimmer channel
                }
            }

            // Store opacity for preview
            deviceOpacities[device.id] = opacityValue;

            // Parse CSS translate → DMX pan/tilt (for moving heads)
            if (device.type === 'MOVING_HEAD') {
                const transform = computedStyle.transform;
                if (transform && transform !== 'none') {
                    const translate = parseTransform(transform);
                    if (translate) {
                        // Map -100% to 100% range to 0-255
                        newValues[0] = Math.round(((translate.x + 100) / 200) * 255); // Pan
                        newValues[1] = Math.round(((translate.y + 100) / 200) * 255); // Tilt
                    }
                }

                // Also try the translate property directly
                const translateProp = computedStyle.translate;
                if (translateProp && translateProp !== 'none') {
                    const parts = translateProp.split(' ');
                    if (parts.length >= 2) {
                        const x = parsePercentage(parts[0]);
                        const y = parsePercentage(parts[1]);
                        if (x !== null) newValues[0] = Math.round(((x + 100) / 200) * 255);
                        if (y !== null) newValues[1] = Math.round(((y + 100) / 200) * 255);
                    }
                }

                // Store pan/tilt for preview visualization
                devicePanTilt[device.id] = {
                    pan: newValues[0],
                    tilt: newValues[1]
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

        // Set initial content in the editor
        if (cssEditorElement) {
            cssEditorElement.textContent = initialStyleContent;
        }
        updateStyleElement(initialStyleContent);

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
                        <div class="device-id">#{getDeviceId(device)}</div>
                    </div>
                </div>
            {/each}
        </div>

        <!-- Off-screen animation targets -->
        <div class="animation-targets" bind:this={animationTargetsContainer}>
            {#each devices as device (device.id)}
                <div
                    id="{getDeviceId(device)}"
                    class="animation-target"
                    data-device-id={device.id}
                ></div>
            {/each}
        </div>
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
