// Device type definitions
export const DEVICE_TYPES = {
    RGB: {
        name: 'RGB Light',
        channels: 3,
        controls: [
            { name: 'Red', type: 'slider', color: '#b83838' },
            { name: 'Green', type: 'slider', color: '#4a964a' },
            { name: 'Blue', type: 'slider', color: '#365fb4' }
        ]
    },
    RGBA: {
        name: 'RGBA Light',
        channels: 4,
        controls: [
            { name: 'Red', type: 'slider', color: '#b83838' },
            { name: 'Green', type: 'slider', color: '#4a964a' },
            { name: 'Blue', type: 'slider', color: '#365fb4' },
            { name: 'Amber', type: 'slider', color: '#a68522' }
        ]
    },
    RGBW: {
        name: 'RGBW Light',
        channels: 4,
        controls: [
            { name: 'Red', type: 'slider', color: '#b83838' },
            { name: 'Green', type: 'slider', color: '#4a964a' },
            { name: 'Blue', type: 'slider', color: '#365fb4' },
            { name: 'White', type: 'slider', color: '#808080' }
        ]
    },
    DIMMER: {
        name: 'Dimmer',
        channels: 1,
        controls: [
            { name: 'Intensity', type: 'slider', color: '#888888' }
        ]
    },
    SMOKE: {
        name: 'Smoke Machine',
        channels: 1,
        controls: [
            { name: 'Output', type: 'slider', color: '#666666' }
        ]
    },
    MOVING_HEAD: {
        name: 'Moving Head (Basic)',
        channels: 7,
        controls: [
            { name: 'Pan/Tilt', type: 'xypad', panIndex: 0, tiltIndex: 1 },
            { name: 'Dimmer', type: 'slider', color: '#888888' },
            { name: 'Red', type: 'slider', color: '#b83838' },
            { name: 'Green', type: 'slider', color: '#4a964a' },
            { name: 'Blue', type: 'slider', color: '#365fb4' },
            { name: 'White', type: 'slider', color: '#808080' }
        ]
    },
    FLAMETHROWER: {
        name: 'Flamethrower',
        channels: 2,
        controls: [
            { name: 'Safety', type: 'slider', color: '#ff9800' },
            { name: 'Fuel', type: 'slider', color: '#ff5722' }
        ]
    }
};

export class Device {
    constructor(id, type, startChannel, name = '', linkedTo = null, cssId = null) {
        this.id = id;
        this.type = type;
        this.startChannel = startChannel;
        this.name = name || `${DEVICE_TYPES[type].name} ${id}`;
        this.defaultValues = new Array(DEVICE_TYPES[type].channels).fill(0);
        this.linkedTo = linkedTo; // ID of device to follow, or null
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
