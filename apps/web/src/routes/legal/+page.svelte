<script lang="ts">
  import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
  <title>Compliance | Guilloche Studio</title>
  <meta
    name="description"
    content="Legal, licensing, and compliance information for Guilloche Studio."
  />
</svelte:head>

<main class="bg-white min-h-screen pt-48 pb-24 font-kalice text-gray-900">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <h1 class="text-5xl font-sohne-halbfett mb-16 tracking-tighter">Compliance.</h1>

    <div
      class="prose prose-gray max-w-none space-y-12 text-xl font-light leading-relaxed text-gray-500"
    >
      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Entity
        </h2>
        <p>
          Guilloche Studio is a specialized design platform developed and maintained by
          WritersLogic. All registered trademarks and intellectual property related to the
          "Guilloche Studio" name are owned by WritersLogic.
        </p>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Contact
        </h2>
        <p>For official inquiries regarding compliance, security audits, or data protection:</p>
        <div
          class="mt-8 p-10 bg-gray-50 border border-gray-100 rounded-[2.5rem] font-mono text-sm tracking-tight text-gray-600"
        >
          WritersLogic <br />
          Attn: Legal & Compliance <br />
          legal@guillochestudio.com
        </div>
      </section>

      <section>
        <h2 class="text-xs font-sohne-halbfett text-gray-900 uppercase tracking-[0.4em] mb-6">
          Standards Adherence
        </h2>
        <p>
          Our mathematical engine is strictly compliant with SVG 1.1 (W3C), ISO 12647 (Printing),
          and modern vector encryption standards.
        </p>
      </section>

      <div class="pt-16 border-t border-gray-100 mt-16 pb-20">
        <p class="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300">
          Guilloche Studio — Engineered Excellence Since 2026
        </p>
      </div>
    </div>
  </div>
</main>

<Footer />
