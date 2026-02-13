<script lang="ts">
  import { locale, _ } from 'svelte-i18n';
  import { SUPPORTED_LOCALES, LOCALE_NAMES, changeLocale, type SupportedLocale } from '$lib/i18n';

  async function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newLocale = target.value as SupportedLocale;
    await changeLocale(newLocale);
  }
</script>

<div class="flex flex-col gap-1">
  <label for="language-select" class="block text-sm font-medium text-gray-700">
    {$_('settings.language')}
  </label>
  <select
    id="language-select"
    value={$locale}
    on:change={handleChange}
    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
  >
    {#each SUPPORTED_LOCALES as loc}
      <option value={loc}>{LOCALE_NAMES[loc]}</option>
    {/each}
  </select>
</div>
