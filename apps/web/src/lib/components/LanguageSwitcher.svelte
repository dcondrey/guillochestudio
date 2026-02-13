<script lang="ts">
	import { locale, _ } from 'svelte-i18n';
	import {
		SUPPORTED_LOCALES,
		LOCALE_NAMES,
		changeLocale,
		type SupportedLocale
	} from '$lib/i18n';

	let isOpen = false;

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	async function selectLocale(newLocale: SupportedLocale) {
		await changeLocale(newLocale);
		closeDropdown();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeDropdown();
		}
	}

	// Get the current locale as SupportedLocale
	$: currentLocale = ($locale || 'en') as SupportedLocale;

	// Get the current locale display name
	$: currentLocaleName = LOCALE_NAMES[currentLocale] || $locale || 'English';

	// Get flag emoji for locale
	function getLocaleFlag(loc: SupportedLocale): string {
		const flags: Record<SupportedLocale, string> = {
			en: 'GB',
			es: 'ES',
			fr: 'FR',
			de: 'DE',
			ja: 'JP',
			zh: 'CN'
		};
		const countryCode = flags[loc] || 'GB';
		// Convert country code to flag emoji
		const codePoints = countryCode
			.toUpperCase()
			.split('')
			.map((char) => 127397 + char.charCodeAt(0));
		return String.fromCodePoint(...codePoints);
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative">
	<button
		type="button"
		on:click={toggleDropdown}
		class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-label={$_('settings.selectLanguage')}
	>
		<span class="text-base">{getLocaleFlag(currentLocale)}</span>
		<span class="hidden sm:inline">{currentLocaleName}</span>
		<svg
			class="w-4 h-4 text-gray-500 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<!-- Backdrop to close dropdown when clicking outside -->
		<button
			type="button"
			class="fixed inset-0 z-10 bg-transparent"
			on:click={closeDropdown}
			tabindex="-1"
			aria-label="Close menu"
		/>

		<!-- Dropdown menu -->
		<ul
			class="absolute right-0 z-20 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-auto"
			role="listbox"
			aria-label={$_('settings.selectLanguage')}
		>
			{#each SUPPORTED_LOCALES as loc}
				<li>
					<button
						type="button"
						on:click={() => selectLocale(loc)}
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors
							{$locale === loc
							? 'bg-blue-50 text-blue-700 font-medium'
							: 'text-gray-700 hover:bg-gray-50'}"
						role="option"
						aria-selected={$locale === loc}
					>
						<span class="text-base">{getLocaleFlag(loc)}</span>
						<span>{LOCALE_NAMES[loc]}</span>
						{#if $locale === loc}
							<svg class="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
