# Adding DMX Controller Support

This document explains how to add support for new DMX USB controllers to the WebDMX Controller application.

## Architecture Overview

The DMX output system uses a driver abstraction that allows different DMX controller types to be supported through a common interface:

- **DMXDriver** - Base class that defines the interface all drivers must implement
- **DMXOutputManager** - Manages driver registration and device connections
- **DMXController** - High-level API that maintains backward compatibility

## Built-in Drivers

### ENTTEC DMX USB Pro Driver

Location: `src/lib/dmx.js`

Supports ENTTEC DMX USB Pro and compatible devices using the FTDI chipset (vendor ID `0x0403`).

**Features:**
- 60 Hz continuous output
- 512-channel DMX universe
- Uses USB bulk transfers
- Automatic device detection

### FT232R USB-DMX Driver

Location: `src/lib/dmx.js`

Supports generic FTDI FT232R-based USB to DMX cables (vendor ID `0x0403`, product ID `0x6001`).

**Features:**
- ~40 Hz continuous output
- 512-channel DMX universe
- Uses FTDI serial protocol with proper DMX break/MAB timing
- Configures FTDI chip for 250,000 baud, 8N2 format
- Uses USB control transfers for configuration + bulk transfers for data
- Automatic device detection

**Note:** ENTTEC DMX USB Pro devices also use the same USB IDs (`0x0403:0x6001`) but with a different protocol. If both drivers match your device, the system will try ENTTEC first. If connection fails, you may need to manually select the FT232R driver.

### uDMX Driver (Anyma)

Location: `src/lib/dmx.js`

Supports uDMX USB to wireless DMX controllers from Anyma (vendor ID `0x16c0`, product ID `0x05dc`).

**Features:**
- ~44 Hz continuous output (uDMX hardware limitation)
- 512-channel DMX universe
- Uses USB control transfers instead of bulk transfers
- Automatic device detection
- Handles occasional overflow errors gracefully

## USB ID Conflicts

### ENTTEC vs FT232R Conflict

**Problem:** Both ENTTEC DMX USB Pro and generic FT232R cables use identical USB identifiers:
- Vendor ID: `0x0403` (FTDI)
- Product ID: `0x6001`

The devices differ only in their **communication protocol**:
- **ENTTEC**: Proprietary protocol with packet framing (0x7E start, 0xE7 end, command bytes)
- **FT232R**: Standard FTDI serial protocol (raw serial with break/MAB control)

### How Detection Works

When both drivers match a device (`0x0403:0x6001`), the system uses the USB **product name** to differentiate:

1. Detects that multiple drivers match (logs device info to console)
2. Checks the device `productName`:
   - If name contains "DMX USB PRO" → Use **ENTTEC driver**
   - If name contains "FT232R" → Use **FT232R driver**
3. Fallback: If product name is unclear, prefer ENTTEC

**Example device names:**
- ENTTEC: `"DMX USB PRO"`
- FT232R: `"FT232R USB UART"`

This approach provides accurate automatic detection without requiring device probing.

### Future Improvement: Device Probing

A better solution would be to **probe the device** to determine which protocol it uses:

```javascript
// Query ENTTEC device using GET_WIDGET_PARAMS command (0x03)
const probe = new Uint8Array([
    0x7E,  // Start
    0x03,  // Label: GET_WIDGET_PARAMS
    0x00,  // Data length LSB
    0x00,  // Data length MSB
    0xE7   // End
]);

// Send probe and wait for response
// ENTTEC devices respond with widget parameters
// FT232R devices won't respond (or will respond differently)
```

This would allow automatic detection of the correct driver without user intervention.

## Creating a New Driver

To add support for a new DMX controller, create a class that extends `DMXDriver` and implements the required methods.

### Step 1: Create Your Driver Class

```javascript
import { DMXDriver } from './dmx.js';

export class MyDMXControllerDriver extends DMXDriver {
    constructor() {
        super('My DMX Controller', [
            { vendorId: 0x1234 },  // Your device's USB vendor ID
            { vendorId: 0x5678, productId: 0x9ABC }  // Optional product ID filter
        ]);
        // Add any driver-specific initialization
    }

    async connect(device) {
        try {
            this.device = device;

            // Open the USB device if not already open
            if (!this.device.opened) {
                await this.device.open();
            }

            // Claim the appropriate interface (usually 0)
            await this.device.claimInterface(0);

            // Perform any device-specific initialization
            // e.g., control transfers, configuration, etc.

            this.connected = true;
            this._emit('connected', { driver: this });

            return true;
        } catch (error) {
            console.error('Failed to connect:', error);
            this._emit('error', { error, driver: this });
            throw error;
        }
    }

    disconnect() {
        // Clean up any resources (intervals, etc.)

        if (this.device) {
            try {
                this.device.close();
            } catch (error) {
                console.warn('Error closing device:', error);
            }
            this.device = null;
        }

        this.connected = false;
        this._emit('disconnected', { driver: this });
    }

    async sendUniverse(universeData) {
        if (!this.device || !this.connected || !universeData) return;

        // Format the DMX data according to your device's protocol
        const packet = this.formatDMXPacket(universeData);

        try {
            // Send via USB bulk transfer (endpoint varies by device)
            await this.device.transferOut(2, packet);
        } catch (error) {
            console.error('Failed to send DMX data:', error);
            this._emit('error', { error, driver: this });
        }
    }

    formatDMXPacket(universeData) {
        // Implement your device's specific packet format
        // This is where you encode the 512-byte universe into
        // the protocol your device expects
        return new Uint8Array([/* ... */]);
    }
}
```

