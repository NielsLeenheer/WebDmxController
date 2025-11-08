import { interpolate } from './easing.js';

/**
 * Keypoint represents device values at a specific time
 */
export class Keypoint {
    constructor(time, deviceId, values, easing = 'linear') {
        this.time = time; // Time in milliseconds
        this.deviceId = deviceId;
        this.values = [...values]; // Array of channel values
        this.easing = easing; // Easing function to use when interpolating TO this keypoint
    }
}

/**
 * Timeline manages keypoints and playback
 */
export class Timeline {
    constructor(duration = 10000, loop = true) {
        this.duration = duration; // Duration in milliseconds
        this.loop = loop;
        this.keypoints = []; // Array of Keypoint objects
        this.playing = false;
        this.currentTime = 0;
        this.lastUpdateTime = null;
    }

    /**
     * Add a keypoint to the timeline
     */
    addKeypoint(keypoint) {
        this.keypoints.push(keypoint);
        this.sortKeypoints();
    }

    /**
     * Remove a keypoint from the timeline
     */
    removeKeypoint(keypoint) {
        const index = this.keypoints.indexOf(keypoint);
        if (index > -1) {
            this.keypoints.splice(index, 1);
        }
    }

    /**
     * Update an existing keypoint
     */
    updateKeypoint(oldKeypoint, newKeypoint) {
        const index = this.keypoints.indexOf(oldKeypoint);
        if (index > -1) {
            this.keypoints[index] = newKeypoint;
            this.sortKeypoints();
        }
    }

    /**
     * Sort keypoints by time
     */
    sortKeypoints() {
        this.keypoints.sort((a, b) => a.time - b.time);
    }

    /**
     * Get all keypoints for a specific device
     */
    getDeviceKeypoints(deviceId) {
        return this.keypoints.filter(kp => kp.deviceId === deviceId);
    }

    /**
     * Get keypoints surrounding current time for a device
     */
    getSurroundingKeypoints(deviceId, time) {
        const deviceKeypoints = this.getDeviceKeypoints(deviceId);

        if (deviceKeypoints.length === 0) {
            return { before: null, after: null };
        }

        let before = null;
        let after = null;

        for (let i = 0; i < deviceKeypoints.length; i++) {
            if (deviceKeypoints[i].time <= time) {
                before = deviceKeypoints[i];
            }
            if (deviceKeypoints[i].time >= time && !after) {
                after = deviceKeypoints[i];
                break;
            }
        }

        return { before, after };
    }

    /**
     * Calculate interpolated values for a device at a specific time
     */
    getDeviceValuesAtTime(deviceId, time, defaultValues) {
        const deviceKeypoints = this.getDeviceKeypoints(deviceId);

        // No keypoints for this device - use default values
        if (deviceKeypoints.length === 0) {
            return defaultValues;
        }

        // Determine starting/ending value (value at 00:00:00)
        // If there's a keypoint at time 0, use that. Otherwise use defaultValues
        const keypointAtZero = deviceKeypoints.find(kp => kp.time === 0);
        const startingValue = keypointAtZero ? keypointAtZero.values : defaultValues;

        const firstKeypoint = deviceKeypoints[0];
        const lastKeypoint = deviceKeypoints[deviceKeypoints.length - 1];

        // Before first keypoint - interpolate from starting value to first keypoint
        if (time < firstKeypoint.time) {
            const timeDiff = firstKeypoint.time - 0;
            const t = time / timeDiff;

            const interpolatedValues = startingValue.map((startValue, channelIndex) => {
                const endValue = firstKeypoint.values[channelIndex];
                return interpolate(startValue, endValue, t, firstKeypoint.easing);
            });

            return interpolatedValues;
        }

        // After last keypoint - interpolate from last keypoint back to starting value
        if (time > lastKeypoint.time) {
            const timeDiff = this.duration - lastKeypoint.time;
            const t = (time - lastKeypoint.time) / timeDiff;

            const interpolatedValues = lastKeypoint.values.map((startValue, channelIndex) => {
                const endValue = startingValue[channelIndex];
                return interpolate(startValue, endValue, t, 'linear'); // Use linear for return to start
            });

            return interpolatedValues;
        }

        // Between keypoints or exactly on a keypoint
        const { before, after } = this.getSurroundingKeypoints(deviceId, time);

        // Exactly on a keypoint
        if (before && after && before === after) {
            return before.values;
        }

        // Between two keypoints - interpolate
        if (before && after && before !== after) {
            const timeDiff = after.time - before.time;
            const t = (time - before.time) / timeDiff;

            const interpolatedValues = before.values.map((startValue, channelIndex) => {
                const endValue = after.values[channelIndex];
                return interpolate(startValue, endValue, t, after.easing);
            });

            return interpolatedValues;
        }

        // Fallback (should not reach here)
        return before ? before.values : startingValue;
    }

    /**
     * Get interpolated values for all devices at current time
     */
    getAllDeviceValuesAtTime(devices) {
        const deviceValues = new Map();

        devices.forEach(device => {
            const values = this.getDeviceValuesAtTime(
                device.id,
                this.currentTime,
                device.defaultValues
            );
            deviceValues.set(device.id, values);
        });

        return deviceValues;
    }

    /**
     * Start playback
     */
    play() {
        this.playing = true;
        this.lastUpdateTime = Date.now();
    }

    /**
     * Pause playback
     */
    pause() {
        this.playing = false;
        this.lastUpdateTime = null;
    }

    /**
     * Stop playback and reset to start
     */
    stop() {
        this.playing = false;
        this.currentTime = 0;
        this.lastUpdateTime = null;
    }

    /**
     * Update timeline (call this in animation loop)
     * Returns true if time was updated
     */
    update() {
        if (!this.playing) {
            return false;
        }

        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        this.currentTime += deltaTime;

        // Handle looping or stopping at end
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                this.currentTime = this.currentTime % this.duration;
            } else {
                this.currentTime = this.duration;
                this.pause();
            }
        }

        return true;
    }

    /**
     * Seek to a specific time
     */
    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        if (this.playing) {
            this.lastUpdateTime = Date.now();
        }
    }

    /**
     * Export timeline to JSON
     */
    toJSON() {
        return {
            duration: this.duration,
            loop: this.loop,
            keypoints: this.keypoints.map(kp => ({
                time: kp.time,
                deviceId: kp.deviceId,
                values: kp.values,
                easing: kp.easing
            }))
        };
    }

    /**
     * Import timeline from JSON
     */
    static fromJSON(data) {
        const timeline = new Timeline(data.duration, data.loop);
        timeline.keypoints = data.keypoints.map(kp =>
            new Keypoint(kp.time, kp.deviceId, kp.values, kp.easing)
        );
        return timeline;
    }
}
