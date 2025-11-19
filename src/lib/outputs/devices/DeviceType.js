/**
 * Base Device Type Class
 * 
 * Provides the structure for all DMX device type definitions.
 * Each device type defines its channels, components, and controls.
 */
export class DeviceType {
    constructor(name, channels, components, controls, defaultValues = null) {
        this.name = name;
        this.channels = channels;
        this.components = components;
        this.controls = controls;
        this.defaultValues = defaultValues || new Array(channels).fill(0);
    }

    /**
     * Get default channel values for this device type
     * Override this in subclasses to provide device-specific defaults
     */
    getDefaultValues() {
        return [...this.defaultValues];
    }
}

