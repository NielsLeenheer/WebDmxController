/**
 * Get color preview for a device based on its type and values
 * @param {string} deviceType - The type of device (RGB, RGBA, RGBW, etc.)
 * @param {Array<number>} values - Array of channel values (0-255)
 * @returns {string} CSS color string
 */
export function getDeviceColor(deviceType, values) {
    if (!values || values.length === 0) {
        return '#000000';
    }

    switch (deviceType) {
        case 'RGB': {
            const [r, g, b] = values;
            return `rgb(${r}, ${g}, ${b})`;
        }

        case 'RGBA': {
            const [r, g, b, a] = values;
            // Mix RGB with amber (#FFBF00)
            // Amber adds to red and green channels
            const amberR = 255;
            const amberG = 191;
            const amberB = 0;

            // Blend amber into the RGB
            const finalR = Math.min(255, r + (amberR * a / 255));
            const finalG = Math.min(255, g + (amberG * a / 255));
            const finalB = Math.min(255, b + (amberB * a / 255));

            return `rgb(${Math.round(finalR)}, ${Math.round(finalG)}, ${Math.round(finalB)})`;
        }

        case 'RGBW': {
            const [r, g, b, w] = values;
            // White adds equally to all channels
            const finalR = Math.min(255, r + w);
            const finalG = Math.min(255, g + w);
            const finalB = Math.min(255, b + w);

            return `rgb(${Math.round(finalR)}, ${Math.round(finalG)}, ${Math.round(finalB)})`;
        }

        case 'MOVING_HEAD': {
            // [0]=Pan, [1]=Tilt, [2]=Dimmer, [3]=Red, [4]=Green, [5]=Blue, [6]=White
            const dimmer = values[2] || 0;
            const r = values[3] || 0;
            const g = values[4] || 0;
            const b = values[5] || 0;
            const w = values[6] || 0;

            // Apply white
            let finalR = Math.min(255, r + w);
            let finalG = Math.min(255, g + w);
            let finalB = Math.min(255, b + w);

            // Apply dimmer
            finalR = Math.round(finalR * dimmer / 255);
            finalG = Math.round(finalG * dimmer / 255);
            finalB = Math.round(finalB * dimmer / 255);

            return `rgb(${finalR}, ${finalG}, ${finalB})`;
        }

        case 'DIMMER': {
            const intensity = values[0] || 0;
            return `rgb(${intensity}, ${intensity}, ${intensity})`;
        }

        case 'SMOKE': {
            const output = values[0] || 0;
            // Show as a blue-gray for smoke
            const blueIntensity = Math.round(output * 0.7);
            return `rgb(${Math.round(output * 0.5)}, ${Math.round(output * 0.5)}, ${blueIntensity})`;
        }

        default:
            return '#000000';
    }
}
