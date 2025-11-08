// ENTTEC DMX USB Pro protocol constants
const ENTTEC_PRO_DMX_STARTCODE = 0x00;
const ENTTEC_PRO_START_OF_MSG = 0x7e;
const ENTTEC_PRO_END_OF_MSG = 0xe7;
const ENTTEC_PRO_SEND_DMX_RQ = 0x06;

export class DMXController {
    constructor() {
        this.universe = new Uint8Array(512).fill(0);
        this.device = null;
        this.interval = null;
        this.updateRate = 1000 / 60; // 60 fps
        this.connected = false;
    }

    async connect() {
        if (!('usb' in navigator)) {
            throw new Error('WebUSB is not supported in this browser');
        }

        try {
            // Request USB device (FTDI vendor ID 0x0403 for ENTTEC)
            this.device = await navigator.usb.requestDevice({
                filters: [{ vendorId: 0x0403 }]
            });

            await this.device.open();
            await this.device.claimInterface(0);

            // Set control transfer
            await this.device.controlTransferOut({
                requestType: 'class',
                recipient: 'interface',
                request: 0x22,
                value: 0x01,
                index: 0x00
            });

            this.connected = true;

            // Start sending DMX data at regular intervals
            this.interval = setInterval(() => {
                this.sendUniverse();
            }, this.updateRate);

            return true;
        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    }

    disconnect() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.device) {
            this.device.close();
            this.device = null;
        }

        this.connected = false;
    }

    setChannel(channel, value) {
        if (channel >= 0 && channel < 512) {
            this.universe[channel] = Math.max(0, Math.min(255, value));
        }
    }

    getChannel(channel) {
        return this.universe[channel] || 0;
    }

    setChannels(startChannel, values) {
        values.forEach((value, index) => {
            this.setChannel(startChannel + index, value);
        });
    }

    getUniverse() {
        return this.universe;
    }

    clearUniverse() {
        this.universe.fill(0);
    }

    sendUniverse() {
        if (!this.device || !this.connected) return;

        const message = Uint8Array.from([
            ENTTEC_PRO_DMX_STARTCODE,
            ...this.universe
        ]);

        const packet = Uint8Array.from([
            ENTTEC_PRO_START_OF_MSG,
            ENTTEC_PRO_SEND_DMX_RQ,
            message.length & 0xff,
            (message.length >> 8) & 0xff,
            ...message,
            ENTTEC_PRO_END_OF_MSG
        ]);

        this.device.transferOut(2, packet).catch(err => {
            console.error('Failed to send DMX data:', err);
        });
    }
}
