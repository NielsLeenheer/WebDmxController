<script>
    import { Icon } from 'svelte-icon';
    import playIcon from '../assets/icons/play.svg?raw';
    import pauseIcon from '../assets/icons/pause.svg?raw';
    import stopIcon from '../assets/icons/stop.svg?raw';
    import DeviceControls from './DeviceControls.svelte';
    import { DEVICE_TYPES } from '../lib/devices.js';
    import { Timeline, Keypoint } from '../lib/timeline.js';
    import { getEasingNames } from '../lib/easing.js';

    let {
        dmxController = null,
        devices = []
    } = $props();

    // Load timeline from localStorage
    function loadTimeline() {
        try {
            const saved = localStorage.getItem('dmx-timeline');
            if (saved) {
                const data = JSON.parse(saved);
                return Timeline.fromJSON(data);
            }
        } catch (e) {
            console.error('Failed to load timeline from localStorage:', e);
        }
        return new Timeline(10000, true);
    }

    let timeline = $state(loadTimeline());
    let animationFrameId = $state(null);
    let selectedDevice = $state(null);
    let editingKeypoint = $state(null);
    let keypointDialog = $state(null);
    let settingsDialog = $state(null);

    // Timeline settings
    let durationSeconds = $state(timeline.duration / 1000);
    let loop = $state(timeline.loop);

    // Keypoint editor state
    let keypointTime = $state(0);
    let keypointValues = $state([]);
    let keypointEasing = $state('linear');
    let easingNames = getEasingNames();

    // Save timeline to localStorage whenever it changes
    $effect(() => {
        try {
            const data = timeline.toJSON();
            localStorage.setItem('dmx-timeline', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save timeline to localStorage:', e);
        }
    });

    // Format time as MM:SS.mmm
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
    }

    // Start animation loop
    function startAnimationLoop() {
        if (animationFrameId) return;

        function animate() {
            if (timeline.update()) {
                updateDMXFromTimeline();
            }
            animationFrameId = requestAnimationFrame(animate);
        }
        animate();
    }

    // Stop animation loop
    function stopAnimationLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Update DMX values from timeline
    function updateDMXFromTimeline() {
        if (!dmxController) return;

        const deviceValues = timeline.getAllDeviceValuesAtTime(devices);

        devices.forEach(device => {
            const values = deviceValues.get(device.id);
            if (values) {
                values.forEach((value, channelIndex) => {
                    const dmxChannel = device.startChannel + channelIndex;
                    dmxController.setChannel(dmxChannel, value);
                });
            }
        });
    }

    // Playback controls
    function handlePlay() {
        timeline.play();
        startAnimationLoop();
    }

    function handlePause() {
        timeline.pause();
    }

    function handleStop() {
        timeline.stop();
        stopAnimationLoop();
        updateDMXFromTimeline();
    }

    // Seek to position
    function handleSeek(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * timeline.duration;
        timeline.seek(newTime);
        updateDMXFromTimeline();
    }

    // Open add keypoint dialog
    function openAddKeypointDialog(device) {
        selectedDevice = device;
        editingKeypoint = null;
        keypointTime = timeline.currentTime / 1000;
        keypointValues = [...device.defaultValues];
        keypointEasing = 'linear';
        keypointDialog?.showModal();
    }

    // Open edit keypoint dialog
    function openEditKeypointDialog(device, keypoint) {
        selectedDevice = device;
        editingKeypoint = keypoint;
        keypointTime = keypoint.time / 1000;
        keypointValues = [...keypoint.values];
        keypointEasing = keypoint.easing;
        keypointDialog?.showModal();
    }

    // Save keypoint
    function saveKeypoint() {
        if (!selectedDevice) return;

        const time = Math.round(keypointTime * 1000);
        const keypoint = new Keypoint(time, selectedDevice.id, keypointValues, keypointEasing);

        if (editingKeypoint) {
            timeline.updateKeypoint(editingKeypoint, keypoint);
        } else {
            timeline.addKeypoint(keypoint);
        }

        // Force reactivity
        timeline = timeline;
        closeKeypointDialog();
        updateDMXFromTimeline();
    }

    // Delete keypoint
    function deleteKeypoint(device, keypoint) {
        if (confirm('Delete this keypoint?')) {
            timeline.removeKeypoint(keypoint);
            timeline = timeline;
            updateDMXFromTimeline();
        }
    }

    // Close keypoint dialog
    function closeKeypointDialog() {
        keypointDialog?.close();
        selectedDevice = null;
        editingKeypoint = null;
    }

    // Open settings dialog
    function openSettingsDialog() {
        durationSeconds = timeline.duration / 1000;
        loop = timeline.loop;
        settingsDialog?.showModal();
    }

    // Save settings
    function saveSettings() {
        timeline.duration = Math.max(1, durationSeconds) * 1000;
        timeline.loop = loop;
        timeline = timeline;
        settingsDialog?.close();
    }

    // Get keypoints for a device
    function getDeviceKeypoints(device) {
        return timeline.getDeviceKeypoints(device.id);
    }

    // Cleanup on unmount
    $effect(() => {
        return () => {
            stopAnimationLoop();
        };
    });