### Step 2: Register Your Driver

There are two ways to register your driver:

#### Option A: Add to Built-in Drivers

Edit `src/lib/dmx.js` and add your driver to the `DMXOutputManager` constructor:

```javascript
import { MyDMXControllerDriver } from './my-dmx-controller.js';

export class DMXOutputManager {
    constructor() {
        this.drivers = new Map();
        this.activeDriver = null;
        this.listeners = new Map();

        // Register built-in drivers
        this.registerDriver(new EnttecDMXUSBProDriver());
        this.registerDriver(new MyDMXControllerDriver());  // Add your driver
    }
    // ...
}
```

#### Option B: Register at Runtime

Register your driver dynamically when the application starts:

```javascript
import { MyDMXControllerDriver } from './my-dmx-controller.js';

// Get the DMXController instance
const dmxController = /* your DMXController instance */;
const manager = dmxController.getManager();

// Register your custom driver
manager.registerDriver(new MyDMXControllerDriver());
```

### Step 3: Test Your Driver

1. Connect your DMX controller via USB
2. Click the "Connect DMX" button in the application
3. Your device should appear in the WebUSB device picker
4. Select your device and verify it connects successfully
5. Test DMX output to verify data is being sent correctly

## Driver Interface Reference

### Required Methods

#### `async connect(device)`
Called when a USB device should be connected.

**Parameters:**
- `device` - USBDevice object from WebUSB API

**Returns:** Promise<boolean>

**Responsibilities:**
- Open the USB device
- Claim the appropriate interface
- Perform device initialization
- Set `this.connected = true`
- Emit `'connected'` event
- Handle errors and emit `'error'` event if needed

#### `disconnect()`
Called when the device should be disconnected.

**Responsibilities:**
- Clean up resources (timers, intervals, etc.)
- Close the USB device
- Set `this.connected = false`
- Emit `'disconnected'` event

#### `async sendUniverse(universeData)`
Called to send DMX data to the device.

**Parameters:**
- `universeData` - Uint8Array of 512 bytes (DMX channels 1-512)

**Responsibilities:**
- Format data according to device protocol
- Send via appropriate USB endpoint
- Handle errors and emit `'error'` event if needed

### Optional Methods

#### `startOutput(universeData)`
For drivers that need continuous output (like ENTTEC).

**Parameters:**
- `universeData` - Reference to the 512-byte universe array

**Responsibilities:**
- Store reference to universe data
- Start interval timer for continuous sending
- Call `sendUniverse()` at appropriate rate

#### `stopOutput()`
Stop continuous output.

### Inherited Properties

- `this.name` - Driver name (string)
- `this.vendorFilters` - Array of WebUSB filter objects
- `this.device` - Current USBDevice instance
- `this.connected` - Connection status (boolean)
- `this.listeners` - Event listener map

### Event Handling

Use the inherited event methods:

```javascript
// Emit events
this._emit('connected', { driver: this });
this._emit('disconnected', { driver: this });
this._emit('error', { error, driver: this });

// Listen to events (from outside the driver)
driver.on('connected', ({ driver }) => { /* ... */ });
driver.on('disconnected', ({ driver }) => { /* ... */ });
driver.on('error', ({ error, driver }) => { /* ... */ });
```

## Example: Different Output Patterns

### Continuous Output (like ENTTEC)

```javascript
startOutput(universeData) {
    this.universeData = universeData;
    this.interval = setInterval(() => {
        this.sendUniverse(this.universeData);
    }, 1000 / 60); // 60 fps
}

stopOutput() {
    if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
    }
}

disconnect() {
    this.stopOutput();
    // ... rest of disconnect logic
}
```

### On-Demand Output

```javascript
// Don't implement startOutput/stopOutput
// sendUniverse() will be called manually when data changes
async sendUniverse(universeData) {
    // Send data only when explicitly called
}
```

## USB Protocol Tips

### Finding Vendor/Product IDs

Use your browser's WebUSB API to discover device IDs:

