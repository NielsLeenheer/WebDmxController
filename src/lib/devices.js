// Device type definitions
export const DEVICE_TYPES = {
    RGB: {
        name: 'RGB Light',
        channels: 3,
        components: [
            { name: 'Red', channel: 0 },
            { name: 'Green', channel: 1 },
            { name: 'Blue', channel: 2 }
        ],
        controls: [
            {
                name: 'Color',
                type: 'rgb',
                components: { r: 0, g: 1, b: 2 }
            }
        ]
    },
    RGBA: {
        name: 'RGBA Light',
        channels: 4,
        components: [
            { name: 'Red', channel: 0 },
            { name: 'Green', channel: 1 },
            { name: 'Blue', channel: 2 },
            { name: 'Amber', channel: 3 }
        ],
        controls: [
            {
                name: 'Color',
                type: 'rgb',
                components: { r: 0, g: 1, b: 2 }
            },
            {
                name: 'Amber',
                type: 'slider',
                color: '#ffbf00',
                components: { value: 3 }
            }
        ]
    },
    RGBW: {
        name: 'RGBW Light',
        channels: 4,
        components: [
            { name: 'Red', channel: 0 },
            { name: 'Green', channel: 1 },
            { name: 'Blue', channel: 2 },
            { name: 'White', channel: 3 }
        ],
        controls: [
            {
                name: 'Color',
                type: 'rgb',
                components: { r: 0, g: 1, b: 2 }
            },
            {
                name: 'White',
                type: 'slider',
                color: '#808080',
                components: { value: 3 }
            }
        ]
    },
    DIMMER: {
        name: 'Dimmer',
        channels: 1,
        components: [
            { name: 'Intensity', channel: 0 }
        ],
        controls: [
            {
                name: 'Intensity',
                type: 'slider',
                color: '#888888',
                components: { value: 0 }
            }
        ]
    },
    SMOKE: {
        name: 'Smoke Machine',
        channels: 1,
        components: [
            { name: 'Output', channel: 0 }
        ],
        controls: [
            {
                name: 'Output',
                type: 'slider',
                color: '#666666',
                components: { value: 0 }
            }
        ]
    },
    MOVING_HEAD: {
        name: 'Moving Head (Basic)',
        channels: 7,
        components: [
            { name: 'Pan', channel: 0 },
            { name: 'Tilt', channel: 1 },
            { name: 'Dimmer', channel: 2 },
            { name: 'Red', channel: 3 },
            { name: 'Green', channel: 4 },
            { name: 'Blue', channel: 5 },
            { name: 'White', channel: 6 }
        ],
        controls: [
            {
                name: 'Pan/Tilt',
                type: 'xypad',
                components: { x: 0, y: 1 }
            },
            {
                name: 'Dimmer',
                type: 'slider',
                color: '#888888',
                components: { value: 2 }
            },
            {
                name: 'Color',
                type: 'rgb',
                components: { r: 3, g: 4, b: 5 }
            },
            {
                name: 'White',
                type: 'slider',
                color: '#808080',
                components: { value: 6 }
            }
        ]
    },
    FLAMETHROWER: {
        name: 'Flamethrower',
        channels: 2,
        components: [
            { name: 'Safety', channel: 0 },
            { name: 'Fuel', channel: 1 }
        ],
        controls: [
            {
                name: 'Safety',
                type: 'toggle',
                offValue: 0,
                onValue: 125,
                components: { value: 0 }
            },
            {
                name: 'Fuel',
                type: 'slider',
                color: '#ff5722',
                components: { value: 1 }
            }
        ]
    }
};

export class Device {
    constructor(id, type, startChannel, name = '', linkedTo = null, cssId = null, syncedChannels = null, mirrorPan = false) {
        this.id = id;
        this.type = type;
        this.startChannel = startChannel;
        this.name = name || `${DEVICE_TYPES[type].name} ${id}`;
        this.defaultValues = new Array(DEVICE_TYPES[type].channels).fill(0);
        this.linkedTo = linkedTo; // ID of device to follow, or null
        this.syncedChannels = syncedChannels; // Array of semantic channel names to sync, or null for all
        this.mirrorPan = mirrorPan; // Whether to mirror pan values for linked devices
        this.cssId = cssId || this.generateCssId(this.name);
    }

    /**
     * Generate CSS-safe ID from device name
     */
    generateCssId(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/_+/g, '_')          // Collapse multiple underscores
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
    }

    /**
     * Update CSS ID when name changes
     */
    updateCssId() {
        this.cssId = this.generateCssId(this.name);
    }

    setValue(controlIndex, value) {
        this.defaultValues[controlIndex] = Math.max(0, Math.min(255, value));
    }

    getValue(controlIndex) {
        return this.defaultValues[controlIndex];
    }

    getChannelValues() {
        return this.defaultValues;
    }

    isLinked() {
        return this.linkedTo !== null;
    }
}
