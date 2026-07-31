<script lang="ts">
  import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
  <title>Privacy Standards | Guilloche Studio</title>
  <meta
    name="description"
    content="Privacy policy and data protection standards for Guilloche Studio users."
  />
</svelte:head>

<main class="bg-white min-h-screen pt-48 pb-24 font-kalice text-gray-900">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <h1 class="text-5xl font-sohne-halbfett mb-16 tracking-tighter">Privacy Standards.</h1>

    <div
      class="prose prose-gray max-w-none space-y-12 text-xl font-light leading-relaxed text-gray-500"
    >
      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Introduction
        </h2>
        <p>
          At Guilloche Studio, we respect your privacy and are committed to protecting your personal
          data. This policy explains how we handle your information when you use our pattern
          generation platform.
        </p>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Data We Collect
        </h2>
        <p>We collect minimal data necessary to provide our services:</p>
        <ul class="space-y-4">
          <li class="flex gap-4">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2.5 flex-shrink-0"></span>
            Account information (email, name) for authentication.
          </li>
          <li class="flex gap-4">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2.5 flex-shrink-0"></span>
            Pattern parameters and DNA codes saved to your library.
          </li>
          <li class="flex gap-4">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2.5 flex-shrink-0"></span>
            Performance metrics to optimize the WASM rendering engine.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Security Standards
        </h2>
        <p class="font-fraunces italic text-gray-900 text-2xl">
          "Security is not an add-on, it's the core."
        </p>
        <p class="mt-6">
          We employ bank-grade encryption for all stored pattern DNA. Your creative intellectual
          property remains yours; we do not claim ownership of patterns generated using our tools.
        </p>
      </section>

      <div class="pt-16 border-t border-gray-100 mt-16 pb-20">
        <p class="text-[10px] font-mono tracking-[0.4em] uppercase text-gray-300">
          Revision: 2026.02.13 • Public
        </p>
      </div>
    </div>
  </div>
</main>

<Footer />
