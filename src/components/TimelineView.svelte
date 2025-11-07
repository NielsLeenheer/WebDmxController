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
        return new Timeline(30000, true); // Default 30 seconds
    }

    let timeline = $state(loadTimeline());
    let animationFrameId = $state(null);

    // Reactive state for playhead position and timeline changes
    let currentTime = $state(timeline.currentTime);
    let timelineVersion = $state(0); // Increment to force keypoint re-renders

    // Keypoint editing state
    let selectedKeypoint = $state(null);
    let selectedDevice = $state(null);
    let keypointValues = $state([]);
    let keypointEasing = $state('linear');
    let easingNames = getEasingNames();

    // Right panel state
    let rightPanelOpen = $state(false);

    // Timeline settings dialog
    let settingsDialog = $state(null);
    let durationSeconds = $state(timeline.duration / 1000);
    let loop = $state(timeline.loop);

    // Timeline display settings
    const pixelsPerSecond = 100; // How many pixels represent 1 second
    const timelineWidth = $derived((timeline.duration / 1000) * pixelsPerSecond);

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
                currentTime = timeline.currentTime; // Update reactive state
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
        currentTime = timeline.currentTime;
        stopAnimationLoop();
        updateDMXFromTimeline();
    }

    // Click on timeline track to seek
    function handleTimelineClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedTime = (x / timelineWidth) * timeline.duration;
        timeline.seek(clickedTime);
        currentTime = timeline.currentTime;
        updateDMXFromTimeline();
    }

    // Click on timeline track to add keypoint
    function handleTrackClick(e, device) {
        // Prevent if clicking on existing keypoint
        if (e.target.classList.contains('keypoint')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedTime = (x / timelineWidth) * timeline.duration;

        // Create new keypoint at clicked position
        const keypoint = new Keypoint(
            Math.round(clickedTime),
            device.id,
            [...device.defaultValues],
            'linear'
        );

        timeline.addKeypoint(keypoint);
        timelineVersion++; // Force re-render

        // Open for editing
        openKeypointEditor(device, keypoint);
    }

    // Open keypoint in right panel
    function openKeypointEditor(device, keypoint) {
        selectedKeypoint = keypoint;
        selectedDevice = device;
        keypointValues = [...keypoint.values];
        keypointEasing = keypoint.easing;
        rightPanelOpen = true;
    }

    // Save keypoint changes
    function saveKeypointChanges() {
        if (!selectedKeypoint || !selectedDevice) return;

        const updatedKeypoint = new Keypoint(
            selectedKeypoint.time,
            selectedDevice.id,
            keypointValues,
            keypointEasing
        );

        timeline.updateKeypoint(selectedKeypoint, updatedKeypoint);
        timelineVersion++; // Force re-render

        // Update selected keypoint reference
        selectedKeypoint = updatedKeypoint;
        updateDMXFromTimeline();
    }

    // Delete current keypoint
    function deleteCurrentKeypoint() {
        if (!selectedKeypoint) return;

        if (confirm('Delete this keypoint?')) {
            timeline.removeKeypoint(selectedKeypoint);
            timelineVersion++; // Force re-render
            closeRightPanel();
            updateDMXFromTimeline();
        }
    }

    // Close right panel
    function closeRightPanel() {
        rightPanelOpen = false;
        selectedKeypoint = null;
        selectedDevice = null;
    }

    // Get keypoints for a device
    function getDeviceKeypoints(device) {
        // Reference timelineVersion to make this reactive
        timelineVersion;
        return timeline.getDeviceKeypoints(device.id);
    }

    // Calculate keypoint position
    function getKeypointPosition(keypoint) {
        return (keypoint.time / timeline.duration) * timelineWidth;
    }

    // Calculate playhead position
    function getPlayheadPosition() {
        return (currentTime / timeline.duration) * timelineWidth;
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

        // Update currentTime if it exceeds new duration
        if (timeline.currentTime > timeline.duration) {
            timeline.currentTime = timeline.duration;
            currentTime = timeline.currentTime;
        }

        settingsDialog?.close();
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
            {formatTime(currentTime)} / {formatTime(timeline.duration)}
        </div>

        <button class="settings-button" onclick={openSettingsDialog}>
            Settings
        </button>
    </div>

    <!-- Timeline Editor -->
    <div class="timeline-editor">
        <!-- Device Names Column -->
        <div class="device-names">
            <div class="device-names-header">Devices</div>
            {#if devices.length === 0}
                <div class="empty-state">
                    <p>No devices</p>
                    <p>Add devices in the Devices tab</p>
                </div>
            {:else}
                {#each devices as device}
                    <div class="device-name-row">
                        {device.name}
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Timeline Tracks (scrollable) -->
        <div class="timeline-tracks-container">
            <div class="timeline-tracks" style="width: {timelineWidth}px">
                <!-- Time ruler -->
                <div class="time-ruler">
                    {#each Array(Math.ceil(timeline.duration / 1000)) as _, index}
                        <div class="time-marker" style="left: {index * pixelsPerSecond}px">
                            <span>{index}s</span>
                        </div>
                    {/each}
                </div>

                <!-- Playhead -->
                <div class="playhead" style="left: {getPlayheadPosition()}px"></div>

                <!-- Device tracks -->
                {#if devices.length === 0}
                    <div class="empty-tracks"></div>
                {:else}
                    {#each devices as device}
                        <div
                            class="device-track"
                            onclick={(e) => handleTrackClick(e, device)}
                        >
                            {#each getDeviceKeypoints(device) as keypoint}
                                <div
                                    class="keypoint"
                                    class:selected={selectedKeypoint === keypoint}
                                    style="left: {getKeypointPosition(keypoint)}px"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        openKeypointEditor(device, keypoint);
                                    }}
                                    title="{formatTime(keypoint.time)} - {keypoint.easing}"
                                ></div>
                            {/each}
                        </div>
                    {/each}
                {/if}
            </div>
        </div>

        <!-- Right Panel (collapsible) -->
        <div class="right-panel" class:open={rightPanelOpen}>
            {#if rightPanelOpen && selectedKeypoint && selectedDevice}
                <div class="panel-header">
                    <h3>Keypoint Settings</h3>
                    <button class="close-btn" onclick={closeRightPanel}>×</button>
                </div>

                <div class="panel-content">
                    <div class="panel-field">
                        <label>Device:</label>
                        <span class="device-info">{selectedDevice.name}</span>
                    </div>

                    <div class="panel-field">
                        <label>Time:</label>
                        <span class="time-info">{formatTime(selectedKeypoint.time)}</span>
                    </div>

                    <div class="panel-field">
                        <label>Easing:</label>
                        <select bind:value={keypointEasing} onchange={saveKeypointChanges}>
                            {#each easingNames as name}
                                <option value={name}>{name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="panel-field">
                        <label>Values:</label>
                        <DeviceControls
                            deviceType={selectedDevice.type}
                            bind:values={keypointValues}
                            onChange={saveKeypointChanges}
                        />
                    </div>

                    <button class="delete-btn" onclick={deleteCurrentKeypoint}>
                        Delete Keypoint
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

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
                step="1"
            />
        </div>

        <div class="dialog-field">
            <label>
                <input type="checkbox" bind:checked={loop} />
                Loop playback
            </label>
        </div>

        <div class="dialog-actions">
            <button type="button" onclick={() => settingsDialog?.close()}>Cancel</button>
            <button type="button" onclick={saveSettings}>Save</button>
        </div>
    </form>
</dialog>

<style>
    .timeline-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #2a2a2a;
        color: #e0e0e0;
    }

    .controls-bar {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 12px 15px;
        background: #1e1e1e;
        border-bottom: 1px solid #404040;
    }

    .playback-controls {
        display: flex;
        gap: 8px;
    }

    .playback-controls button {
        width: 32px;
        height: 32px;
        padding: 6px;
        border: none;
        background: #0078d4;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .playback-controls button:hover {
        background: #106ebe;
    }

    .playback-controls :global(svg) {
        width: 18px;
        height: 18px;
    }

    .time-display {
        font-family: var(--font-stack-mono);
        font-size: 11pt;
        font-weight: 500;
    }

    .settings-button {
        margin-left: auto;
        height: 32px;
        padding: 0 15px;
        background: #333;
        color: #e0e0e0;
        border: 1px solid #555;
    }

    .settings-button:hover {
        background: #444;
    }

    .timeline-editor {
        display: flex;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    /* Device Names Column */
    .device-names {
        width: 200px;
        background: #252525;
        border-right: 1px solid #404040;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .device-names-header {
        height: 40px;
        display: flex;
        align-items: center;
        padding: 0 15px;
        font-weight: 600;
        background: #1e1e1e;
        border-bottom: 1px solid #404040;
        position: sticky;
        top: 0;
        z-index: 2;
    }

    .device-name-row {
        height: 60px;
        display: flex;
        align-items: center;
        padding: 0 15px;
        border-bottom: 1px solid #333;
        font-size: 10pt;
    }

    .empty-state {
        padding: 40px 20px;
        text-align: center;
        color: #777;
        font-size: 9pt;
    }

    .empty-state p {
        margin: 5px 0;
    }

    /* Timeline Tracks */
    .timeline-tracks-container {
        flex: 1;
        overflow-x: auto;
        overflow-y: auto;
        background: #2a2a2a;
        position: relative;
    }

    .timeline-tracks {
        position: relative;
        min-width: 100%;
        height: 100%;
    }

    .time-ruler {
        height: 40px;
        position: sticky;
        top: 0;
        background: #1e1e1e;
        border-bottom: 1px solid #404040;
        z-index: 2;
    }

    .time-marker {
        position: absolute;
        top: 0;
        height: 100%;
        border-left: 1px solid #404040;
        padding-left: 4px;
        padding-top: 4px;
    }

    .time-marker span {
        font-size: 9pt;
        color: #999;
    }

    .playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #ff4444;
        z-index: 10;
        pointer-events: none;
    }

    .playhead::before {
        content: '';
        position: absolute;
        top: 0;
        left: -5px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #ff4444;
    }

    .device-track {
        height: 60px;
        border-bottom: 1px solid #333;
        position: relative;
        cursor: crosshair;
    }

    .device-track:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .empty-tracks {
        height: 60px;
        border-bottom: 1px solid #333;
    }

    .keypoint {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 14px;
        background: #0078d4;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: pointer;
        z-index: 5;
        transition: all 0.15s ease;
    }

    .keypoint:hover {
        width: 18px;
        height: 18px;
        background: #106ebe;
    }

    .keypoint.selected {
        background: #ffa500;
        border-color: #ffd700;
        box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
    }

    /* Right Panel */
    .right-panel {
        width: 0;
        background: #252525;
        border-left: 1px solid #404040;
        overflow: hidden;
        transition: width 0.3s ease;
        display: flex;
        flex-direction: column;
    }

    .right-panel.open {
        width: 320px;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px;
        border-bottom: 1px solid #404040;
        background: #1e1e1e;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
    }

    .close-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        border: none;
        color: #999;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        border-radius: 4px;
    }

    .close-btn:hover {
        background: #333;
        color: #fff;
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }

    .panel-field {
        margin-bottom: 20px;
    }

    .panel-field label {
        display: block;
        margin-bottom: 6px;
        font-size: 9pt;
        font-weight: 600;
        color: #aaa;
    }

    .device-info,
    .time-info {
        display: block;
        padding: 8px 12px;
        background: #1e1e1e;
        border-radius: 4px;
        font-size: 10pt;
    }

    .panel-field select {
        width: 100%;
        padding: 8px 12px;
        background: #1e1e1e;
        color: #e0e0e0;
        border: 1px solid #404040;
        border-radius: 4px;
        font-size: 10pt;
    }

    .delete-btn {
        width: 100%;
        padding: 10px;
        background: #c53030;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10pt;
        font-weight: 600;
        margin-top: 10px;
    }

    .delete-btn:hover {
        background: #9b2c2c;
    }

    /* Settings Dialog */
    .settings-dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        max-width: 400px;
        width: 90%;
        background: #2a2a2a;
        color: #e0e0e0;
    }

    .settings-dialog::backdrop {
        background: rgba(0, 0, 0, 0.7);
    }

    .settings-dialog form {
        padding: 20px;
    }

    .settings-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 12pt;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        margin-bottom: 6px;
        font-size: 10pt;
    }

    .dialog-field input[type="number"] {
        width: 100%;
        padding: 8px 12px;
        background: #1e1e1e;
        color: #e0e0e0;
        border: 1px solid #404040;
        border-radius: 4px;
        font-size: 10pt;
    }

    .dialog-field input[type="checkbox"] {
        margin-right: 8px;
    }

    .dialog-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }

    .dialog-actions button {
        padding: 8px 20px;
        border-radius: 4px;
        font-size: 10pt;
    }

    .dialog-actions button[type="button"]:first-child {
        background: #333;
        color: #e0e0e0;
        border: 1px solid #555;
    }

    .dialog-actions button[type="button"]:last-child {
        background: #0078d4;
        color: white;
        border: none;
    }
</style>