```javascript
const device = await navigator.usb.requestDevice({ filters: [] });
console.log('Vendor ID:', '0x' + device.vendorId.toString(16));
console.log('Product ID:', '0x' + device.productId.toString(16));
```

### USB Transfer Types

DMX controllers typically use one of two transfer types:

**Bulk Transfers** (ENTTEC DMX USB Pro):
- Most common for DMX controllers
- Usually endpoint 2
- Use `device.transferOut(endpointNumber, data)` to send data
- Example: ENTTEC DMX USB Pro, DMXking devices

**Control Transfers** (uDMX):
- Used by simpler/smaller devices
- No endpoint needed (uses default control endpoint)
- Use `device.controlTransferOut({...}, data)` to send data
- Example: Anyma uDMX

**Hybrid: FTDI Serial Protocol** (FT232R):
- Uses control transfers for configuration (baud rate, data format, break)
- Uses bulk transfers for actual data transmission
- Common for generic USB-DMX cables
- Example: FT232R-based cables

### FTDI Serial Protocol (FT232R)

For FTDI FT232R chips, use vendor-specific control transfers to configure the chip:

```javascript
// Reset FTDI chip
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 0, // FTDI_SIO_RESET
    value: 0,
    index: 0
});

// Set baud rate to 250,000 for DMX
// Divisor = 3,000,000 / 250,000 = 12
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 3, // FTDI_SIO_SET_BAUD_RATE
    value: 12,  // Baud rate divisor
    index: 0
});

// Set data format to 8N2 (8 data bits, no parity, 2 stop bits)
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 4, // FTDI_SIO_SET_DATA
    value: 0x1008, // 8 bits | no parity | 2 stop bits
    index: 0
});

// Send DMX break (assert break condition)
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 4, // FTDI_SIO_SET_DATA
    value: 0x1008 | 0x4000, // Data format | BREAK_ON
    index: 0
});

// Clear break
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 4, // FTDI_SIO_SET_DATA
    value: 0x1008, // Data format | BREAK_OFF
    index: 0
});

// Send DMX data via bulk transfer
await device.transferOut(2, dmxPacket);
```

### Common USB Operations

```javascript
// Open device
await device.open();

// Select configuration (if needed)
if (device.configuration === null) {
    await device.selectConfiguration(1);
}

// Claim interface
await device.claimInterface(0);

// Control transfer (for device configuration)
await device.controlTransferOut({
    requestType: 'class',
    recipient: 'interface',
    request: 0x22,
    value: 0x01,
    index: 0x00
});

// Bulk transfer (for DMX data - ENTTEC style)
await device.transferOut(2, packetData);

// Control transfer (for DMX data - uDMX style)
await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: 2, // CMD_SET_CHANNEL_RANGE
    value: 512, // number of channels
    index: 0    // starting channel
}, universeData);

// Close device
await device.close();
```

## Common DMX Controller Types

### Supported Controllers

1. **FTDI FT232R USB-DMX cables** ✅ - USB vendor ID: 0x0403, product ID: 0x6001 (Built-in driver)
   - Generic USB to DMX cables using FT232R chip
   - Compatible with many DIY DMX interfaces
2. **ENTTEC DMX USB Pro** ✅ - USB vendor ID: 0x0403 (Built-in driver)
3. **Anyma uDMX** ✅ - USB vendor ID: 0x16c0, product ID: 0x05dc (Built-in driver)
4. **Eurolite USB-DMX512-PRO** ✅ - Often compatible with ENTTEC protocol (uses ENTTEC driver)

### Controllers to Add Support For

5. **DMXking ultraDMX Micro** - USB vendor ID: 0x04d8
6. **DMXking ultraDMX Pro** - USB vendor ID: 0x04d8
7. **Chauvet DJ Xpress 512** - Check vendor documentation
8. **ADJ MyDMX** - Proprietary protocol, may require reverse engineering

## Debugging

Enable verbose logging in your driver:

```javascript
async connect(device) {
    console.log('Connecting to device:', device);
    console.log('Vendor ID:', '0x' + device.vendorId.toString(16));
    console.log('Product ID:', '0x' + device.productId.toString(16));
    // ...
}

async sendUniverse(universeData) {
    console.log('Sending DMX packet, first 10 channels:', universeData.slice(0, 10));
    // ...
}
```

## Contributing

When adding a new driver, please:

1. Test thoroughly with the actual hardware
2. Document the device's vendor/product IDs
3. Include any special initialization requirements
4. Add error handling for common failure cases
5. Submit a pull request with example usage

## Resources

- [WebUSB API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [DMX512 Protocol Specification](https://tsp.esta.org/tsp/documents/docs/ANSI-ESTA_E1-11_2008R2018.pdf)
- ENTTEC DMX USB Pro API: Check ENTTEC website for protocol documentation
