<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Group from '../common/form/Group.svelte';
	import InputText from '../common/form/InputText.svelte';

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Form state
	let groupName = $state('');

	/**
	 * Open the dialog
	 * @returns {Promise<string|null>} Group name or null if cancelled
	 */
	export function open() {
		return new Promise((resolve) => {
			resolvePromise = resolve;
			groupName = '';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleCreate() {
		if (!groupName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		resolvePromise(groupName.trim());
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
		groupName = '';
	}
</script>

<Dialog
	bind:dialogRef={dialogRef}
	title="New Group"
	onclose={handleCancel}
	width="300px"
>
	<form id="new-group-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
		<Group label="Group Name:" for="group-name">
			<InputText
				id="group-name"
				bind:value={groupName}
				placeholder="e.g., Moods, Presets"
				autofocus
			/>
		</Group>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleCreate} variant="primary">Create</Button>
	{/snippet}
</Dialog>
