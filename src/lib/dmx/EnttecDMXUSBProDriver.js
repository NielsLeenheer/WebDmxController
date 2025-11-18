import { DMXDriver } from './DMXDriver.js';

/**
 * ENTTEC DMX USB Pro Driver
 * Supports ENTTEC DMX USB Pro and compatible devices
 */
export class EnttecDMXUSBProDriver extends DMXDriver {
	// Protocol constants
	static DMX_STARTCODE = 0x00;
	static START_OF_MSG = 0x7e;
	static END_OF_MSG = 0xe7;
	static SEND_DMX_RQ = 0x06;

	constructor() {
		super('ENTTEC DMX USB Pro', [
			// ENTTEC uses FTDI chips with vendor ID 0x0403
			// Product ID is typically 0x6001 (same as generic FT232R!)
			// The difference is the PROTOCOL - ENTTEC uses proprietary protocol
			{ vendorId: 0x0403, productId: 0x6001 },
			{ vendorId: 0x0403 } // Fallback: match any FTDI device
		]);
		this.updateRate = 1000 / 60; // 60 fps
		this.interval = null;
		this.universeData = null;
	}

	async connect(device) {
		try {
			this.device = device;

			if (!this.device.opened) {
				await this.device.open();
			}

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
			this._emit('connected', { driver: this });

			return true;
		} catch (error) {
			console.error('ENTTEC: Failed to connect:', error);
			this._emit('error', { error, driver: this });
			throw error;
		}
	}

	disconnect() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}

		if (this.device) {
			try {
				this.device.close();
			} catch (error) {
				console.warn('ENTTEC: Error closing device:', error);
			}
			this.device = null;
		}

		this.connected = false;
		this.universeData = null;
		this._emit('disconnected', { driver: this });
	}

	/**
	 * Start continuous DMX output
	 * @param {Uint8Array} universeData - Reference to the 512-byte universe array
	 */
	startOutput(universeData) {
		this.universeData = universeData;

		if (this.interval) {
			clearInterval(this.interval);
		}

		// Start sending DMX data at regular intervals
		this.interval = setInterval(() => {
			this.sendUniverse(this.universeData);
		}, this.updateRate);
	}

	/**
	 * Stop continuous DMX output
	 */
	stopOutput() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async sendUniverse(universeData) {
		if (!this.device || !this.connected || !universeData) return;

		const message = Uint8Array.from([
			EnttecDMXUSBProDriver.DMX_STARTCODE,
			...universeData
		]);

		const packet = Uint8Array.from([
			EnttecDMXUSBProDriver.START_OF_MSG,
			EnttecDMXUSBProDriver.SEND_DMX_RQ,
			message.length & 0xff,
			(message.length >> 8) & 0xff,
			...message,
			EnttecDMXUSBProDriver.END_OF_MSG
		]);

		try {
			await this.device.transferOut(2, packet);
		} catch (error) {
			console.error('ENTTEC: Failed to send DMX data:', error);
			this._emit('error', { error, driver: this });
		}
	}
}
