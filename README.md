# Web DMX Controller

A browser-based DMX lighting controller that runs entirely in your browser. No software to install – just open the app and start controlling your lights.

**[Live Demo →](https://demx.nielsleenheer.com)**

## Features

### Control DMX Devices

Add your DMX fixtures, assign start channels, and control them directly from the browser. The app connects to your DMX controller via WebUSB – plug it in and you're ready to go.

### Create Animations

Build animations using a visual timeline editor. Create keyframes, set easing curves, and preview your animations in real-time before sending them to your fixtures.

### Add Triggers

Connect your animations to physical inputs. Press a button on your MIDI controller to start an animation, or use a fader to smoothly control dimmer values. Three types of triggers are available:

- **Automatic triggers** – animations that run continuously or loop forever
- **Action triggers** – map button presses to start/stop animations
- **Value triggers** – map faders, knobs, or sensors to control values in real-time

### Customize with CSS

Under the hood, the animation system is powered by CSS. The app samples CSS custom properties and animations every frame and converts them to DMX values. You can write your own CSS to create complex multi-fixture scenes, use CSS variables for dynamic values, or leverage CSS animations for smooth transitions.

## Supported DMX Controllers

The app connects to DMX hardware via WebUSB. Currently supported:

| Controller | Status |
|------------|--------|
| **uDMX (Anyma)** | ✅ Recommended – works reliably at ~44 Hz |
| **ENTTEC DMX USB Pro** | ✅ Supported – full 60 Hz output |
| **FT232R / Open DMX** | ⚠️ Experimental – timing issues may cause flickering |

## Supported Device Types

| Device Type | Channels | Controls |
|-------------|----------|----------|
| **RGB** | 3 | Color picker |
| **RGBA** | 4 | Color picker + Amber |
| **RGBW** | 4 | Color picker + White |
| **Dimmer** | 1 | Brightness slider |
| **Smoke Machine** | 2 | Output + Fan speed |
| **Moving Head** | 8 | Pan/Tilt, Color, Dimmer, Strobe |
| **Moving Head 11CH** | 11 | Extended moving head with fine pan/tilt |
| **Flamethrower** | 2 | Flame control with safety |

## Supported Input Devices

Connect physical controllers to trigger animations and control DMX values in real-time. 

| Input Type | Connection |
|------------|------------|
| **MIDI Controllers** | Faders, knobs, pads, keys |
| **Stream Deck** | Buttons with RGB feedback |
| **Thingy:52** | Button and various motion sensors |
| **Keyboard** | Use any key as trigger |

### MIDI Controllers

Any class-compliant MIDI controller works for basic input – notes, control change messages, and pitch bend are all recognized. Just connect your controller and start listening for inputs.

For select controllers, the app includes device profiles that enable additional features:

| Controller | Features |
|------------|----------|
| **Akai APC mini MK2** | 64 RGB pads, 9 faders, buttons with color feedback |
| **Akai LPD8 MK2** | 8 RGB pads, 8 knobs with color feedback |
| **Donner Starrypad** | 16 pads, 2 faders, 2 knobs, transport buttons |

### Elgato Stream Deck

Stream Deck devices connect via WebHID. All Stream Deck models are supported:

| Model | Buttons |
|-------|---------|
| **Stream Deck Mini** | 6 buttons |
| **Stream Deck MK.1 / MK.2** | 15 buttons |
| **Stream Deck XL** | 32 buttons |
| **Stream Deck +** | 8 buttons + 4 dials |
| **Stream Deck Pedal** | 3 foot switches |
| **Stream Deck Neo** | 8 buttons |

Each button can trigger animations and displays a colored background to indicate mapped inputs.

### Nordic Thingy:52

The [Nordic Thingy:52](https://www.nordicsemi.com/Products/Development-hardware/Nordic-Thingy-52) is a Bluetooth sensor device with a button and multiple motion sensors. It connects via Web Bluetooth and provides:

| Sensor | Use Case |
|--------|----------|
| **Button** | Trigger animations on press |
| **Pan/Tilt** | Control moving head position by tilting the device |
| **Euler angles** | Roll, pitch, yaw rotation values |
| **Accelerometer** | Motion detection on X, Y, Z axes |
| **Gyroscope** | Rotation speed on X, Y, Z axes |
| **Compass** | Heading direction |

A practical example: hold the Thingy in your hand and use a value trigger to map its pan/tilt sensors directly to a moving head light. Tilt the device forward and the light tilts down; rotate it left and the light pans left. This creates an intuitive physical controller for positioning fixtures.

