<script>
    import { DEVICE_TYPES } from '../lib/devices.js';
    import XYPad from './XYPad.svelte';

    let {
        deviceType,
        values = $bindable([]),
        onChange = null,
        disabled = false
    } = $props();

    function handleSliderChange(channelIndex, value) {
        values[channelIndex] = value;
        if (onChange) {
            onChange(channelIndex, value);
        }
    }

    function handleXYPadChange(panIndex, tiltIndex, panValue, tiltValue) {
        values[panIndex] = panValue;
        values[tiltIndex] = tiltValue;
        if (onChange) {
            onChange(panIndex, panValue);
            onChange(tiltIndex, tiltValue);
        }
    }

    // Get the channel index for a control
    function getControlChannelIndex(controlIndex) {
        const controls = DEVICE_TYPES[deviceType].controls;
        let channelOffset = 0;

        for (let i = 0; i < controlIndex; i++) {
            if (controls[i].type === 'xypad') {
                channelOffset += 2; // XY pad uses 2 channels
            } else {
                channelOffset += 1;
            }
        }

        return channelOffset;
    }
</script>

<div class="device-controls">
    {#each DEVICE_TYPES[deviceType].controls as control, controlIndex}
        {#if control.type === 'xypad'}
            <div class="control-xypad">
                <label>{control.name}</label>
                <XYPad
                    bind:panValue={values[control.panIndex]}
                    bind:tiltValue={values[control.tiltIndex]}
                    onUpdate={(pan, tilt) => handleXYPadChange(control.panIndex, control.tiltIndex, pan, tilt)}
                />
                <div class="xypad-inputs">
                    <input
                        type="number"
                        min="0"
                        max="255"
                        bind:value={values[control.panIndex]}
                        onchange={(e) => handleXYPadChange(control.panIndex, control.tiltIndex, parseInt(e.target.value), values[control.tiltIndex])}
                        class="value-input"
                        title="Pan"
                        {disabled}
                    />
                    <input
                        type="number"
                        min="0"
                        max="255"
                        bind:value={values[control.tiltIndex]}
                        onchange={(e) => handleXYPadChange(control.panIndex, control.tiltIndex, values[control.panIndex], parseInt(e.target.value))}
                        class="value-input"
                        title="Tilt"
                        {disabled}
                    />
                </div>
            </div>
        {:else}
            {@const channelIndex = getControlChannelIndex(controlIndex)}
            <div class="control">
                <label>{control.name}</label>
                <input
                    type="range"
                    min="0"
                    max="255"
                    bind:value={values[channelIndex]}
                    oninput={(e) => handleSliderChange(channelIndex, parseInt(e.target.value))}
                    style="accent-color: {control.color}"
                    {disabled}
                />
                <input
                    type="number"
                    min="0"
                    max="255"
                    bind:value={values[channelIndex]}
                    onchange={(e) => handleSliderChange(channelIndex, parseInt(e.target.value))}
                    class="value-input"
                    {disabled}
                />
            </div>
        {/if}
    {/each}
</div>

<style>
    .device-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .control {
        display: grid;
        grid-template-columns: 4em 1fr 3em;
        gap: 8px;
        align-items: center;
    }

    .control label {
        font-size: 9pt;
        font-weight: 600;
        color: #555;
    }

    .control input[type="range"] {
        cursor: pointer;
    }

    .value-input {
        width: 4em;
        border: none;
        background: transparent;
        padding: 4px;
        font-size: 9pt;
        font-family: var(--font-stack-mono);
        text-align: right;
        border-radius: 5px;
    }

    .value-input:focus {
        outline: none;
        background: #fff;
    }

    .control input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .control-xypad {
        display: grid;
        grid-template-columns: 4em 1fr 3em;
        gap: 8px;
        align-items: center;
    }

    .control-xypad label {
        font-size: 9pt;
        font-weight: 600;
        color: #555;
    }

    .xypad-inputs {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .xypad-inputs input {
        width: 4em;
    }
</style>
