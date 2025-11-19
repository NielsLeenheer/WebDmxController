import { DMXDriver } from './DMXDriver.js';

/**
 * FT232R Driver
 * Supports generic FTDI FT232R USB to DMX cables
 * Uses FTDI serial protocol over USB
 */
export class FT232RDriver extends DMXDriver {
	// FTDI SIO Commands
	static FTDI_SIO_RESET = 0;
	static FTDI_SIO_SET_BAUD_RATE = 3;
	static FTDI_SIO_SET_DATA = 4;
	static FTDI_SIO_SET_FLOW_CTRL = 2;

	// Data format bits for 8N2 (8 data bits, no parity, 2 stop bits)
	static DATA_BITS_8 = 0x08;
	static PARITY_NONE = 0x00 << 8;
	static STOP_BITS_2 = 0x02 << 11;
	static DATA_FORMAT_8N2 = 0x1008; // 8 data bits | no parity | 2 stop bits

	// Break control
	static BREAK_ON = 0x4000;  // Bit 14
	static BREAK_OFF = 0x0000;

	constructor() {
		super('FT232R USB-DMX', [
			{ vendorId: 0x0403, productId: 0x6001 } // FTDI FT232R
		]);
		this.updateRate = 1000 / 25; // ~25 Hz (slower for Enttec Open DMX)
		this.interval = null;
		this.universeData = null;
		this.outEndpoint = null; // OUT endpoint for bulk transfers
		this.interfaceNumber = 0;
		this.errorCount = 0;
		this.maxErrors = 5; // Stop after 5 consecutive errors
		this.isSending = false; // Prevent overlapping sends
	}

	async connect(device) {
		try {
			this.device = device;

			if (!this.device.opened) {
				await this.device.open();
			}

			// Select configuration if needed
			if (this.device.configuration === null) {
				await this.device.selectConfiguration(1);
			}

			// Get the first interface
			const iface = this.device.configuration.interfaces[0];
			this.interfaceNumber = iface.interfaceNumber;
			
			await this.device.claimInterface(this.interfaceNumber);

			// Find the OUT endpoint for bulk transfers
			console.log('FT232R: Interface endpoints:', iface.alternate.endpoints.map(ep => ({
				number: ep.endpointNumber,
				direction: ep.direction,
				type: ep.type
			})));
			
			for (const endpoint of iface.alternate.endpoints) {
				if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
					this.outEndpoint = endpoint.endpointNumber;
					console.log('FT232R: Found OUT endpoint:', this.outEndpoint);
					break;
				}
			}

			if (!this.outEndpoint) {
				throw new Error('Could not find OUT endpoint for FT232R');
			}

			// Reset the FTDI chip
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_RESET,
				value: 0, // Reset
				index: this.interfaceNumber
			});

			// Set baud rate to 250,000 (DMX512 standard)
			// Divisor = 3000000 / 250000 = 12
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_SET_BAUD_RATE,
				value: 12,  // Baud rate divisor (250,000 baud)
				index: this.interfaceNumber
			});

			// Set data format to 8N2 (8 data bits, no parity, 2 stop bits)
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_SET_DATA,
				value: FT232RDriver.DATA_FORMAT_8N2,
				index: this.interfaceNumber
			});

			// Disable flow control
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_SET_FLOW_CTRL,
				value: 0, // No flow control
				index: this.interfaceNumber
			});

			this.connected = true;
			this._emit('connected', { driver: this });

			return true;
		} catch (error) {
			console.error('FT232R: Failed to connect:', error);
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
				console.warn('FT232R: Error closing device:', error);
			}
			this.device = null;
		}

		this.connected = false;
		this.universeData = null;
		this.outEndpoint = null;
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
			// Enttec Open DMX protocol requires BREAK to be sent via baud rate switching
			
			// Step 1: Change to ~90,909 baud to send BREAK
			// Divisor = 3000000 / 90909 ≈ 33
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_SET_BAUD_RATE,
				value: 33,  // ~90,909 baud for BREAK
				index: this.interfaceNumber
			});

			// Step 2: Send 0x00 byte (at low baud, this creates the BREAK signal ~110μs)
			const breakByte = new Uint8Array([0x00]);
			await this.device.transferOut(this.outEndpoint, breakByte);
			
			// Small delay to ensure BREAK completes (Mark After Break)
			await new Promise(resolve => setTimeout(resolve, 1));

			// Step 3: Change back to 250,000 baud for data
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: FT232RDriver.FTDI_SIO_SET_BAUD_RATE,
				value: 12,  // 250,000 baud
				index: this.interfaceNumber
			});

			// Step 4: Send DMX packet: start code (0x00) + 512 channels
			const dmxPacket = new Uint8Array(513);
			dmxPacket[0] = 0x00; // DMX512 start code
			dmxPacket.set(universeData, 1);
			
			const result = await this.device.transferOut(this.outEndpoint, dmxPacket);
			
			if (result.status !== 'ok') {
				console.warn('FT232R: Transfer status:', result.status, 'bytesWritten:', result.bytesWritten);
				this.errorCount++;
			} else {
				// Reset error count on success
				this.errorCount = 0;
			}

			// Stop output if too many errors
			if (this.errorCount >= this.maxErrors) {
				console.error('FT232R: Too many consecutive errors, stopping output');
				this.stopOutput();
				this._emit('error', { error: new Error('Too many transfer errors'), driver: this });
			}

		} catch (error) {
			this.errorCount++;
			console.error('FT232R: Failed to send DMX data (error', this.errorCount, 'of', this.maxErrors + '):', error);
			
			// Stop output if too many errors
			if (this.errorCount >= this.maxErrors) {
				console.error('FT232R: Too many consecutive errors, stopping output');
				this.stopOutput();
				this._emit('error', { error: new Error('Too many transfer errors: ' + error.message), driver: this });
			}
		} finally {
			this.isSending = false;
		}
	}
}
