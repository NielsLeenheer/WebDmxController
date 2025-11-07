<script>
    import { Icon } from 'svelte-icon';
    import playIcon from '../assets/icons/play.svg?raw';
    import pauseIcon from '../assets/icons/pause.svg?raw';
    import stopIcon from '../assets/icons/stop.svg?raw';
    import DeviceControls from './DeviceControls.svelte';
    import { DEVICE_TYPES } from '../lib/devices.js';
    import { Timeline, Keypoint } from '../lib/timeline.js';
    import { getEasingNames } from '../lib/easing.js';
    import { getMappedChannels } from '../lib/channelMapping.js';

    let {
        dmxController = null,
        devices = []
    } = $props();

    // Filter devices that should appear in timeline
    // Exclude devices where ALL channels are linked
    const timelineDevices = $derived(devices.filter(device => {
        if (!device.linkedTo) return true; // Not linked, include it

        const sourceDevice = devices.find(d => d.id === device.linkedTo);
        if (!sourceDevice) return true; // Source not found, include it

        const mappedChannels = getMappedChannels(sourceDevice.type, device.type);
        const totalChannels = DEVICE_TYPES[device.type].channels;

        // Include if not all channels are mapped (has some non-linked channels)
        return mappedChannels.length < totalChannels;
    }));

    // Get disabled channels for a device (for use in right panel)
    function getDisabledChannelsForDevice(device) {
        if (!device.linkedTo) return [];

        const sourceDevice = devices.find(d => d.id === device.linkedTo);
        if (!sourceDevice) return [];

        return getMappedChannels(sourceDevice.type, device.type);
    }

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

    // Keypoint dragging state
    let draggingKeypoint = $state(null);
    let dragStartX = $state(0);
    let dragStartTime = $state(0);

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

    // Keypoint dragging
    function handleKeypointMouseDown(e, keypoint, device) {
        e.stopPropagation();
        e.preventDefault();

        draggingKeypoint = keypoint;
        dragStartX = e.clientX;
        dragStartTime = keypoint.time;

        // Add global mouse handlers
        document.addEventListener('mousemove', handleKeypointMouseMove);
        document.addEventListener('mouseup', handleKeypointMouseUp);
    }

    function handleKeypointMouseMove(e) {
        if (!draggingKeypoint) return;

        const deltaX = e.clientX - dragStartX;
        const deltaTime = (deltaX / timelineWidth) * timeline.duration;
        let newTime = Math.round(dragStartTime + deltaTime);

        // Clamp to timeline duration
        newTime = Math.max(0, Math.min(timeline.duration, newTime));

        // Find the device for this keypoint
        const device = timelineDevices.find(d => d.id === draggingKeypoint.deviceId);
        if (!device) return;

        // Create updated keypoint with new time
        const updatedKeypoint = new Keypoint(
            newTime,
            draggingKeypoint.deviceId,
            draggingKeypoint.values,
            draggingKeypoint.easing
        );

        timeline.updateKeypoint(draggingKeypoint, updatedKeypoint);
        draggingKeypoint = updatedKeypoint;

        // Update selected keypoint if it's the one being dragged
        if (selectedKeypoint === draggingKeypoint) {
            selectedKeypoint = updatedKeypoint;
        }

        timelineVersion++;
    }

    function handleKeypointMouseUp(e) {
        document.removeEventListener('mousemove', handleKeypointMouseMove);
        document.removeEventListener('mouseup', handleKeypointMouseUp);
        draggingKeypoint = null;
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
            {#if timelineDevices.length === 0}
                <div class="empty-state">
                    <p>No devices</p>
                    <p>Add devices in the Devices tab</p>
                </div>
            {:else}
                {#each timelineDevices as device}
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
                {#if timelineDevices.length === 0}
                    <div class="empty-tracks"></div>
                {:else}
                    {#each timelineDevices as device}
                        <div
                            class="device-track"
                            onclick={(e) => handleTrackClick(e, device)}
                        >
                            {#each getDeviceKeypoints(device) as keypoint}
                                <div
                                    class="keypoint"
                                    class:selected={selectedKeypoint === keypoint}
                                    class:dragging={draggingKeypoint === keypoint}
                                    style="left: {getKeypointPosition(keypoint)}px"
                                    onmousedown={(e) => handleKeypointMouseDown(e, keypoint, device)}
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        if (!draggingKeypoint) {
                                            openKeypointEditor(device, keypoint);
                                        }
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
                            disabledChannels={getDisabledChannelsForDevice(selectedDevice)}
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
        background: #f9f9f9;
        color: #333;
    }

    .controls-bar {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 12px 15px;
        background: #fff;
        border-bottom: 1px solid #ddd;
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
        background: #f0f0f0;
        color: #333;
        border: 1px solid #ccc;
    }

    .settings-button:hover {
        background: #e0e0e0;
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
        background: #f5f5f5;
        border-right: 1px solid #ddd;
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
        background: #fff;
        border-bottom: 1px solid #ddd;
        position: sticky;
        top: 0;
        z-index: 2;
    }

    .device-name-row {
        height: 60px;
        display: flex;
        align-items: center;
        padding: 0 15px;
        border-bottom: 1px solid #e0e0e0;
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
        background: #fafafa;
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
        background: #fff;
        border-bottom: 1px solid #ddd;
        z-index: 2;
    }

    .time-marker {
        position: absolute;
        top: 0;
        height: 100%;
        border-left: 1px solid #e0e0e0;
        padding-left: 4px;
        padding-top: 4px;
    }

    .time-marker span {
        font-size: 9pt;
        color: #666;
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
        border-bottom: 1px solid #e0e0e0;
        position: relative;
        cursor: crosshair;
    }

    .device-track:hover {
        background: rgba(0, 0, 0, 0.02);
    }

    .empty-tracks {
        height: 60px;
        border-bottom: 1px solid #e0e0e0;
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

    .keypoint.dragging {
        cursor: grabbing;
        z-index: 15;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    /* Right Panel */
    .right-panel {
        width: 0;
        background: #f5f5f5;
        border-left: 1px solid #ddd;
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
        border-bottom: 1px solid #ddd;
        background: #fff;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .close-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        border: none;
        color: #666;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        border-radius: 4px;
    }

    .close-btn:hover {
        background: #e0e0e0;
        color: #333;
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
        color: #555;
    }

    .device-info,
    .time-info {
        display: block;
        padding: 8px 12px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 10pt;
        color: #333;
    }

    .panel-field select {
        width: 100%;
        padding: 8px 12px;
        background: #fff;
        color: #333;
        border: 1px solid #ddd;
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
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        max-width: 400px;
        width: 90%;
        background: #fff;
        color: #333;
    }

    .settings-dialog::backdrop {
        background: rgba(0, 0, 0, 0.4);
    }

    .settings-dialog form {
        padding: 20px;
    }

    .settings-dialog h3 {
        margin: 0 0 20px 0;
        font-size: 12pt;
        font-weight: 600;
    }

    .dialog-field {
        margin-bottom: 15px;
    }

    .dialog-field label {
        display: block;
        margin-bottom: 6px;
        font-size: 10pt;
        color: #555;
    }

    .dialog-field input[type="number"] {
        width: 100%;
        padding: 8px 12px;
        background: #fff;
        color: #333;
        border: 1px solid #ddd;
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
        cursor: pointer;
    }

    .dialog-actions button[type="button"]:first-child {
        background: #f0f0f0;
        color: #333;
        border: 1px solid #ccc;
    }

    .dialog-actions button[type="button"]:first-child:hover {
        background: #e0e0e0;
    }

    .dialog-actions button[type="button"]:last-child {
        background: #0078d4;
        color: white;
        border: none;
    }

    .dialog-actions button[type="button"]:last-child:hover {
        background: #106ebe;
    }
</style>
