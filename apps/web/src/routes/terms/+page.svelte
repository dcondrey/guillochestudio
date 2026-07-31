<script lang="ts">
  import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
  <title>Terms of Use | Guilloche Studio</title>
  <meta name="description" content="Terms of service and usage conditions for Guilloche Studio." />
</svelte:head>

<main class="bg-white min-h-screen pt-48 pb-24 font-kalice text-gray-900">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <h1 class="text-5xl font-sohne-halbfett mb-16 tracking-tighter">Terms of Use.</h1>

    <div
      class="prose prose-gray max-w-none space-y-12 text-xl font-light leading-relaxed text-gray-500"
    >
      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          1. Engineering Standards
        </h2>
        <p>
          By accessing Guilloche Studio, you agree to utilize our tools for professional design and
          mathematical exploration. Our engine is provided "as is" with guaranteed precision at the
          coordinate level.
        </p>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          2. Intellectual Property
        </h2>
        <p>
          All patterns generated using the platform are the exclusive property of the creator.
          Guilloche Studio claims no rights to your output. The underlying mathematical rendering
          code and brand assets remain the property of WritersLogic.
        </p>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          3. Professional Licensing
        </h2>
        <p>
          Commercial use, high-resolution vector export (DXF/G-CODE), and AI assistance features
          require an active Pro or Enterprise license. Unauthorized scraping of DNA codes is
          strictly prohibited.
        </p>
      </section>

      <div class="pt-16 border-t border-gray-100 mt-16 pb-20">
        <p class="text-[10px] font-mono tracking-[0.4em] uppercase text-gray-300">
          Jurisdiction: WritersLogic / International Law
        </p>
      </div>
    </div>
  </div>
</main>

<Footer />
