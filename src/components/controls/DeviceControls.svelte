<script>
    import { DEVICE_TYPES } from '../../lib/devices.js';
    import XYPad from './XYPad.svelte';

    let {
        deviceType,
        values = $bindable([]),
        onChange = null,
        disabledChannels = [] // Array of channel indices that should be disabled
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

    function handleToggleChange(channelIndex, control) {
        // Toggle between off and on values
        const currentValue = values[channelIndex];
        const newValue = currentValue === control.onValue ? control.offValue : control.onValue;
        handleSliderChange(channelIndex, newValue);
    }

    function handleTextInputChange(channelIndex, inputValue, e) {
        const numValue = parseInt(inputValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
            handleSliderChange(channelIndex, numValue);
        } else if (inputValue === '') {
            // Allow empty for easier editing
            e.target.value = '';
        } else {
            // Invalid value, revert to current value
            e.target.value = values[channelIndex];
        }
    }

    function handleTextInput(e) {
        // Only allow digits
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }

    function isChannelDisabled(channelIndex) {
        return disabledChannels.includes(channelIndex);
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

    // Generate gradient background for slider based on control name
    function getSliderGradient(controlName) {
        switch (controlName) {
            case 'Red':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,0,0) 100%)';
            case 'Green':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,255,0) 100%)';
            case 'Blue':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,0,255) 100%)';
            case 'Amber':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,191,0) 100%)';
            case 'White':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
            case 'Dimmer':
            case 'Intensity':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
            case 'Output':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
            default:
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(128,128,128) 100%)';
        }
    }

    // Get thumb color based on control name and current value
    function getThumbColor(controlName, value) {
        switch (controlName) {
            case 'Red':
                return `rgb(${value}, 0, 0)`;
            case 'Green':
                return `rgb(0, ${value}, 0)`;
            case 'Blue':
                return `rgb(0, 0, ${value})`;
            case 'Amber':
                return `rgb(${value}, ${Math.round(value * 0.749)}, 0)`;
            case 'White':
                return `rgb(${value}, ${value}, ${value})`;
            case 'Dimmer':
            case 'Intensity':
                return `rgb(${value}, ${value}, ${value})`;
            case 'Output':
                return `rgb(${Math.round(value * 0.784)}, ${Math.round(value * 0.784)}, ${Math.round(value * 0.784)})`;
            default:
                return `rgb(${Math.round(value * 0.5)}, ${Math.round(value * 0.5)}, ${Math.round(value * 0.5)})`;
        }
    }
</script>

<div class="device-controls">
    {#each DEVICE_TYPES[deviceType].controls as control, controlIndex}
        {#if control.type === 'xypad'}
            {@const panDisabled = isChannelDisabled(control.panIndex)}
            {@const tiltDisabled = isChannelDisabled(control.tiltIndex)}
            {@const bothDisabled = panDisabled && tiltDisabled}
            <div class="control-xypad">
                <label>{control.name}</label>
                <div class="xypad-wrapper" class:disabled={bothDisabled}>
                    <XYPad
                        bind:panValue={values[control.panIndex]}
                        bind:tiltValue={values[control.tiltIndex]}
                        onUpdate={(pan, tilt) => !bothDisabled && handleXYPadChange(control.panIndex, control.tiltIndex, pan, tilt)}
                    />
                </div>
                <div class="xypad-inputs">
                    <input
                        type="text"
                        value={values[control.panIndex]}
                        oninput={handleTextInput}
                        onchange={(e) => !panDisabled && handleTextInputChange(control.panIndex, e.target.value, e)}
                        class="value-input"
                        title="Pan"
                        disabled={panDisabled}
                        maxlength="3"
                    />
                    <input
                        type="text"
                        value={values[control.tiltIndex]}
                        oninput={handleTextInput}
                        onchange={(e) => !tiltDisabled && handleTextInputChange(control.tiltIndex, e.target.value, e)}
                        class="value-input"
                        title="Tilt"
                        disabled={tiltDisabled}
                        maxlength="3"
                    />
                </div>
            </div>
        {:else if control.type === 'toggle'}
            {@const channelIndex = getControlChannelIndex(controlIndex)}
            {@const channelDisabled = isChannelDisabled(channelIndex)}
            {@const isOn = values[channelIndex] === control.onValue}
            <div class="control">
                <label>{control.name}</label>
                <div class="toggle-wrapper">
                    <button
                        class="toggle-switch"
                        class:on={isOn}
                        onclick={() => !channelDisabled && handleToggleChange(channelIndex, control)}
                        disabled={channelDisabled}
                        aria-label="{control.name} {isOn ? 'on' : 'off'}"
                    >
                        <span class="toggle-slider"></span>
                    </button>
                    <span class="toggle-label">{isOn ? 'PROBABLY' : 'NONE'}</span>
                </div>
                <input
                    type="text"
                    value={values[channelIndex]}
                    oninput={handleTextInput}
                    onchange={(e) => !channelDisabled && handleTextInputChange(channelIndex, e.target.value, e)}
                    class="value-input"
                    disabled={channelDisabled}
                    maxlength="3"
                />
            </div>
        {:else}
            {@const channelIndex = getControlChannelIndex(controlIndex)}
            {@const channelDisabled = isChannelDisabled(channelIndex)}
            <div class="control">
                <label>{control.name}</label>
                <div class="slider-wrapper">
                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={values[channelIndex]}
                        oninput={(e) => !channelDisabled && handleSliderChange(channelIndex, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control.name)}; --thumb-color: {getThumbColor(control.name, values[channelIndex])}"
                        disabled={channelDisabled}
                        class="color-slider"
                    />
                </div>
                <input
                    type="text"
                    value={values[channelIndex]}
                    oninput={handleTextInput}
                    onchange={(e) => !channelDisabled && handleTextInputChange(channelIndex, e.target.value, e)}
                    class="value-input"
                    disabled={channelDisabled}
                    maxlength="3"
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

    .slider-wrapper {
        position: relative;
        width: 100%;
    }

    /* Custom slider styles */
    .color-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 7px;
        border-radius: 3.5px;
        background: var(--slider-gradient);
        cursor: pointer;
        outline: none;
    }

    .color-slider:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Webkit (Chrome, Safari) thumb */
    .color-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--thumb-color, #888);
        outline: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    .color-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    /* Firefox thumb */
    .color-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--thumb-color, #888);
        outline: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    .color-slider::-moz-range-thumb:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    /* Firefox track */
    .color-slider::-moz-range-track {
        background: transparent;
        border: none;
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
        opacity: 0.1;
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

    .xypad-wrapper.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    /* Toggle switch styles */
    .toggle-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .toggle-switch {
        position: relative;
        width: 44px;
        height: 24px;
        background: #ccc;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 0.3s;
        padding: 0;
    }

    .toggle-switch:hover {
        background: #b3b3b3;
    }

    .toggle-switch.on {
        background: #4caf50;
    }

    .toggle-switch.on:hover {
        background: #45a049;
    }

    .toggle-switch:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .toggle-slider {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.3s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        display: block;
    }

    .toggle-switch.on .toggle-slider {
        transform: translateX(20px);
    }

    .toggle-label {
        font-size: 9pt;
        font-weight: 600;
        color: #666;
        min-width: 4em;
    }

    .toggle-switch.on + .toggle-label {
        color: #4caf50;
    }
</style>
