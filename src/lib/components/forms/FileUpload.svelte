<script lang="ts">
	interface Props {
		onFileSelected: (file: File) => void; // Changed to single file
	}

	let { onFileSelected }: Props = $props();

	let isDragOver = $state(false);
	let fileInput: HTMLInputElement;

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		const files = Array.from(event.dataTransfer?.files || []).filter(
			(file) =>
				file.type === 'text/csv' ||
				file.name.endsWith('.csv') ||
				file.type === 'text/xml' ||
				file.name.endsWith('.dek')
		);

		if (files.length > 0) {
			onFileSelected(files[0]); // Only take the first file
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = Array.from(target.files || []);

		if (files.length > 0) {
			onFileSelected(files[0]); // Only take the first file
		}
	}

	function openFileDialog() {
		fileInput.click();
	}
</script>

<div class="relative">
	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,.dek"
		onchange={handleFileSelect}
		class="hidden"
	/>
	<div
		role="button"
		tabindex="0"
		onclick={openFileDialog}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? openFileDialog() : null)}
		class={`
			file-upload-area cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
			${
				isDragOver
					? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
					: 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-700/50'
			}
		`}
	>
		<div class="flex flex-col items-center space-y-4">
			<svg
				class="h-12 w-12 text-gray-400 dark:text-gray-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			<div>
				<p class="text-lg font-medium text-gray-700 dark:text-gray-200">
					Drop a CSV or DEK file here or click to browse
				</p>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Upload one CSV file from your MTG collection app or DEK file from MTGO
				</p>
			</div>
			<p class="text-xs text-gray-400 dark:text-gray-500">
				Auto-detects format: Archidekt, CardCastle, CubeCobra, DeckBox, DelverLens, ManaBox, MTGO,
				and more
			</p>
		</div>
	</div>
</div>
