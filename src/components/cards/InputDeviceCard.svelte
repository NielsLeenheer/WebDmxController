<script>
	import CardHeader from '../common/CardHeader.svelte';
	import Preview from '../common/Preview.svelte';
	import IconButton from '../common/IconButton.svelte';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';

	let {
		deviceId,
		deviceName,
		inputs = [],        // Array of input objects belonging to this device
		inputStates = {},   // Map of inputId → state object
		onEdit,             // (input, anchorEl) => void
	} = $props();

</script>

<div class="input-device-card">
	<CardHeader>
		<span class="device-name">{deviceName || deviceId}</span>
	</CardHeader>

	<ul class="input-list">
		{#each inputs as input (input.id)}
			<li class="input-item">
				<Preview
					type="input"
					size="small"
					data={input}
					state={inputStates[input.id] || {}}
				/>

				<div class="input-info">
					<span class="input-name">{input.name}</span>
					{#if input.controlName}
						<span class="input-control">{input.controlName}</span>
					{/if}
				</div>

				<IconButton
					icon={dotsIcon}
					label="Input settings"
					onclick={(e) => onEdit?.(input, e?.currentTarget)}
					size="small"
				/>
			</li>
		{/each}
	</ul>
</div>

<style>
	.input-device-card {
		background: #f0f0f0;
		border-radius: 8px;
		padding: 15px;
	}

	.device-name {
		font-weight: 600;
		font-size: 10pt;
		color: #333;
	}

	.input-list {
		list-style: none;
		margin: -8px 0;
		padding: 0;
	}

	.input-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.input-item:last-child {
		border-bottom: none;
	}

	.input-info {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0 8px;
		min-width: 0;
	}

	.input-name {
		font-size: 9.5pt;
		font-weight: 500;
		color: #333;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.input-control {
		font-size: 7.5pt;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
