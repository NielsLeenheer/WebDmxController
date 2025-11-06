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
