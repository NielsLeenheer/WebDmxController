const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_PATTERN = /^rgba?\(([^)]+)\)$/i;

const NAMED_INPUT_COLOR_MAP = {
    'off': '#000000',
    'black': '#000000',
    'gray': '#a6a6a6',
    'grey': '#a6a6a6',
    'white': '#ffffff',
    'red': '#ff4d4f',
    'red-dim': '#a8071a',
    'red-half': '#d32029',
    'red-bright': '#ff7875',
    'orange': '#fa8c16',
    'orange-dim': '#ad4e00',
    'orange-half': '#d46b08',
    'orange-bright': '#ffa940',
    'yellow': '#fadb14',
    'yellow-dim': '#ad8b00',
    'yellow-half': '#d4b106',
    'yellow-bright': '#ffe58f',
    'lime': '#a0d911',
    'lime-dim': '#5b8c00',
    'lime-half': '#7cb305',
    'lime-bright': '#bae637',
    'green': '#52c41a',
    'green-dim': '#237804',
    'green-half': '#389e0d',
    'green-bright': '#73d13d',
    'spring': '#36cfc9',
    'spring-dim': '#137d7c',
    'spring-half': '#189a97',
    'spring-bright': '#5cdbd3',
    'turquoise': '#13c2c2',
    'turquoise-dim': '#006d75',
    'turquoise-half': '#08979c',
    'turquoise-bright': '#36cfc9',
    'cyan': '#0894ff',
    'cyan-dim': '#0958d9',
    'cyan-half': '#1677ff',
    'cyan-bright': '#69b1ff',
    'sky': '#40a9ff',
    'sky-dim': '#1d39c4',
    'sky-half': '#2f54eb',
    'sky-bright': '#85a5ff',
    'blue': '#2f54eb',
    'blue-dim': '#10239e',
    'blue-half': '#1d39c4',
    'blue-bright': '#597ef7',
    'violet': '#722ed1',
    'violet-dim': '#391085',
    'violet-half': '#531dab',
    'violet-bright': '#9254de',
    'purple': '#531dab',
    'purple-dim': '#22075e',
    'purple-half': '#391085',
    'purple-bright': '#9254de',
    'magenta': '#eb2f96',
    'magenta-dim': '#9e1068',
    'magenta-half': '#c41d7f',
    'magenta-bright': '#f759ab',
    'pink': '#ff85c0',
    'pink-dim': '#ad1457',
    'pink-half': '#d81b60',
    'pink-bright': '#ffadd2'
};

function clamp(value, min = 0, max = 255) {
    return Math.max(min, Math.min(max, value));
}

function scale7BitToCss(value) {
    const clamped = clamp(typeof value === 'number' ? value : 0, 0, 127);
    return Math.round((clamped / 127) * 255);
}

function parseObjectColor(color) {
    const r = typeof color.r === 'number' ? color.r : 0;
    const g = typeof color.g === 'number' ? color.g : 0;
    const b = typeof color.b === 'number' ? color.b : 0;
    const maxChannel = Math.max(r, g, b);
    const needsScaling = maxChannel <= 127;
    const normalize = needsScaling
        ? (value) => scale7BitToCss(value)
        : (value) => clamp(Math.round(value), 0, 255);

    return `rgb(${normalize(r)}, ${normalize(g)}, ${normalize(b)})`;
}

function normalizeColorName(color) {
    return typeof color === 'string' ? color.trim().toLowerCase() : null;
}

export function getInputColorCSS(color) {
    if (color == null) {
        return 'transparent';
    }

    if (typeof color === 'string') {
        const trimmed = color.trim();
        const normalized = trimmed.toLowerCase();

        if (!trimmed) {
            return 'transparent';
        }

        if (HEX_PATTERN.test(trimmed) || RGB_PATTERN.test(trimmed)) {
            return trimmed;
        }

        return NAMED_INPUT_COLOR_MAP[normalized] || trimmed;
    }

    if (typeof color === 'number') {
        const channel = scale7BitToCss(color);
        return `rgb(${channel}, ${channel}, ${channel})`;
    }

    if (typeof color === 'object') {
        return parseObjectColor(color);
    }

    return 'transparent';
}

export function getAllInputColorOptions() {
    return { ...NAMED_INPUT_COLOR_MAP };
}