</script>

<div class="timeline-view">
    <!-- Playback Controls -->
    <div class="controls-bar">
        <div class="playback-controls">
            {#if !timeline.playing}
                <button onclick={handlePlay} title="Play">
                    <Icon data={playIcon} />
                </button>
            {:else}
                <button onclick={handlePause} title="Pause">
                    <Icon data={pauseIcon} />
                </button>
            {/if}
            <button onclick={handleStop} title="Stop">
                <Icon data={stopIcon} />
            </button>
        </div>

        <div class="time-display">
            {formatTime(timeline.currentTime)} / {formatTime(timeline.duration)}
        </div>

        <button class="settings-button" onclick={openSettingsDialog}>
            Settings
        </button>
    </div>

    <!-- Timeline Scrubber -->
    <div class="timeline-scrubber" onclick={handleSeek}>
        <div class="timeline-track">
            <div
                class="timeline-playhead"
                style="left: {(timeline.currentTime / timeline.duration) * 100}%"
            ></div>
            {#each timeline.keypoints as keypoint}
                <div
                    class="timeline-keypoint-marker"
                    style="left: {(keypoint.time / timeline.duration) * 100}%"
                    title="Keypoint at {formatTime(keypoint.time)}"
                ></div>
            {/each}
        </div>
    </div>

    <!-- Devices List -->
    <div class="devices-container">
        {#if devices.length === 0}
            <div class="empty-state">
                <p>No devices added yet.</p>
                <p>Switch to the Devices tab to add devices.</p>
            </div>
        {:else}
            {#each devices as device}
                {@const deviceKeypoints = getDeviceKeypoints(device)}
                <div class="device-card">
                    <div class="device-header">
                        <h3>{device.name}</h3>
                        <span class="device-type">{DEVICE_TYPES[device.type].name}</span>
                        <button class="add-keypoint-button" onclick={() => openAddKeypointDialog(device)}>
                            Add Keypoint
                        </button>
                    </div>

                    {#if deviceKeypoints.length > 0}
                        <div class="keypoints-list">
                            <h4>Keypoints ({deviceKeypoints.length})</h4>
                            {#each deviceKeypoints as keypoint}
                                <div class="keypoint-item">
                                    <span class="keypoint-time">{formatTime(keypoint.time)}</span>
                                    <span class="keypoint-easing">{keypoint.easing}</span>
                                    <button onclick={() => openEditKeypointDialog(device, keypoint)}>
                                        Edit
                                    </button>
                                    <button onclick={() => deleteKeypoint(device, keypoint)}>
                                        Delete
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="no-keypoints">No keypoints yet</p>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- Keypoint Editor Dialog -->
<dialog bind:this={keypointDialog} class="keypoint-dialog">
    {#if selectedDevice}
        <form method="dialog">
            <h3>{editingKeypoint ? 'Edit' : 'Add'} Keypoint - {selectedDevice.name}</h3>

            <div class="dialog-field">
                <label>Time (seconds):</label>
                <input
                    type="number"
                    bind:value={keypointTime}
                    min="0"
                    max={timeline.duration / 1000}
                    step="0.1"
                />
            </div>

            <div class="dialog-field">
                <label>Easing:</label>
                <select bind:value={keypointEasing}>
                    {#each easingNames as name}
                        <option value={name}>{name}</option>
                    {/each}
                </select>
            </div>

            <div class="dialog-field">
                <label>Values:</label>
                <DeviceControls
                    deviceType={selectedDevice.type}
                    bind:values={keypointValues}
                />
            </div>

            <div class="dialog-actions">
                <button type="button" onclick={saveKeypoint}>Save</button>
                <button type="button" onclick={closeKeypointDialog}>Cancel</button>
            </div>
        </form>
    {/if}
</dialog>

<!-- Settings Dialog -->
<dialog bind:this={settingsDialog} class="settings-dialog">
    <form method="dialog">
        <h3>Timeline Settings</h3>

        <div class="dialog-field">
            <label>Duration (seconds):</label>
            <input
                type="number"
                bind:value={durationSeconds}
                min="1"
                step="0.1"
            />
        </div>

        <div class="dialog-field">
            <label>
                <input type="checkbox" bind:checked={loop} />
                Loop playback
            </label>
        </div>

        <div class="dialog-actions">
            <button type="button" onclick={saveSettings}>Save</button>
            <button type="button" onclick={() => settingsDialog?.close()}>Cancel</button>
        </div>
    </form>
</dialog>

<style>
    .timeline-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #f9f9f9;
    }

    .controls-bar {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        background: #fff;
        border-bottom: 1px solid #ddd;
    }

    .playback-controls {
        display: flex;
        gap: 8px;
    }

    .playback-controls button {
        width: 36px;
        height: 36px;
        padding: 6px;
        border: none;
        background: #007bff;
        color: white;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .playback-controls button:hover {
        background: #0056b3;
    }

    .playback-controls :global(svg) {
        width: 20px;
        height: 20px;
    }

    .time-display {
        font-family: var(--font-stack-mono);
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .settings-button {
        margin-left: auto;
        height: 32px;
        padding: 0 15px;
    }

    .timeline-scrubber {
        padding: 20px 15px;
        background: #fff;
        border-bottom: 1px solid #ddd;
        cursor: pointer;
    }

    .timeline-track {
        position: relative;
        height: 40px;
        background: #e0e0e0;
        border-radius: 4px;
    }

    .timeline-playhead {
        position: absolute;
        top: 0;
        width: 3px;
        height: 100%;
        background: #007bff;
        pointer-events: none;
    }

    .timeline-keypoint-marker {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background: #ffc107;
        border: 2px solid #fff;
        border-radius: 50%;
        pointer-events: none;
    }

    .devices-container {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .empty-state {
        text-align: center;
        padding: 40px;
        color: #999;
    }

    .device-card {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
    }

    .device-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
    }

    .device-header h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
    }

    .device-type {
        font-size: 9pt;
        color: #666;
        padding: 4px 8px;
        background: #f0f0f0;
        border-radius: 4px;
    }

    .add-keypoint-button {
        margin-left: auto;
        height: 28px;
        padding: 0 12px;
        font-size: 9pt;
    }

    .keypoints-list {
        margin-top: 10px;
    }

    .keypoints-list h4 {
        margin: 0 0 10px 0;
        font-size: 10pt;
        color: #555;
    }

    .keypoint-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 6px;
    }

    .keypoint-time {
        font-family: var(--font-stack-mono);
        font-size: 10pt;
        font-weight: 600;
        color: #333;
    }

    .keypoint-easing {
        font-size: 9pt;
        color: #666;
    }

    .keypoint-item button {
        height: 24px;
        padding: 0 10px;
        font-size: 9pt;
        margin-left: auto;
    }

    .keypoint-item button:first-of-type {
        margin-left: auto;
    }

    .no-keypoints {
        font-size: 9pt;
        color: #999;
        margin: 10px 0 0 0;
    }

    .keypoint-dialog,
    .settings-dialog {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 0;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .keypoint-dialog form,
    .settings-dialog form {
        padding: 20px;
    }

    .keypoint-dialog h3,
    .settings-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 12pt;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        font-size: 9pt;
        font-weight: 600;
        color: #555;
        margin-bottom: 5px;
    }

    .dialog-field input[type="number"],
    .dialog-field select {
        width: 100%;
        height: 32px;
        padding: 0 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 10pt;
    }

    .dialog-field input[type="checkbox"] {
        width: auto;
        margin-right: 8px;
    }

    .dialog-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
    }

    .dialog-actions button {
        height: 32px;
        padding: 0 15px;
    }
</style>
