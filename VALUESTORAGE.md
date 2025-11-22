# Value Storage Architecture

## Table of Contents
1. [Current Implementation](#current-implementation)
2. [Device Definition Architecture](#device-definition-architecture)
3. [Alternative Value Storage Approaches](#alternative-value-storage-approaches)
4. [Recommendation](#recommendation-option-a-control-based-storage)

---

## Current Implementation

### Overview
The WebDMX Controller currently stores all device values as **DMX channel arrays** (0-255 values). This approach directly mirrors the DMX512 protocol structure.

---

## 1. Device Default Values

### Current Structure
```javascript
// Device object in DeviceLibrary
{
  id: "uuid-1234",
  type: "RGB",
  name: "Light 1",
  startChannel: 1,
  cssId: "light-1",
  defaultValues: [255, 128, 64],  // Array of DMX values (0-255)
  linkedTo: null,
  syncedControls: null,
  mirrorPan: false,
  order: 0
}
```

### Storage Location
- **File**: `DeviceLibrary.svelte.js`
- **localStorage key**: `dmx-devices`
- **Field**: `device.defaultValues` - Array of numbers (0-255)

### Device Linking
When devices are linked, the `applyLinkedValues()` function:
1. Maps controls between source and target device types
2. Copies DMX channel values from source to target
3. Optionally mirrors pan values (255 - value)
4. Filters by `syncedControls` array if specified

```javascript
// From outputs/sync.js
export function applyLinkedValues(
  sourceType, 
  targetType, 
  sourceValues,    // Source DMX array
  targetValues,    // Target DMX array
  syncedControls,  // Array of control names like ['Color', 'Dimmer']
  mirrorPan
) {
  // Maps control names → copies DMX channel values
  // Returns new DMX array for target device
}
```

---

## 2. Animation Keyframe Values

### Current Structure
```javascript
// Animation object in AnimationLibrary
{
  id: "uuid-5678",
  name: "rainbow",
  cssName: "rainbow",
  controls: ["Color"],
  displayName: "Rainbow",
  keyframes: [
    {
      time: 0,
      deviceType: "RGB",
      values: [255, 0, 0]      // DMX array
    },
    {
      time: 0.5,
      deviceType: "RGB", 
      values: [0, 255, 0]      // DMX array
    },
    {
      time: 1.0,
      deviceType: "RGB",
      values: [0, 0, 255]      // DMX array
    }
  ],
  order: 0
}
```

### Storage Location
- **File**: `AnimationLibrary.svelte.js`
- **localStorage key**: `dmx-animations`
- **Field**: `keyframe.values` - Array of numbers (0-255)

### Usage
- Keyframes store full DMX arrays even if only animating specific controls
- The `controls` array indicates which controls are animated, but values are still stored as DMX channels
- CSS generation uses `getProperties()` to convert DMX values to CSS properties

---

## 3. Trigger Values

### Current Structure
```javascript
// Trigger object in TriggerLibrary
{
  id: "uuid-9012",
  triggerType: "pressed",
  inputId: "input-uuid",
  actionType: "values",
  deviceId: "device-uuid",
  animation: null,
  values: {
    channelValues: {          // Object keyed by channel index
      "0": 255,               // Channel 0 = Red = 255
      "1": 128,               // Channel 1 = Green = 128
      "2": 64                 // Channel 2 = Blue = 64
    },
    enabledControls: ["Color"]  // Which controls are active
  },
  order: 0
}
```

### Storage Location
- **File**: `TriggerLibrary.svelte.js`
- **localStorage key**: `webdmx-triggers`
- **Field**: `trigger.values.channelValues` - Object with string keys (channel indices)

### Unique Aspects
- Uses **object** instead of array (keyed by channel index as string)
- Includes `enabledControls` to filter which controls are shown/active
- Only stores values for channels that have been set (sparse storage)

---

## 4. DMX Output

### Current Flow
```
Device/Animation/Trigger (DMX arrays)
  ↓
CSS Generation (getProperties() converts DMX → CSS)
  ↓
CSS Animation (browser interpolates CSS values)
  ↓
CSS Sampler (reads computed styles from DOM)
  ↓
DMX Output (maps CSS back to DMX channels)
  ↓
DMX Universe (512 bytes sent to hardware)
```

### Key Conversion Points

**DMX → CSS** (`lib/outputs/css.js`):
```javascript
export function getProperties(controls, components, values, deviceType) {
  // Takes DMX array [255, 128, 64]
  // Returns CSS object { color: "rgb(255, 128, 64)" }
}
```

**CSS → DMX** (`lib/css/mapping/cssToDmxMapping.js`):
```javascript
export function mapCSSValueToDMX(cssProperty, cssValue, device) {
  // Takes CSS "rgb(255, 128, 64)"
  // Returns DMX array [255, 128, 64]
}
```

---

## Alternative Storage Approaches

### Option A: Control-Based Storage (Recommended)

#### Structure
```javascript
// Device
{
  id: "uuid-1234",
  type: "RGB",
  name: "Light 1",
  startChannel: 1,
  defaultValues: {
    "Color": { r: 255, g: 128, b: 64 },
    "Dimmer": 255
  }
}

// Animation Keyframe
{
  time: 0,
  deviceType: "RGB",
  values: {
    "Color": { r: 255, g: 0, b: 0 }
  }
}

// Trigger
{
  values: {
    "Color": { r: 255, g: 128, b: 64 },
    "Dimmer": 255
  }
}
```

#### Advantages
✅ **Human-readable**: `{ Color: { r: 255, g: 128, b: 64 } }` vs `[255, 128, 64]`  
✅ **Self-documenting**: Clear what each value represents  
✅ **Flexible**: Easy to add/remove controls without breaking storage  
✅ **Type-safe**: Can validate control types (RGB, slider, XY pad)  
✅ **Sparse storage**: Only store values that matter  
✅ **Device-agnostic**: Values not tied to specific channel layouts  
✅ **Easier UI binding**: Direct mapping to control components  

#### Disadvantages
❌ **More complex conversion**: Need to map controls → DMX channels  
❌ **Storage overhead**: More bytes (strings as keys)  
❌ **Migration required**: Need to convert existing localStorage data  
❌ **Lookup cost**: Object access vs array index  

#### Implementation Changes Required
1. **DeviceLibrary.svelte.js**: Change `defaultValues` from array to object
2. **AnimationLibrary.svelte.js**: Change `keyframe.values` from array to object
3. **TriggerLibrary.svelte.js**: Change `values.channelValues` to control-based object
4. **outputs/sync.js**: Update `applyLinkedValues()` to work with control objects
5. **outputs/css.js**: Update `getProperties()` to accept control objects
6. **New utility**: `controlValuesToDMXArray()` function to convert for output
7. **Migration script**: Convert existing localStorage data

---

### Option B: Hybrid Approach (Practical Middle Ground)

#### Structure
Store as control objects internally, but cache DMX arrays:

```javascript
// Device with both representations
{
  id: "uuid-1234",
  type: "RGB",
  name: "Light 1",
  values: {
    "Color": { r: 255, g: 128, b: 64 },
    "Dimmer": 255
  },
  _dmxCache: [255, 128, 64, 0, 0, 0, 0, 0, 255]  // Generated on-demand
}
```

#### Advantages
✅ Best of both worlds: readable storage + fast DMX output  
✅ Cache invalidation only on value changes  
✅ Gradual migration path  

#### Disadvantages
❌ Memory overhead (storing data twice)  
❌ Cache invalidation complexity  
❌ Risk of cache/data desync  

---

## Device Definition Architecture

### Current System: Inline Channel Mapping

#### Structure
Each device type defines its own channel layout inline:

```javascript
// outputs/devices/MOVING_HEAD_11CH.js
export class MovingHead11CHDeviceType extends DeviceType {
  constructor() {
    const defaultValues = [0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0];
    
    super(
      'Moving Head (11ch)',
      11,  // Total channels
      [
        // Components: Map names to channel indices
        { name: 'Pan', channel: 0 },
        { name: 'Pan Fine', channel: 1 },
        { name: 'Tilt', channel: 2 },
        { name: 'Tilt Fine', channel: 3 },
        { name: 'Speed', channel: 4 },
        { name: 'Dimmer', channel: 5 },
        { name: 'Strobe', channel: 6 },
        { name: 'Red', channel: 7 },
        { name: 'Green', channel: 8 },
        { name: 'Blue', channel: 9 },
        { name: 'White', channel: 10 }
      ],
      [
        // Controls: Map UI controls to component indices
        {
          name: 'Pan/Tilt',
          type: 'xypad',
          components: { x: 0, y: 2 }  // References component array indices
        },
        {
          name: 'Color',
          type: 'rgb',
          components: { r: 7, g: 8, b: 9 }  // References component array indices
        },
        // ... more controls
      ],
      defaultValues
    );
  }
}
```

#### Issues with Current System

1. **Tight Coupling**
   - Control definitions are embedded in device types
   - Can't reuse control definitions across devices
   - Hard to extend with new control types

2. **Indirection Layers**
   - Controls reference component indices (0-10)
   - Components reference channel indices (0-10)
   - Two-level indirection is confusing

3. **Repetition**
   - RGB control defined in every RGBW device type
   - Pan/Tilt control duplicated across moving heads
   - Slider controls redefined constantly

4. **Hidden Channels**
   - No way to specify channels without controls
   - Can't have default values for channels not exposed in UI
   - Example: Pan Fine, Tilt Fine often not exposed as controls

5. **Complex Mapping**
   - Need to understand three concepts: channels, components, controls
   - Components layer adds complexity without clear benefit

---

### Proposed System: Shared Control Definitions

#### Critical Design Constraint: Reactivity

**For Svelte 5 $state reactivity to work, stored data MUST be plain objects and arrays, not class instances.**

**Two-Layer Architecture:**

1. **Definitions Layer** (Classes, not reactive)
   - `ControlType` classes (RGB, Slider, XYPad, etc.)
   - `DeviceType` classes (RGB, MOVING_HEAD, etc.)
   - These are **singletons** - created once, shared across app
   - Provide methods for conversion, validation, defaults
   - NOT stored in reactive state

2. **Data Layer** (Plain objects/arrays, reactive)
   - Device instances: `{ id, type: "RGB", name, defaultValues: {...} }`
   - Animation keyframes: `{ time, deviceType: "RGB", values: {...} }`
   - Trigger values: `{ values: {...} }`
   - These ARE stored in `$state` and localStorage
   - Just plain JSON-serializable objects

**Key Pattern:**
```javascript
// Definition (class, singleton, not reactive)
const RGB_TYPE = new RGBDeviceType();

// Data (plain object, reactive)
const device = {
  id: "uuid-123",
  type: "RGB",  // String identifier, references RGB_TYPE
  name: "Light 1",
  defaultValues: {
    "Color": { r: 255, g: 128, b: 64 }  // Plain object!
  }
};

// Usage: Get definition from registry
const deviceType = DEVICE_TYPES[device.type];  // Returns RGB_TYPE
const dmx = deviceType.controlValuesToDMX(device.defaultValues);
```

---

#### Control Type Definitions

```javascript
// lib/controls/definitions.js

/**
 * Base Control Type (CLASS - not stored in state)
 * These are definition objects, not data objects
 */
export class ControlType {
  constructor(id, name, type, defaultValue) {
    this.id = id;          // Unique identifier string
    this.name = name;      // Display name
    this.type = type;      // UI type: 'rgb', 'slider', 'xypad'
    this.defaultValue = defaultValue;  // Default control value
  }
  
  /**
   * Get channel count for this control
   */
  getChannelCount() {
    throw new Error('Must implement getChannelCount()');
  }
  
  /**
   * Convert control value (plain object) to DMX array
   * @param {*} value - Control value (plain object, number, etc.)
   * @returns {Array<number>} DMX values for this control's channels
   */
  valueToDMX(value) {
    throw new Error('Must implement valueToDMX()');
  }
  
  /**
   * Convert DMX array to control value (plain object)
   * @param {Array<number>} dmxValues - DMX values starting at this control
   * @returns {*} Control value (plain object)
   */
  dmxToValue(dmxValues) {
    throw new Error('Must implement dmxToValue()');
  }
  
  /**
   * Get default value as plain object
   * @returns {*} Default value (plain object, safe for $state)
   */
  getDefaultValue() {
    // Return a copy to avoid shared references
    if (typeof this.defaultValue === 'object') {
      return { ...this.defaultValue };
    }
    return this.defaultValue;
  }
}

/**
 * RGB Control Type (CLASS - definition)
 */
export class RGBControl extends ControlType {
  constructor() {
    super('rgb', 'RGB', 'rgb', { r: 0, g: 0, b: 0 });
  }
  
  getChannelCount() {
    return 3;
  }
  
  // Input: plain object { r, g, b }
  // Output: plain array [r, g, b]
  valueToDMX(value) {
    return [value.r ?? 0, value.g ?? 0, value.b ?? 0];
  }
  
  // Input: plain array [r, g, b]
  // Output: plain object { r, g, b }
  dmxToValue(dmxValues) {
    return {
      r: dmxValues[0] ?? 0,
      g: dmxValues[1] ?? 0,
      b: dmxValues[2] ?? 0
    };
  }
}

/**
 * RGBA Control Type
 */
export class RGBAControl extends ControlType {
  constructor() {
    super('rgba', 'RGBA', 'rgba', { r: 0, g: 0, b: 0, a: 0 });
  }
  
  getChannelCount() {
    return 4;
  }
  
  valueToDMX(value) {
    return [
      value.r ?? 0,
      value.g ?? 0,
      value.b ?? 0,
      value.a ?? 0
    ];
  }
  
  dmxToValue(dmxValues) {
    return {
      r: dmxValues[0] ?? 0,
      g: dmxValues[1] ?? 0,
      b: dmxValues[2] ?? 0,
      a: dmxValues[3] ?? 0
    };
  }
}
      g: dmxValues[1] ?? 0,
      b: dmxValues[2] ?? 0,
      a: dmxValues[3] ?? 0
    };
  }
}

/**
 * Slider Control Type (single channel)
 */
export class SliderControl extends ControlType {
  constructor(id, name = 'Slider') {
    super(id, name, 'slider', 0);
  }
  
  getChannelCount() {
    return 1;
  }
  
  // Input: plain number
  // Output: plain array [value]
  valueToDMX(value) {
    return [value ?? 0];
  }
  
  // Input: plain array [value]
  // Output: plain number
  dmxToValue(dmxValues) {
    return dmxValues[0] ?? 0;
  }
}

/**
 * XY Pad Control Type (Pan/Tilt)
 */
export class XYPadControl extends ControlType {
  constructor(id, name = 'Pan/Tilt') {
    super(id, name, 'xypad', { x: 128, y: 128 });
  }
  
  getChannelCount() {
    return 2;
  }
  
  // Input: plain object { x, y }
  // Output: plain array [x, y]
  valueToDMX(value) {
    return [value.x ?? 128, value.y ?? 128];
  }
  
  // Input: plain array [x, y]
  // Output: plain object { x, y }
  dmxToValue(dmxValues) {
    return {
      x: dmxValues[0] ?? 128,
      y: dmxValues[1] ?? 128
    };
  }
}

/**
 * 16-bit XY Pad Control Type (Pan/Tilt with fine channels)
 */
export class XYPad16Control extends ControlType {
  constructor(id, name = 'Pan/Tilt') {
    super(id, name, 'xypad', { x: 128, y: 128 });
  }
  
  getChannelCount() {
    return 4;  // Pan, Pan Fine, Tilt, Tilt Fine
  }
  
  // Input: plain object { x, y } (8-bit values 0-255)
  // Output: plain array [pan, panFine, tilt, tiltFine] (16-bit expanded)
  valueToDMX(value) {
    const x = value.x ?? 128;
    const y = value.y ?? 128;
    // Convert 8-bit to 16-bit: value * 257
    const x16 = Math.round(x * 257);
    const y16 = Math.round(y * 257);
    return [
      x16 >> 8,        // Pan coarse
      x16 & 0xFF,      // Pan fine
      y16 >> 8,        // Tilt coarse
      y16 & 0xFF       // Tilt fine
    ];
  }
  
  // Input: plain array [pan, panFine, tilt, tiltFine]
  // Output: plain object { x, y } (8-bit values 0-255)
  dmxToValue(dmxValues) {
    // Convert 16-bit back to 8-bit
    const x16 = ((dmxValues[0] ?? 0) << 8) | (dmxValues[1] ?? 0);
    const y16 = ((dmxValues[2] ?? 0) << 8) | (dmxValues[3] ?? 0);
    return {
      x: Math.round(x16 / 257),
      y: Math.round(y16 / 257)
    };
  }
}

/**
 * Control Type Registry (singleton instances)
 * These are the ONLY instances of control types - used for lookups
 */
export const CONTROL_TYPES = {
  RGB: new RGBControl('rgb', 'RGB'),
  RGBA: new RGBAControl('rgba', 'RGBA'),
  Dimmer: new SliderControl('dimmer', 'Dimmer'),
  Strobe: new SliderControl('strobe', 'Strobe'),
  Speed: new SliderControl('speed', 'Speed'),
  White: new SliderControl('white', 'White'),
  PanTilt: new XYPadControl('pantilt', 'Pan/Tilt'),
  PanTilt16: new XYPad16Control('pantilt16', 'Pan/Tilt')
```

**Important**: Control types are CLASSES (definitions), but they only work with PLAIN OBJECTS and ARRAYS for values.

---

#### New Device Type Definition

```javascript
// lib/outputs/devices/MOVING_HEAD_11CH.js
import { DeviceType } from './DeviceType.js';
import { CONTROL_TYPES } from '../../controls/definitions.js';

/**
 * Device Type Definition (CLASS - not stored in state)
 * Singleton instance, provides methods and metadata
 */
export class MovingHead11CHDeviceType extends DeviceType {
  constructor() {
    super({
      id: 'MOVING_HEAD_11CH',  // String identifier
      name: 'Moving Head (11ch)',
      
      // Total channels needed
      channels: 11,
      
      // Default values for ALL channels (plain array)
      defaultValues: [
        0,    // Ch 0: Pan
        0,    // Ch 1: Pan Fine
        0,    // Ch 2: Tilt
        0,    // Ch 3: Tilt Fine
        0,    // Ch 4: Speed
        255,  // Ch 5: Dimmer (default full)
        0,    // Ch 6: Strobe
        0,    // Ch 7: Red
        0,    // Ch 8: Green
        0,    // Ch 9: Blue
        0     // Ch 10: White
      ],
      
      // Controls: plain objects referencing control type instances
      controls: [
        {
          name: 'Pan/Tilt',
          type: CONTROL_TYPES.PanTilt16,  // Reference control type instance
          startChannel: 0
          // Control spans channels 0-3 (Pan, Pan Fine, Tilt, Tilt Fine)
        },
        {
          name: 'Speed',
          type: CONTROL_TYPES.Speed,
          startChannel: 4,
          color: '#666666'  // UI metadata
        },
        {
          name: 'Dimmer',
          type: CONTROL_TYPES.Dimmer,
          startChannel: 5,
          color: '#888888'
        },
        {
          name: 'Strobe',
          type: CONTROL_TYPES.Strobe,
          startChannel: 6,
          color: '#888888'
        },
        {
          name: 'Color',
          type: CONTROL_TYPES.RGB,
          startChannel: 7
          // Control spans channels 7-9 (R, G, B)
        },
        {
          name: 'White',
          type: CONTROL_TYPES.White,
          startChannel: 10,
          color: '#808080'
        }
      ]
    });
  }
}

// Export singleton instance
export const MOVING_HEAD_11CH = new MovingHead11CHDeviceType();
```

#### Simplified RGB Device

```javascript
// lib/outputs/devices/RGB.js
export class RGBDeviceType extends DeviceType {
  constructor() {
    super({
      id: 'RGB',
      name: 'RGB Light',
      channels: 3,
      defaultValues: [0, 0, 0],
      controls: [
        {
          name: 'Color',
          type: CONTROL_TYPES.RGB,
          startChannel: 0
        }
      ]
    });
  }
}

// Export singleton instance
export const RGB = new RGBDeviceType();
```

#### Device Type Registry

```javascript
// lib/outputs/devices.js
import { RGB } from './devices/RGB.js';
import { MOVING_HEAD_11CH } from './devices/MOVING_HEAD_11CH.js';
// ... import all device types

/**
 * Device Type Registry (singleton instances)
 * Keyed by string identifier for lookup
 */
export const DEVICE_TYPES = {
  RGB: RGB,
  MOVING_HEAD_11CH: MOVING_HEAD_11CH,
  // ... etc
};
```

---

#### Device Instance (Stored Data - Plain Object)

```javascript
// This is what gets stored in DeviceLibrary items array ($state)
// PLAIN OBJECT - not a class instance!
const deviceInstance = {
  id: "uuid-1234",                    // String
  type: "RGB",                         // String identifier → references DEVICE_TYPES.RGB
  name: "Light 1",                     // String
  startChannel: 1,                     // Number
  cssId: "light-1",                    // String
  
  // PLAIN OBJECT with control values (NOT DMX array!)
  defaultValues: {
    "Color": { r: 255, g: 128, b: 64 }  // Plain object
  },
  
  linkedTo: null,                      // String or null
  syncedControls: ["Color"],           // Plain array of strings
  mirrorPan: false,                    // Boolean
  order: 0                             // Number
};

// Usage: Get device type definition
const deviceType = DEVICE_TYPES[deviceInstance.type];  // Returns RGB class instance

// Convert to DMX using definition
const dmxArray = deviceType.controlValuesToDMX(deviceInstance.defaultValues);
// dmxArray = [255, 128, 64]  // Plain array
```

---

#### Example: Device with Hidden Channels (CLASS Definition)

```javascript
// lib/outputs/devices/COMPLEX_FIXTURE.js
// CLASS - not stored in state
export class ComplexFixtureDeviceType extends DeviceType {
  constructor() {
    super({
      id: 'COMPLEX_FIXTURE',                // String identifier
      name: 'Complex Fixture',
      channels: 16,
      
      // Plain array (DMX defaults for hidden/fixed channels)
      defaultValues: [
        0,    // Ch 0: Pan
        0,    // Ch 1: Pan Fine
        0,    // Ch 2: Tilt
        0,    // Ch 3: Tilt Fine
        0,    // Ch 4: Speed
        255,  // Ch 5: Dimmer
        0,    // Ch 6: Strobe
        0,    // Ch 7: Red
        0,    // Ch 8: Green
        0,    // Ch 9: Blue
        0,    // Ch 10: White
        0,    // Ch 11: Color wheel (hidden - no control)
        0,    // Ch 12: Gobo wheel (hidden - no control)
        128,  // Ch 13: Gobo rotation (hidden - default 128)
        0,    // Ch 14: Prism (hidden)
        0     // Ch 15: Reset (hidden)
      ],
      
      // Plain objects referencing control type instances
      controls: [
        {
          name: 'Pan/Tilt',
          type: CONTROL_TYPES.PanTilt16,     // Reference control type instance
          startChannel: 0
        },
        {
          name: 'Speed',
          type: CONTROL_TYPES.Speed,
          startChannel: 4
        },
        {
          name: 'Dimmer',
          type: CONTROL_TYPES.Dimmer,
          startChannel: 5
        },
        {
          name: 'Strobe',
          type: CONTROL_TYPES.Strobe,
          startChannel: 6
        },
        {
          name: 'Color',
          type: CONTROL_TYPES.RGB,
          startChannel: 7
        },
        {
          name: 'White',
          type: CONTROL_TYPES.White,
          startChannel: 10
        }
        // Channels 11-15 have defaults but no controls
        // They will output their default values but not be user-editable
      ]
    });
  }
}

// Export singleton instance
export const COMPLEX_FIXTURE = new ComplexFixtureDeviceType();
```

#### Advantages of Shared Control System

✅ **Reusability**
- Control types defined once, used everywhere
- Add new control types in one place
- Consistent behavior across device types

✅ **Simplicity**
- Only two concepts: Controls and Channels
- Controls know their channel count
- Direct mapping: control at channel X spans X to X+count

✅ **Flexibility**
- Easy to add channels without controls
- Controls are self-contained (valueToDMX, dmxToValue)
- Can create variants (8-bit vs 16-bit Pan/Tilt)

✅ **Extensibility**
- New control types just extend ControlType
- Device definitions become declarative
- Easy to add control metadata (color, range, labels)

✅ **Type Safety**
- Control types enforce value structure
- Conversion logic in one place
- Easier to validate and test

✅ **Default Values**
- Clear what every channel defaults to
- Can set defaults for hidden channels
- No ambiguity about channel initialization

#### Disadvantages

❌ **Migration Effort**
- Need to rewrite all device type definitions
- Update control mapping logic
- Convert existing components/controls references

❌ **Control Type Proliferation**
- Need to define many control types upfront
- Balance between generic and specific
- May need "custom" control type for one-offs

---

### Control Value Conversion

#### Device → DMX Array

```javascript
// lib/controls/converter.js

/**
 * Convert device control values to DMX array
 * Input: deviceType (CLASS instance), controlValues (plain object)
 * Output: plain DMX array
 */
export function deviceValuesToDMX(deviceType, controlValues) {
  const dmxArray = [...deviceType.defaultValues];  // Start with defaults (plain array)
  
  for (const controlDef of deviceType.controls) {
    const value = controlValues[controlDef.name];   // Plain object/number/etc
    if (value === undefined) continue;
    
    // Get DMX values from control type (input: plain object, output: plain array)
    const controlDMX = controlDef.type.valueToDMX(value);
    
    // Write to correct channels
    for (let i = 0; i < controlDMX.length; i++) {
      dmxArray[controlDef.startChannel + i] = controlDMX[i];
    }
  }
  
  return dmxArray;  // Plain array
}
```

#### DMX Array → Device Values

```javascript
/**
 * Convert DMX array to device control values
 * Input: deviceType (CLASS instance), dmxArray (plain array)
 * Output: plain object with control values
 */
export function dmxToDeviceValues(deviceType, dmxArray) {
  const controlValues = {};  // Plain object
  
  for (const controlDef of deviceType.controls) {
    // Extract DMX values for this control (plain array slice)
    const controlDMX = dmxArray.slice(
      controlDef.startChannel,
      controlDef.startChannel + controlDef.type.getChannelCount()
    );
    
    // Convert to control value (input: plain array, output: plain object/number)
    controlValues[controlDef.name] = controlDef.type.dmxToValue(controlDMX);
  }
  
  return controlValues;  // Plain object
}
```

#### Example Usage

```javascript
// Device instance (plain object stored in $state)
const device = {
  id: "uuid-123",
  type: "MOVING_HEAD_11CH",  // String reference
  name: "Moving Head 1",
  startChannel: 1,
  
  // Control values (plain objects)
  defaultValues: {
    "Pan/Tilt": { x: 128, y: 64 },
    "Dimmer": 255,
    "Color": { r: 255, g: 128, b: 0 }
  }
};

// Get device type definition (CLASS instance from registry)
const deviceType = DEVICE_TYPES[device.type];

// Convert control values to DMX (plain array)
const dmx = deviceValuesToDMX(deviceType, device.defaultValues);
// Result: [128, 0, 64, 0, 0, 255, 0, 255, 128, 0, 0]
//         Pan  Pf Tilt Tf Sp Dim St R   G   B   W

// Convert DMX back to control values (plain object)
const values = dmxToDeviceValues(deviceType, dmx);
// Result: {
//   "Pan/Tilt": { x: 128, y: 64 },
//   "Speed": 0,
//   "Dimmer": 255,
//   "Strobe": 0,
//   "Color": { r: 255, g: 128, b: 0 },
//   "White": 0
// }
```

---

## Alternative Value Storage Approaches

#### Structure
Separate value storage from device/animation/trigger metadata:

```javascript
// lib/stores/valueStore.svelte.js
// Separate value store ($state with plain objects)
const valueStore = {
  "device-uuid-1": {                          // Plain object
    "Color": { r: 255, g: 128, b: 64 },      // Plain objects
    "Dimmer": 255
  },
  "keyframe-uuid-1": {                        // Plain object
    "Color": { r: 0, g: 255, b: 0 }          // Plain object
  }
};

// Device instance (plain object) references values by ID
const device = {
  id: "device-uuid-1",
  type: "RGB",                                // String reference
  name: "Light 1",
  valueRef: "device-uuid-1"                   // String reference to valueStore
};
```

#### Advantages
✅ **Separation of concerns**: Metadata vs data  
✅ **Deduplication**: Multiple devices could share value references  
✅ **Easier undo/redo**: Can snapshot value store independently  

#### Disadvantages
❌ **Complexity**: More indirection, harder to reason about  
❌ **Synchronization**: Need to manage references carefully  
❌ **Not suited for localStorage**: Better for centralized store  

---

## Recommendation: Combined Approach

### Both Changes Should Be Implemented Together

The two proposed changes are synergistic and should be implemented as a unified refactoring:

1. **Shared Control Definitions** (Device Architecture) - Classes as definitions
2. **Control-Based Value Storage** (Data Storage) - Plain objects in $state

### Why Implement Both?

#### They Solve Complementary Problems

**Shared Controls** solve:
- Code duplication in device definitions
- Complexity of three-layer mapping (channels → components → controls)
- Inability to have channels without controls
- Difficulty reusing control logic

**Control-Based Values** solve:
- Unreadable DMX array storage
- Difficulty working with values in UI code
- Tight coupling to DMX protocol
- Error-prone array index management

#### They Enable Each Other

The shared control system provides the **conversion functions** needed for control-based storage:

```javascript
// Control type definitions (CLASSES) provide the bridge
// Input/output: plain objects and arrays
controlType.valueToDMX({ r: 255, g: 128, b: 64 })  // → [255, 128, 64]
controlType.dmxToValue([255, 128, 64])              // → { r: 255, g: 128, b: 64 }
```

Without shared controls, we'd need to duplicate conversion logic throughout the codebase.

#### They Share Migration Cost

Both changes require:
- Updating device type definitions
- Converting localStorage data
- Updating UI components
- Refactoring output pipeline

Doing them separately would mean **two disruptive migrations**. Doing them together is **one clean break**.

---

### Combined Architecture

#### New Device Type Definition (CLASS)

```javascript
// lib/outputs/devices/MOVING_HEAD.js
// CLASS - not stored in state
import { CONTROL_TYPES } from '../../controls/definitions.js';

export class MovingHeadDeviceType extends DeviceType {
  constructor() {
    super({
      id: 'MOVING_HEAD',                                // String identifier
      name: 'Moving Head',
      channels: 7,
      defaultValues: [0, 0, 255, 0, 0, 0, 0],          // Plain array (Dimmer at full)
      controls: [
        {
          name: 'Pan/Tilt',
          type: CONTROL_TYPES.PanTilt,                  // Reference to control instance
          startChannel: 0
        },
        {
          name: 'Dimmer',
          type: CONTROL_TYPES.Dimmer,                   // Reference to control instance
          startChannel: 2
        },
        {
          name: 'Color',
          type: CONTROL_TYPES.RGB,                      // Reference to control instance
          startChannel: 3
        },
        {
          name: 'White',
          type: CONTROL_TYPES.White,                    // Reference to control instance
          startChannel: 6
        }
      ]
    });
  }
}

// Export singleton instance
export const MOVING_HEAD = new MovingHeadDeviceType();
```

#### New Device Instance (PLAIN OBJECT in $state)

```javascript
// Device object in DeviceLibrary items array
// PLAIN OBJECT - stored in $state, synced to localStorage
const device = {
  id: "uuid-1234",                      // String
  type: "MOVING_HEAD",                  // String reference → DEVICE_TYPES.MOVING_HEAD
  name: "Moving Head 1",                // String
  startChannel: 1,                      // Number
  cssId: "moving-head-1",               // String
  
  // Control-based values (plain objects, NOT DMX arrays!)
  defaultValues: {
    "Pan/Tilt": { x: 128, y: 128 },    // Plain object
    "Dimmer": 255,                      // Number
    "Color": { r: 255, g: 0, b: 0 },   // Plain object
    "White": 0                          // Number
  },
  
  linkedTo: null,                       // String or null
  syncedControls: ["Color", "Dimmer"],  // Plain array of strings (control names)
  mirrorPan: false,                     // Boolean
  order: 0                              // Number
};

// Usage: Get device type definition
const deviceType = DEVICE_TYPES[device.type];  // Returns class instance
```

#### New Animation Keyframe (PLAIN OBJECT in $state)

```javascript
const keyframe = {
  time: 0,                               // Number
  deviceType: "MOVING_HEAD",             // String reference
  
  // Control-based values (plain objects)
  values: {
    "Color": { r: 255, g: 0, b: 0 },    // Plain object
    "Pan/Tilt": { x: 180, y: 90 }       // Plain object
  }
}
```

#### New Trigger (PLAIN OBJECT in $state)

```javascript
const trigger = {
  id: "uuid-9012",                       // String
  triggerType: "pressed",                // String
  inputId: "input-uuid",                 // String
  actionType: "values",                  // String
  deviceId: "device-uuid",               // String
  
  // Control-based values (plain objects)
  values: {
    "Color": { r: 128, g: 64, b: 192 }, // Plain object
    "Dimmer": 200                        // Number
  }
};
```

#### Conversion at Boundaries

```javascript
// When outputting to DMX hardware
// Input: device (plain object from $state)
// Uses: DEVICE_TYPES registry (CLASS instances)
// Output: DMX array written to hardware
function outputDeviceToDMX(device) {
  // Get device type definition (CLASS instance)
  const deviceType = DEVICE_TYPES[device.type];
  
  // Convert control values → DMX array
  // Input: plain object, Output: plain array
  const dmxArray = deviceValuesToDMX(deviceType, device.defaultValues);
  
  // Write to DMX universe at device's start channel
  universe.set(device.startChannel, dmxArray);
}
```

---

### Rationale

#### 1. Clean Separation of Concerns

**Control Types** (lib/controls/definitions.js):
- Define reusable UI control patterns
- Handle value ↔ DMX conversion
- Know their channel requirements
- Self-contained, testable units

**Device Types** (lib/outputs/devices/*.js):
- Declare which controls they use
- Specify channel layout
- Provide default values for ALL channels
- Simple, declarative definitions

**Application Code** (libraries, UI, etc.):
- Works with semantic control values
- Never touches DMX arrays directly
- Readable, maintainable code
- Easy to bind to UI components

**DMX Output** (boundary layer):
- Converts control values → DMX arrays
- Only place that deals with channel indices
- Isolated, optimizable conversion logic

#### 2. Unified Developer Experience

```javascript
// Old system - multiple levels of indirection
const redValue = device.defaultValues[
  deviceType.components[
    deviceType.controls.find(c => c.name === 'Color').components.r
  ].channel
];

// New system - direct, semantic access
const redValue = device.defaultValues.Color.r;
```

#### 3. Better Code Reusability

**Shared Controls:**
```javascript
// Define RGB once
export class RGBControl extends ControlType { ... }

// Use in 10+ device types
controls: [{ name: 'Color', type: CONTROL_TYPES.RGB, startChannel: 3 }]
```

**Control-Based Linking:**
```javascript
// Old: Copy DMX channels by name matching
applyLinkedValues(sourceType, targetType, sourceDMX, targetDMX, ...)

// New: Copy control values directly
function applyLinkedValues(sourceDevice, targetDevice, controlNames) {
  for (const controlName of controlNames) {
    if (sourceDevice.defaultValues[controlName]) {
      targetDevice.defaultValues[controlName] = 
        { ...sourceDevice.defaultValues[controlName] };
    }
  }
}
```

#### 4. Flexible Device Definitions

```javascript
// Easy to have channels without controls
{
  channels: 16,
  defaultValues: [
    0, 0, 0, 0,      // Channels 0-3: Pan/Tilt (with fine)
    0, 255, 0,       // Channels 4-6: Speed, Dimmer, Strobe
    0, 0, 0, 0,      // Channels 7-10: RGBW
    0,               // Channel 11: Color wheel (hidden, default 0)
    0,               // Channel 12: Gobo wheel (hidden, default 0)
    128,             // Channel 13: Gobo rotation (hidden, default centered)
    0, 0             // Channels 14-15: Prism, Reset (hidden)
  ],
  controls: [
    // Only expose 6 controls (covering 11 channels)
    // Channels 11-15 have defaults but no UI controls
  ]
}
```

#### 5. Easier UI Development

```javascript
// Bind directly to control values
<ColorPicker bind:value={device.defaultValues.Color} />
<XYPad bind:value={device.defaultValues['Pan/Tilt']} />
<Slider bind:value={device.defaultValues.Dimmer} />

// No conversion needed!
```

#### 6. Type-Safe Conversions

```javascript
// Control types enforce correct value structure
CONTROL_TYPES.RGB.valueToDMX({ r: 255, g: 128, b: 64 })  // ✅ Valid
CONTROL_TYPES.RGB.valueToDMX([255, 128, 64])            // ❌ Type error
CONTROL_TYPES.RGB.valueToDMX({ x: 128, y: 64 })         // ❌ Type error
```

---

### Implementation Plan

Since we're in active development with no production users, we can do a clean break refactoring without backward compatibility concerns.

#### Overview

**Goal**: Implement both shared control definitions and control-based value storage as a unified refactoring.

**Approach**: Bottom-up implementation starting with foundational systems and working up to UI components.

**Strategy**: Keep old code intact initially, build new system alongside, then switch over and delete old code.

---

### Stage 1: Foundation - Control Type System

**Goal**: Create the shared control type infrastructure

#### Tasks

- [ ] **1.1: Create control type base class**
  - File: `src/lib/controls/definitions.js`
  - Implement `ControlType` base class
  - Methods: `getChannelCount()`, `valueToDMX()`, `dmxToValue()`

- [ ] **1.2: Implement basic control types**
  - `RGBControl` (3 channels: r, g, b)
  - `RGBAControl` (4 channels: r, g, b, a)
  - `SliderControl` (1 channel: value)
  - Create `CONTROL_TYPES` registry object

- [ ] **1.3: Implement advanced control types**
  - `XYPadControl` (2 channels: x, y)
  - `XYPad16Control` (4 channels: pan, pan fine, tilt, tilt fine)
  - Handle 8-bit to 16-bit conversion for fine channels

- [ ] **1.4: Create conversion utilities**
  - File: `src/lib/controls/converter.js`
  - Implement `controlValuesToDMX(deviceType, controlValues)`
  - Implement `dmxToControlValues(deviceType, dmxArray)`
  - Handle missing/undefined values gracefully

- [ ] **1.5: Write tests**
  - Test each control type's `valueToDMX()` and `dmxToValue()`
  - Test roundtrip conversion (value → DMX → value)
  - Test edge cases (undefined values, out of range)
  - Test conversion utilities

**Deliverable**: Working control type system that can convert between control values and DMX arrays

---

### Stage 2: Device Type Refactoring

**Goal**: Rewrite device type definitions using shared controls

#### Tasks

- [ ] **2.1: Update DeviceType base class**
  - File: `src/lib/outputs/devices/DeviceType.js`
  - New constructor accepting: `{ name, channels, defaultValues, controls }`
  - Remove `components` parameter (no longer needed)
  - Update `getDefaultValues()` method

- [ ] **2.2: Rewrite simple device types**
  - **RGB** (`src/lib/outputs/devices/RGB.js`)
    - 3 channels, Color control at channel 0
  - **RGBA** (`src/lib/outputs/devices/RGBA.js`)
    - 4 channels, Color control at channel 0
  - **RGBW** (`src/lib/outputs/devices/RGBW.js`)
    - 4 channels, Color at 0, White at 3
  - **DIMMER** (`src/lib/outputs/devices/DIMMER.js`)
    - 1 channel, Dimmer control at channel 0

- [ ] **2.3: Rewrite complex device types**
  - **SMOKE** (`src/lib/outputs/devices/SMOKE.js`)
    - 2 channels, Volume at 0, Fan at 1
  - **FLAMETHROWER** (`src/lib/outputs/devices/FLAMETHROWER.js`)
    - Define all channels, map controls
  - **MOVING_HEAD** (`src/lib/outputs/devices/MOVING_HEAD.js`)
    - 7 channels, Pan/Tilt, Dimmer, RGB, White
  - **MOVING_HEAD_11CH** (`src/lib/outputs/devices/MOVING_HEAD_11CH.js`)
    - 11 channels, Pan/Tilt with fine, Speed, Dimmer, Strobe, RGB, White

- [ ] **2.4: Update device type exports**
  - File: `src/lib/outputs/devices.js`
  - Verify all device types are exported
  - Update any helper functions that access device structure

- [ ] **2.5: Test device definitions**
  - Verify `getDefaultValues()` returns correct array
  - Verify control placement (startChannel + channel count)
  - Verify no channel overlaps
  - Test each device type's control mapping

**Deliverable**: All device types using new shared control system

---

### Stage 3: Library Updates (Data Layer)

**Goal**: Update libraries to use control-based values

#### Tasks

- [ ] **3.1: Update DeviceLibrary**
  - File: `src/lib/DeviceLibrary.svelte.js`
  
  - [ ] Update `create()` method
    - Change `defaultValues` from array to object
    - Use `createDefaultControlValues(deviceType)` helper
  
  - [ ] Update `updateValue()` method
    - Change signature to `updateValue(deviceId, controlName, value)`
    - Update control value object instead of array
  
  - [ ] Update `propagateToLinkedDevices()`
    - Simplify to copy control values directly
    - No more channel-level copying
  
  - [ ] Update `clearAllValues()`
    - Reset to default control values
  
  - [ ] Remove `deserializeItem()` backward compatibility
    - Assume all data is already in new format (no users)
    - Or add simple converter for your test data

- [ ] **3.2: Update AnimationLibrary**
  - File: `src/lib/AnimationLibrary.svelte.js`
  
  - [ ] Update `addKeyframe()` method
    - Accept control values object instead of DMX array
  
  - [ ] Update `updateKeyframe()` method
    - Work with control values
  
  - [ ] Update keyframe storage structure
    - Change `keyframe.values` from array to object

- [ ] **3.3: Update TriggerLibrary**
  - File: `src/lib/TriggerLibrary.svelte.js`
  
  - [ ] Update `create()` method
    - Change `values` structure from `{ channelValues, enabledControls }` to control object
  
  - [ ] Simplify trigger value storage
    - Just `{ "Color": { r, g, b }, "Dimmer": 255 }` instead of channelValues
  
  - [ ] Remove `enabledControls` array
    - Presence in object indicates enabled (simpler)

- [ ] **3.4: Create value utilities**
  - File: `src/lib/values/utils.js`
  
  - [ ] `createDefaultControlValues(deviceType)` → control values object
  - [ ] `getControlValue(controlValues, controlName)` → value
  - [ ] `setControlValue(controlValues, controlName, value)` → updated object
  - [ ] `mergeControlValues(source, target)` → merged object

**Deliverable**: Libraries storing and managing control-based values

---

### Stage 4: Sync & Linking Updates

**Goal**: Update device linking to work with control values

#### Tasks

- [ ] **4.1: Simplify device linking**
  - File: `src/lib/outputs/sync.js`
  
  - [ ] Rewrite `applyLinkedValues()`
    - Remove channel-level mapping
    - Simple: copy control values by name
    - Apply `mirrorPan` to Pan/Tilt.x if needed
    - Filter by `syncedControls` array
  
  - [ ] Update `getControlMapping()`
    - Return control names that exist in both device types
    - Much simpler than current implementation
  
  - [ ] Update `canLinkDevices()`
    - Check for common control names
  
  - [ ] Remove `getControlChannels()` (no longer needed)
  - [ ] Remove `getMappedChannels()` (no longer needed)

**Deliverable**: Simplified device linking working with control values

---

### Stage 5: CSS Generation Updates

**Goal**: Update CSS generation to work with control values

#### Tasks

- [ ] **5.1: Update outputs/css.js**
  - File: `src/lib/outputs/css.js`
  
  - [ ] Update `getProperties()` function
    - Accept control values object instead of DMX array
    - Remove `components` parameter (no longer needed)
    - Simplify: map control values directly to CSS
  
  - [ ] Update `generateCSSBlock()` function
    - Use new `getProperties()` signature
    - Convert device control values to CSS

- [ ] **5.2: Update animations/css.js**
  - File: `src/lib/animations/css.js`
  
  - [ ] Update `getKeyframeProperties()` function
    - Work with control values from keyframe
    - No more DMX array conversion
  
  - [ ] Simplify `generateCSSAnimation()`
    - Keyframes already have control values

- [ ] **5.3: Update triggers/css.js**
  - File: `src/lib/triggers/css.js`
  
  - [ ] Update `_generateManualValuesCSS()` function
    - Work with trigger control values directly
    - Remove DMX array conversion step
    - Remove `enabledControls` filtering (implicit in object keys)

- [ ] **5.4: Update control CSS mapping**
  - File: `src/lib/css/mapping/controlToCssMapping.js`
  
  - [ ] Update mapping to work with control names
  - [ ] Simplify RGB/RGBA mapping
  - [ ] Update XY pad mapping for Pan/Tilt

**Deliverable**: CSS generation working with control values

---

### Stage 6: DMX Output Boundary

**Goal**: Add conversion layer at DMX output

#### Tasks

- [ ] **6.1: Update DMX output**
  - File: `src/lib/outputs/dmx.js` (or wherever DMX output happens)
  
  - [ ] Add conversion before DMX universe update
    ```javascript
    const dmxArray = controlValuesToDMX(deviceType, device.defaultValues);
    universe.set(device.startChannel, dmxArray);
    ```
  
  - [ ] Optimize conversion for 60fps if needed
  - [ ] Profile performance

- [ ] **6.2: Update CSS sampler output**
  - File: `src/lib/css/sampler.js`
  
  - [ ] If sampler outputs to DMX, add conversion
  - [ ] Ensure sampled CSS values → control values → DMX arrays

**Deliverable**: DMX output working with conversion at boundary

---

### Stage 7: Preview & Helper Functions

**Goal**: Update preview and utility functions

#### Tasks

- [ ] **7.1: Update device preview functions**
  - File: `src/lib/outputs/devices.js`
  
  - [ ] Update `getDevicePreviewData()`
    - Accept control values instead of DMX array
    - Simplify: directly extract from control values object
  
  - [ ] Remove `convertChannelsToArray()` (no longer needed)
  
  - [ ] Update `getTriggerValuesPreviewData()`
    - Work with control values object

- [ ] **7.2: Update color utilities**
  - File: `src/lib/outputs/devices.js`
  
  - [ ] Update `getDeviceColor()`
    - Accept control values instead of DMX array
    - Extract RGB from Color control value

**Deliverable**: Preview and utilities working with control values

---

### Stage 8: UI Component Updates

**Goal**: Update all UI components to work with control values

#### Tasks

- [ ] **8.1: Update device control components**
  - File: `src/components/controls/Controls.svelte`
  
  - [ ] Update control value bindings
  - [ ] Bind directly to `device.defaultValues[controlName]`
  - [ ] Remove any DMX array index references
  
  - File: `src/components/controls/XYPad.svelte`
  - [ ] Bind to `value.x` and `value.y` directly

- [ ] **8.2: Update device cards**
  - File: `src/components/cards/DeviceCard.svelte`
  
  - [ ] Update value display to show control values
  - [ ] Update preview to use control values

- [ ] **8.3: Update animation editor**
  - File: `src/components/animations/TimelineEditor.svelte`
  
  - [ ] Update keyframe creation to use control values
  - [ ] Update keyframe editing to use control values
  - [ ] Remove DMX array references

- [ ] **8.4: Update trigger editor**
  - File: `src/components/dialogs/EditManualTriggerDialog.svelte`
  - File: `src/components/dialogs/AddManualTriggerDialog.svelte`
  
  - [ ] Update trigger value editor
  - [ ] Simplify: just show controls with values
  - [ ] Remove `enabledControls` checkbox system (implicit)

- [ ] **8.5: Update device dialogs**
  - File: `src/components/dialogs/EditDeviceDialog.svelte`
  
  - [ ] Update linked device control selection
  - [ ] Show control names instead of channel numbers
  - [ ] Update value displays

**Deliverable**: All UI components working with control values

---

### Stage 9: Cleanup & Testing

**Goal**: Remove old code and verify everything works

#### Tasks

- [ ] **9.1: Remove old code**
  
  - [ ] Remove `components` layer from device types
  - [ ] Remove old conversion functions
  - [ ] Remove DMX array handling from libraries (except converters)
  - [ ] Search for "TODO" comments added during refactoring
  - [ ] Remove unused imports

- [ ] **9.2: Clear localStorage**
  
  - [ ] Clear your browser localStorage (no users to migrate)
  - [ ] Test creating new devices from scratch
  - [ ] Test saving/loading all libraries

- [ ] **9.3: Integration testing**
  
  - [ ] Create devices of each type
  - [ ] Set control values
  - [ ] Verify CSS generation
  - [ ] Verify DMX output
  - [ ] Test device linking
  - [ ] Create animations with keyframes
  - [ ] Create triggers with values
  - [ ] Test complete workflow

- [ ] **9.4: Performance testing**
  
  - [ ] Profile DMX output at 60fps
  - [ ] Test with 50+ devices
  - [ ] Verify conversion overhead < 1ms per frame
  - [ ] Optimize if needed

- [ ] **9.5: Update documentation**
  
  - [ ] Update code comments
  - [ ] Update README if needed
  - [ ] Update any architecture docs
  - [ ] This VALUESTORAGE.md becomes historical reference

**Deliverable**: Clean, working system with all old code removed

---

### Implementation Notes

#### Key Principles

1. **Bottom-up**: Build foundation first (controls) before changing consumers (UI)
2. **Incremental**: Each stage should be testable independently
3. **Keep it working**: Don't break the app during development
4. **No backward compatibility**: We can break localStorage data freely

#### Development Flow

```
Stage 1-2: Backend (controls + device types)
  ↓ (Test: device definitions work)
Stage 3-4: Data layer (libraries + sync)
  ↓ (Test: can create/edit devices)
Stage 5-6: Boundaries (CSS + DMX)
  ↓ (Test: CSS generation works, DMX outputs)
Stage 7-8: UI (components + previews)
  ↓ (Test: full user workflow)
Stage 9: Cleanup
  ↓
Done!
```

#### Quick Wins

- Stage 1 can be done in isolation (pure logic)
- Stage 2 can be tested without UI changes
- Stages 3-4 can be tested with console logging
- Stage 5 can be verified in CSS View
- Only Stage 8 requires UI work

#### Time Estimates

- **Stage 1**: 1-2 days (foundation)
- **Stage 2**: 1-2 days (device types)
- **Stage 3**: 2-3 days (libraries)
- **Stage 4**: 1 day (linking)
- **Stage 5**: 1-2 days (CSS)
- **Stage 6**: 0.5 day (DMX output)
- **Stage 7**: 0.5 day (previews)
- **Stage 8**: 2-3 days (UI components)
- **Stage 9**: 1 day (cleanup)

**Total**: ~10-15 days of focused work

---

### Success Criteria

✅ All device types use shared control definitions  
✅ All values stored as control objects (no DMX arrays in storage)  
✅ DMX arrays only exist at output boundary  
✅ All UI components work with control values  
✅ Device linking works with control names  
✅ CSS generation works from control values  
✅ Performance: 60fps output with 50+ devices  
✅ Code: 30% reduction in value-handling code  
✅ Debugging: Values are human-readable in devtools  
✅ No old conversion code remains  

---

## Conclusion

---

## Implementation Sketch

### New Value Structure

```javascript
// lib/values/structure.js

/**
 * Value types for different control types
 */
export class ControlValue {
  static RGB(r = 0, g = 0, b = 0) {
    return { r, g, b };
  }
  
  static RGBA(r = 0, g = 0, b = 0, a = 0) {
    return { r, g, b, a };
  }
  
  static Slider(value = 0) {
    return value;
  }
  
  static XYPad(x = 128, y = 128) {
    return { x, y };
  }
  
  static Toggle(enabled = false) {
    return enabled ? 255 : 0;
  }
}

/**
 * Create default values object for a device type
 */
export function createDefaultValues(deviceType) {
  const values = {};
  const deviceDef = DEVICE_TYPES[deviceType];
  
  for (const control of deviceDef.controls) {
    if (control.type === 'rgb') {
      values[control.name] = ControlValue.RGB();
    } else if (control.type === 'slider') {
      values[control.name] = ControlValue.Slider(0);
    } else if (control.type === 'xypad') {
      values[control.name] = ControlValue.XYPad();
    } else if (control.type === 'toggle') {
      values[control.name] = ControlValue.Toggle(false);
    }
  }
  
  return values;
}

/**
 * Convert control values to DMX array
 */
export function controlValuesToDMX(deviceType, controlValues) {
  const deviceDef = DEVICE_TYPES[deviceType];
  const dmxArray = new Array(deviceDef.channels).fill(0);
  
  for (const control of deviceDef.controls) {
    const value = controlValues[control.name];
    if (!value) continue;
    
    if (control.type === 'rgb' || control.type === 'rgba') {
      for (const [component, componentIndex] of Object.entries(control.components)) {
        const channel = deviceDef.components[componentIndex].channel;
        dmxArray[channel] = value[component] ?? 0;
      }
    } else if (control.type === 'slider' || control.type === 'toggle') {
      const componentIndex = Object.values(control.components)[0];
      const channel = deviceDef.components[componentIndex].channel;
      dmxArray[channel] = value;
    } else if (control.type === 'xypad') {
      const xChannel = deviceDef.components[control.components.x].channel;
      const yChannel = deviceDef.components[control.components.y].channel;
      dmxArray[xChannel] = value.x ?? 128;
      dmxArray[yChannel] = value.y ?? 128;
    }
  }
  
  return dmxArray;
}

/**
 * Convert DMX array to control values
 */
export function dmxToControlValues(deviceType, dmxArray) {
  const deviceDef = DEVICE_TYPES[deviceType];
  const values = {};
  
  for (const control of deviceDef.controls) {
    if (control.type === 'rgb') {
      const r = dmxArray[deviceDef.components[control.components.r].channel] ?? 0;
      const g = dmxArray[deviceDef.components[control.components.g].channel] ?? 0;
      const b = dmxArray[deviceDef.components[control.components.b].channel] ?? 0;
      values[control.name] = ControlValue.RGB(r, g, b);
    } else if (control.type === 'rgba') {
      const r = dmxArray[deviceDef.components[control.components.r].channel] ?? 0;
      const g = dmxArray[deviceDef.components[control.components.g].channel] ?? 0;
      const b = dmxArray[deviceDef.components[control.components.b].channel] ?? 0;
      const a = dmxArray[deviceDef.components[control.components.a].channel] ?? 0;
      values[control.name] = ControlValue.RGBA(r, g, b, a);
    } else if (control.type === 'slider' || control.type === 'toggle') {
      const componentIndex = Object.values(control.components)[0];
      const channel = deviceDef.components[componentIndex].channel;
      values[control.name] = dmxArray[channel] ?? 0;
    } else if (control.type === 'xypad') {
      const xChannel = deviceDef.components[control.components.x].channel;
      const yChannel = deviceDef.components[control.components.y].channel;
      values[control.name] = ControlValue.XYPad(
        dmxArray[xChannel] ?? 128,
        dmxArray[yChannel] ?? 128
      );
    }
  }
  
  return values;
}
```

### Updated Device Structure

```javascript
// Device with control-based values
{
  id: "uuid-1234",
  type: "MOVING_HEAD",
  name: "Moving Head 1",
  startChannel: 1,
  defaultValues: {
    "Color": { r: 255, g: 0, b: 0 },
    "Dimmer": 255,
    "Pan/Tilt": { x: 128, y: 128 },
    "Strobe": 0,
    "Movement Speed": 128
  },
  linkedTo: null,
  syncedControls: ["Color", "Dimmer"],  // Control names instead of channel indices
  mirrorPan: false,
  cssId: "moving-head-1",
  order: 0
}
```

### Updated Animation Structure

```javascript
{
  id: "uuid-5678",
  name: "color-cycle",
  cssName: "color-cycle",
  controls: ["Color"],
  displayName: "Color Cycle",
  keyframes: [
    {
      time: 0,
      deviceType: "RGB",
      values: {
        "Color": { r: 255, g: 0, b: 0 }
      }
    },
    {
      time: 0.5,
      deviceType: "RGB",
      values: {
        "Color": { r: 0, g: 255, b: 0 }
      }
    },
    {
      time: 1.0,
      deviceType: "RGB",
      values: {
        "Color": { r: 0, g: 0, b: 255 }
      }
    }
  ],
  order: 0
}
```

### Updated Trigger Structure

```javascript
{
  id: "uuid-9012",
  triggerType: "pressed",
  inputId: "input-uuid",
  actionType: "values",
  deviceId: "device-uuid",
  animation: null,
  values: {
    "Color": { r: 128, g: 64, b: 192 },
    "Dimmer": 200
  },
  order: 0
}
```

---

## Performance Considerations

### Current System (DMX Arrays)
- **Storage**: ~512 bytes per device (worst case, all channels)
- **Access**: O(1) array index lookup
- **Conversion**: None needed for DMX output

### Proposed System (Control Objects)
- **Storage**: ~100-200 bytes per device (only used controls)
- **Access**: O(1) object property lookup (hash table)
- **Conversion**: ~5-10μs per device to convert to DMX array

### Benchmark Targets
- 60fps output = 16.67ms per frame
- 100 devices × 10μs conversion = 1ms (6% of frame budget)
- **Verdict**: Negligible performance impact

---

## Conclusion

The **control-based storage approach (Option A)** provides significant benefits in code clarity, maintainability, and flexibility with minimal performance cost. The DMX array format should be reserved for the output boundary only, not used as the primary storage format throughout the application.

The migration can be done gradually with a clear path forward, and the benefits compound over time as new features are added to the system.
