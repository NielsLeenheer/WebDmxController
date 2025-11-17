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

### uDMX Driver (Anyma)

Location: `src/lib/dmx.js`

Supports uDMX USB to wireless DMX controllers from Anyma (vendor ID `0x16c0`, product ID `0x05dc`).

**Features:**
- ~44 Hz continuous output (uDMX hardware limitation)
- 512-channel DMX universe
- Uses USB control transfers instead of bulk transfers
- Automatic device detection
- Handles occasional overflow errors gracefully

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

1. **ENTTEC DMX USB Pro** ✅ - USB vendor ID: 0x0403 (Built-in driver)
2. **Anyma uDMX** ✅ - USB vendor ID: 0x16c0, product ID: 0x05dc (Built-in driver)
3. **Eurolite USB-DMX512-PRO** ✅ - Often compatible with ENTTEC protocol (uses ENTTEC driver)

### Controllers to Add Support For

4. **DMXking ultraDMX Micro** - USB vendor ID: 0x04d8
5. **DMXking ultraDMX Pro** - USB vendor ID: 0x04d8
6. **Chauvet DJ Xpress 512** - Check vendor documentation
7. **ADJ MyDMX** - Proprietary protocol, may require reverse engineering

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
