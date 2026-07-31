<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="bg-[#F5F5F7] border-t border-gray-200/50 pb-24 relative overflow-hidden">
  <!-- Decorative Background Accent -->
  <div
    class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"
  ></div>

  <div
    class="mx-auto max-w-7xl px-10 py-24 grid grid-cols-1 md:grid-cols-4 gap-16 lg:px-8 relative z-10"
  >
    <div class="md:col-span-2">
      <div class="flex items-center gap-3 mb-8">
        <img src="/logo.svg" alt="" class="h-7 w-auto" />
        <span class="text-xl font-sohne-halbfett tracking-tight text-gray-900"
          >Guilloche Studio</span
        >
      </div>
      <p class="max-w-xs text-lg font-kalice font-light text-gray-500 leading-relaxed">
        The gold standard for security printing and mathematical art. Engineered for precision and
        trust.
      </p>
    </div>

    <div>
      <h4
        class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-900 mb-8 font-sohne-halbfett"
      >
        Platform
      </h4>
      <ul class="space-y-4 text-sm font-medium text-gray-500 font-sohne-buch">
        <li><a href="/studio" class="hover:text-black transition-colors">Studio Engine</a></li>
        <li>
          <a href="https://github.com/guillochestudio" class="hover:text-black transition-colors"
            >Documentation</a
          >
        </li>
        <li><a href="/pricing" class="hover:text-black transition-colors">Licensing</a></li>
      </ul>
    </div>

    <div>
      <h4
        class="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-900 mb-8 font-sohne-halbfett"
      >
        Legal & Privacy
      </h4>
      <ul class="space-y-4 text-sm font-medium text-gray-500 font-sohne-buch">
        <li><a href="/privacy" class="hover:text-black transition-colors">Privacy Standards</a></li>
        <li><a href="/terms" class="hover:text-black transition-colors">Terms of Use</a></li>
        <li><a href="/legal" class="hover:text-black transition-colors">Compliance</a></li>
      </ul>
    </div>
  </div>

  <div
    class="mx-auto max-w-7xl px-10 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-gray-200/50 pt-16"
  >
    <div class="flex flex-col md:flex-row items-center gap-4 md:gap-10">
      <p class="text-[10px] leading-5 text-gray-600 font-mono tracking-[0.3em] uppercase">
        &copy; {currentYear} WritersLogic. All Standards Observed.
      </p>
    </div>

    <div class="flex items-center gap-8">
      <a
        href="https://github.com/guillochestudio"
        class="text-gray-500 hover:text-black transition-colors flex items-center gap-2"
      >
        <span class="text-[10px] font-bold uppercase tracking-widest font-sohne-halbfett"
          >Source</span
        >
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"
          ><path
            fill-rule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clip-rule="evenodd"
          /></svg
        >
      </a>
    </div>
  </div>
</footer>
