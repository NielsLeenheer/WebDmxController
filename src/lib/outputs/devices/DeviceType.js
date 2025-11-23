/**
 * Base Device Type Class
 *
 * Provides the structure for all DMX device type definitions.
 *
 * NEW ARCHITECTURE:
 * - Device types are CLASSES (definitions, not stored in state)
 * - They reference shared CONTROL_TYPES for controls
 * - Components layer is REMOVED (simplified to startChannel on controls)
 * - Controls now directly specify startChannel and reference control type instances
 *
 * Device types define:
 * - id: String identifier for lookups
 * - name: Display name
 * - channels: Total DMX channels needed
 * - defaultValues: Default DMX values for ALL channels (plain array)
 * - controls: Array of control definitions with { name, type, startChannel, [color] }
 */
export class DeviceType {
    /**
     * @param {Object} config - Device type configuration
     * @param {string} config.id - Unique identifier (e.g., 'RGB', 'MOVING_HEAD_11CH')
     * @param {string} config.name - Display name (e.g., 'RGB Light')
     * @param {number} config.channels - Total DMX channels
     * @param {Array<number>} config.defaultValues - Default values for all channels
     * @param {Array<Object>} config.controls - Control definitions
     */
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.channels = config.channels;
        this.defaultValues = config.defaultValues || new Array(config.channels).fill(0);
        this.controls = config.controls || [];

        // Validate that controls don't overlap
        this._validateControls();
    }

    /**
     * Validate that controls don't overlap channels
     */
    _validateControls() {
        const channelUsage = new Array(this.channels).fill(false);

        for (const control of this.controls) {
            const channelCount = control.type.getChannelCount();
            for (let i = 0; i < channelCount; i++) {
                const channel = control.startChannel + i;
                if (channel >= this.channels) {
                    throw new Error(
                        `Control "${control.name}" exceeds channel count: ` +
                        `channel ${channel} >= ${this.channels} channels`
                    );
                }
            }
        }
    }

    /**
     * Get default channel values for this device type
     * Returns a copy to avoid mutations
     */
    getDefaultValues() {
        return [...this.defaultValues];
    }

    /**
     * Get control definition by name
     * @param {string} name - Control name
     * @returns {Object|undefined} Control definition
     */
    getControl(name) {
        return this.controls.find(c => c.name === name);
    }

    /**
     * Get all control names
     * @returns {Array<string>} Control names
     */
    getControlNames() {
        return this.controls.map(c => c.name);
    }
}

