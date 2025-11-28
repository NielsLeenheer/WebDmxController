# Component Structure

This directory contains all Svelte components organized by their purpose.

## Directory Structure

```
components/
├── common/          # Reusable UI components
│   ├── Button.svelte
│   ├── IconButton.svelte
│   └── Dialog.svelte
│
├── controls/        # Device control components
│   ├── DeviceControls.svelte
│   └── XYPad.svelte
│
├── layout/          # Layout and navigation components
│   ├── Header.svelte
│   └── Tabs.svelte
│
└── views/           # Main application views
    ├── DevicesView.svelte
    ├── UniverseView.svelte
    ├── TimelineView.svelte
    └── EditorView.svelte
```

## Component Categories

### Common Components (`/common`)
Reusable UI primitives that can be used throughout the application:
- **Button**: Standard button with variants (primary, secondary, danger)
- **IconButton**: Icon-only button for toolbars and compact UIs
- **Dialog**: Modal dialog wrapper component

### Control Components (`/controls`)
Specialized controls for DMX device manipulation:
- **DeviceControls**: Dynamic controls based on device type (sliders, XY pads)
- **XYPad**: 2D control pad for pan/tilt positioning

### Layout Components (`/layout`)
Top-level navigation and application structure:
- **Header**: Application header with connection controls
- **Tabs**: Tab navigation for switching between views

### View Components (`/views`)
Main application views (full-screen content areas):
- **DevicesView**: Device management and configuration
- **UniverseView**: 512-channel DMX universe grid
- **TimelineView**: Keyframe-based animation timeline
- **EditorView**: CSS animation-driven DMX control

## Usage

Import components using relative paths from the component category:

```javascript
// In App.svelte
import Header from './components/layout/Header.svelte';
import DevicesView from './components/views/DevicesView.svelte';

// In a view component
import Button from '../common/Button.svelte';
import DeviceControls from '../controls/DeviceControls.svelte';
```
