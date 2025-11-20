<script>
	import DraggableCard from '../common/DraggableCard.svelte';
	import CardHeader from '../common/CardHeader.svelte';
	import IconButton from '../common/IconButton.svelte';
	import Preview from '../common/Preview.svelte';
	import TimelineEditor from '../animations/TimelineEditor.svelte';
	import { Animation } from '../../lib/animations.js';

	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		animation,       // Animation plain object
		dnd,             // Drag-and-drop helper
		animationLibrary, // Animation library reference
		onSettings       // Callback when settings button clicked
	} = $props();

	/**
	 * Get display name for animation
	 */
	function getDisplayName() {
		return animation.displayName || animation.controls?.join(', ') || 'Animation';
	}

	/**
	 * Generate preview gradient for animation
	 */
	function getAnimationPreview() {
		// Check if animation has color-related controls
		const hasColor = animation.controls && (
			animation.controls.includes('Color') ||
			animation.controls.includes('Amber') ||
			animation.controls.includes('White')
		);

		if (!hasColor || !animation.keyframes || animation.keyframes.length === 0) {
			return '#888';
		}

		// Get control and component data for the animation
		const { controls, components } = Animation.getControlsForRendering(animation);

		// Extract colors from each keyframe
		const colors = animation.keyframes.map(keyframe => {
			const values = keyframe.values || [];

			// Find Color control
			const colorControl = controls.find(c => c.name === 'Color' && c.type === 'rgb');
			let r = 0, g = 0, b = 0;

			if (colorControl) {
				const rIdx = colorControl.components.r;
				const gIdx = colorControl.components.g;
				const bIdx = colorControl.components.b;
				r = values[rIdx] || 0;
				g = values[gIdx] || 0;
				b = values[bIdx] || 0;
			}

			// Add Amber if present
			const amberControl = controls.find(c => c.name === 'Amber' && c.type === 'slider');
			if (amberControl) {
				const amberIdx = amberControl.components.value;
				const amber = values[amberIdx] || 0;
				// Amber is #FFBF00 - adds to red and green
				r = Math.min(255, r + (255 * amber / 255));
				g = Math.min(255, g + (191 * amber / 255));
			}

			// Add White if present
			const whiteControl = controls.find(c => c.name === 'White' && c.type === 'slider');
			if (whiteControl) {
				const whiteIdx = whiteControl.components.value;
				const white = values[whiteIdx] || 0;
				// White adds equally to all channels
				r = Math.min(255, r + white);
				g = Math.min(255, g + white);
				b = Math.min(255, b + white);
			}

			return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
		});

		// Create stepped gradient with equal steps
		const numSteps = colors.length;
		const stepSize = 100 / numSteps;

		const gradientStops = colors.map((color, index) => {
			const start = index * stepSize;
			const end = (index + 1) * stepSize;
			return `${color} ${start}% ${end}%`;
		}).join(', ');

		return `linear-gradient(90deg, ${gradientStops})`;
	}

	let previewColor = $derived(getAnimationPreview());
	let displayName = $derived(getDisplayName());
</script>

<DraggableCard {dnd} item={animation} class="animation-card">
	<CardHeader>
		<Preview
			type="animation"
			size="medium"
			data={{ color: previewColor }}
		/>
		<div class="animation-info">
			<h3>{animation.name}</h3>
			<div class="badges">
				<div class="target-badge">{displayName}</div>
			</div>
		</div>
		<IconButton
			icon={editIcon}
			onclick={() => onSettings?.(animation)}
			title="Edit animation"
			size="small"
		/>
	</CardHeader>

	<TimelineEditor
		{animation}
		{animationLibrary}
	/>
</DraggableCard>

<style>
	:global(.card-header) .animation-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	:global(.card-header) .animation-info h3 {
		margin: 0;
		font-size: 11pt;
		font-weight: 600;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.target-badge {
		background: #e8f5e9;
		color: #2e7d32;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 9pt;
		font-weight: 500;
	}

	:global(.card-header) :global(.icon-button) {
		margin-left: auto;
	}
</style>
