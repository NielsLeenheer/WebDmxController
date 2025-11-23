# Color Support Refactoring

## Overview
Refactored the color support system from a boolean `supportsColor` property to a string-based `colorSupport` property with four distinct types: `'none'`, `'rgb'`, `'red'`, and `'green'`.

## Motivation
The APC mini MK2 controller has different color capabilities for different control types:
- **Pads (notes 0-63)**: Full RGB color support
- **Scene launch buttons (notes 82-89)**: Green LED only
- **Control buttons (notes 100-119)**: Red LED only
- **Shift button (note 122)**: No color support
- **Faders (cc 48-56)**: No color support

The previous boolean system couldn't distinguish between these different color capabilities.

## Color Support Types

| Type | Description | Use Case |
|------|-------------|----------|
| `'none'` | No color support | Keyboard keys, faders, shift button |
| `'rgb'` | Full RGB palette | APC pads, Akai LPD8 pads, Thingy:52 button, Stream Deck buttons |
| `'red'` | Red LED only | APC mini MK2 control buttons |
| `'green'` | Green LED only | APC mini MK2 scene launch buttons |

## Files Changed

### MIDI Profiles
- **APCMiniMK2Profile.js**: Updated all 127 controls with specific colorSupport values
  - Pads: `'rgb'`
  - Scene buttons: `'green'`
  - Control buttons: `'red'`
  - Shift button: `'none'`
  - Faders: `'none'`
- **MIDIDeviceProfile.js**: Base class now returns `colorSupport` instead of `supportsColor`
- **AkaiLPD8MK2Profile.js**: Pads `'rgb'`, knobs `'none'`
- **DonnerStarrypadProfile.js**: All pads `'none'` (color protocol not reverse-engineered)

### Input Devices
- **MIDIInputDevice.js**: Events include `colorSupport` property
- **StreamDeckInputDevice.js**: Buttons have `colorSupport: 'rgb'`
- **KeyboardInputDevice.js**: Keys have `colorSupport: 'none'`
- **HIDInputDevice.js**: Buttons have `colorSupport: 'none'`
- **ThingyInputDevice.js**: Button has `colorSupport: 'rgb'`, sensors have `'none'`

### Core Library
- **InputLibrary.svelte.js**: 
  - `create()` method uses `colorSupport`
  - `deserializeItem()` includes migration logic: `colorSupport || (supportsColor ? 'rgb' : 'none')`
  - Backward compatible with old stored data

### UI Components
- **InputsView.svelte**:
  - `getNextAvailableColor(deviceId, colorSupport)` returns appropriate color based on type:
    - `'red'` → returns `'red'`
    - `'green'` → returns `'green'`
    - `'rgb'` → cycles through palette
    - `'none'` → returns `null`
  - All input creation and handling logic updated
  - Boolean checks changed to string checks: `colorSupport && colorSupport !== 'none'`
- **InputCard.svelte**: Color preview uses new check
- **EditInputDialog.svelte**: Color picker shown based on colorSupport

### Controller
- **controller.js**: Thingy:52 button creation uses `colorSupport: 'rgb'`

## Migration Strategy
Existing inputs with boolean `supportsColor` are automatically migrated:
- `supportsColor: true` → `colorSupport: 'rgb'`
- `supportsColor: false` → `colorSupport: 'none'`
- Missing property → `colorSupport: 'none'`

## Color Assignment Logic

```javascript
function getNextAvailableColor(deviceId, colorSupport) {
    if (!colorSupport || colorSupport === 'none') return null;
    if (colorSupport === 'red') return 'red';
    if (colorSupport === 'green') return 'green';
    
    // For 'rgb', cycle through available colors
    const usedColors = deviceColorUsage.get(deviceId) || new Set();
    return colors.find(c => !usedColors.has(c)) || colors[0];
}
```

## Testing Checklist
- [x] Dev server starts without errors
- [ ] APC mini MK2 pads cycle through RGB colors
- [ ] APC mini MK2 control buttons show red
- [ ] APC mini MK2 scene launch buttons show green
- [ ] APC mini MK2 shift button has no color
- [ ] APC mini MK2 faders have no color
- [ ] Existing saved inputs load correctly with migration
- [ ] Thingy:52 button gets RGB color
- [ ] Keyboard keys have no color
- [ ] Stream Deck buttons get RGB colors

## Benefits
1. **Granular control**: Different controls can have different color capabilities
2. **Better UX**: Fixed-color controls always get the correct color
3. **Backward compatible**: Old data automatically migrates
4. **Extensible**: Easy to add new color types in the future (e.g., 'blue', 'yellow')
5. **Type-safe**: String values are more explicit than boolean
