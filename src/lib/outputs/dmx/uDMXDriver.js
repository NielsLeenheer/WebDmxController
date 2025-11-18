import { DMXDriver } from './DMXDriver.js';

/**
 * uDMX Driver (Anyma uDMX)
 * Supports uDMX USB to wireless DMX controllers
 * Uses USB control transfers instead of bulk transfers
 */
export class uDMXDriver extends DMXDriver {
	// USB control transfer constants
	static REQUEST_TYPE = 0x40; // USB_TYPE_VENDOR | USB_RECIP_DEVICE | USB_ENDPOINT_OUT
	static CMD_SET_SINGLE_CHANNEL = 1;
	static CMD_SET_CHANNEL_RANGE = 2;

	constructor() {
		super('uDMX (Anyma)', [
			{ vendorId: 0x16c0, productId: 0x05dc } // Anyma uDMX
		]);
		this.updateRate = 1000 / 44; // ~44 Hz (uDMX is slower than ENTTEC)
		this.interval = null;
		this.universeData = null;
		this.isSending = false; // Prevent overlapping sends
	}

	async connect(device) {
		try {
			this.device = device;

			if (!this.device.opened) {
				await this.device.open();
			}

			// uDMX uses configuration 1, interface 0
			if (this.device.configuration === null) {
				await this.device.selectConfiguration(1);
			}

			await this.device.claimInterface(0);

			this.connected = true;
			this._emit('connected', { driver: this });

			return true;
		} catch (error) {
			console.error('uDMX: Failed to connect:', error);
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
				console.warn('uDMX: Error closing device:', error);
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

		// Skip if a send is already in progress
		if (this.isSending) {
			return;
		}

		this.isSending = true;

		try {
			// uDMX uses control transfers to send DMX data
			// Command: SetChannelRange (2)
			// wValue: number of channels (512)
			// wIndex: starting channel (0)
			// data: channel values (512 bytes)
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: uDMXDriver.CMD_SET_CHANNEL_RANGE,
				value: 512, // number of channels
				index: 0    // starting at channel 0
			}, universeData);
		} catch (error) {
			// uDMX can occasionally have overflow errors, but we don't want to spam the console
			if (error.name !== 'NetworkError') {
				console.error('uDMX: Failed to send DMX data:', error);
				this._emit('error', { error, driver: this });
			}
		} finally {
			this.isSending = false;
		}
	}
}
