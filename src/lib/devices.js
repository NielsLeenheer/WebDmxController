// Device type definitions
export const DEVICE_TYPES = {
    RGB: {
        name: 'RGB Light',
        channels: 3,
        controls: [
            { name: 'Red', type: 'slider', color: '#ff0000' },
            { name: 'Green', type: 'slider', color: '#00ff00' },
            { name: 'Blue', type: 'slider', color: '#0000ff' }
        ]
    },
    RGBA: {
        name: 'RGBA Light',
        channels: 4,
        controls: [
            { name: 'Red', type: 'slider', color: '#ff0000' },
            { name: 'Green', type: 'slider', color: '#00ff00' },
            { name: 'Blue', type: 'slider', color: '#0000ff' },
            { name: 'Amber', type: 'slider', color: '#ffbf00' }
        ]
    },
    RGBW: {
        name: 'RGBW Light',
        channels: 4,
        controls: [
            { name: 'Red', type: 'slider', color: '#ff0000' },
            { name: 'Green', type: 'slider', color: '#00ff00' },
            { name: 'Blue', type: 'slider', color: '#0000ff' },
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
            { name: 'Pan', type: 'slider', color: '#888888' },
            { name: 'Tilt', type: 'slider', color: '#888888' },
            { name: 'Dimmer', type: 'slider', color: '#888888' },
            { name: 'Red', type: 'slider', color: '#ff0000' },
            { name: 'Green', type: 'slider', color: '#00ff00' },
            { name: 'Blue', type: 'slider', color: '#0000ff' },
            { name: 'White', type: 'slider', color: '#808080' }
        ]
    }
};

export class Device {
    constructor(id, type, startChannel, name = '') {
        this.id = id;
        this.type = type;
        this.startChannel = startChannel;
        this.name = name || `${DEVICE_TYPES[type].name} ${id}`;
        this.values = new Array(DEVICE_TYPES[type].channels).fill(0);
    }

    setValue(controlIndex, value) {
        this.values[controlIndex] = Math.max(0, Math.min(255, value));
    }

    getValue(controlIndex) {
        return this.values[controlIndex];
    }

    getChannelValues() {
        return this.values;
    }
}
