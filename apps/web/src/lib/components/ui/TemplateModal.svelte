<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { importComposition, addLayer } from '$lib/stores/pattern';
  import { getDefaultParams, generateId } from '@guilloche/shared';

  const dispatch = createEventDispatcher();

  const templates = [
    {
      name: 'The Rosette',
      description:
        'Sophisticated circular security seal with high-frequency modulation and nesting.',
      icon: '✿',
      layers: [
        {
          id: generateId(),
          name: 'Main Rosette',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: {
            ...getDefaultParams(),
            family: 'hypo',
            symmetry: 12,
            R: 320,
            r: 85,
            d: 160,
            m: 0.15,
            mf: 12,
            lw: 0.5,
          },
        },
      ],
    },
    {
      name: 'The Border/Band',
      description: 'Continuous linear repeating band for certificates and currency edges.',
      icon: '▬',
      layers: [
        {
          id: generateId(),
          name: 'Primary Band',
          type: 'vector',
          visible: true,
          color: '#166534',
          blendMode: 'normal',
          opacity: 1,
          params: {
            ...getDefaultParams(),
            mode: 'border',
            family: 'epi',
            R: 240,
            r: 60,
            d: 100,
            m: 0.3,
            mf: 6,
            lw: 0.4,
          },
        },
      ],
    },
    {
      name: 'The Background',
      description: 'Ultra-fine tiled security grid for high-resolution document protection.',
      icon: '▦',
      layers: [
        {
          id: generateId(),
          name: 'Security Tiling',
          type: 'vector',
          visible: true,
          color: '#ef4444',
          blendMode: 'screen',
          opacity: 0.15,
          params: {
            ...getDefaultParams(),
            mode: 'grid',
            family: 'hypo',
            R: 120,
            r: 35,
            d: 40,
            lw: 0.2,
          },
        },
      ],
    },
    {
      name: 'The Volute',
      description: 'Complex spiral scroll-work with interlocking geometric harmonics.',
      icon: '🌀',
      layers: [
        {
          id: generateId(),
          name: 'Spiral Volute',
          type: 'vector',
          visible: true,
          color: '#1e293b',
          blendMode: 'normal',
          opacity: 1,
          params: {
            ...getDefaultParams(),
            family: 'spiral',
            k: 20,
            R: 50,
            r: 10,
            lw: 0.4,
            m: 0.1,
            mf: 15,
          },
        },
      ],
    },
    {
      name: 'The Relief Effect',
      description: '3D numismatic effect achieved through precision line displacement.',
      icon: '📀',
      layers: [
        {
          id: generateId(),
          name: 'Relief Base',
          type: 'vector',
          visible: true,
          color: '#4b5563',
          blendMode: 'normal',
          opacity: 1,
          params: {
            ...getDefaultParams(),
            family: 'hypo',
            R: 200,
            r: 195,
            d: 5,
            m: 0.8,
            mf: 40,
            lw: 0.3,
          },
        },
      ],
    },
    {
      name: 'The Microtext Line',
      description: 'Integrated security text following complex parametric paths.',
      icon: '🔤',
      layers: [
        {
          id: generateId(),
          name: 'Text Carrier',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: {
            ...getDefaultParams(),
            text: {
              content: 'GUILLOCHE STUDIO PRO SECURITY',
              fontSize: 4,
              followPath: true,
              repeat: true,
            },
            lw: 0.1,
          },
        },
      ],
    },
    {
      name: 'The Latent Image',
      description: 'Hidden imagery revealed through angle-dependent line frequency.',
      icon: '👁️',
      layers: [
        {
          id: generateId(),
          name: 'Phase Shift A',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), family: 'hypo', R: 300, r: 100, phase: 0, lw: 0.3 },
        },
        {
          id: generateId(),
          name: 'Phase Shift B',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), family: 'hypo', R: 300, r: 100, phase: 0.5, lw: 0.3 },
        },
      ],
    },
    {
      name: 'The Anti-Copy',
      description: 'Pantograph structures designed to reveal hidden text when scanned.',
      icon: '🚫',
      layers: [
        {
          id: generateId(),
          name: 'Screen Tint',
          type: 'vector',
          visible: true,
          color: '#9ca3af',
          blendMode: 'normal',
          opacity: 0.5,
          params: { ...getDefaultParams(), mode: 'grid', R: 10, r: 2, lw: 0.15 },
        },
      ],
    },
    {
      name: 'The Moire',
      description: 'Intentional interference patterns for manual verification.',
      icon: '🏁',
      layers: [
        {
          id: generateId(),
          name: 'Grid A',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), mode: 'grid', rot: 0, lw: 0.2 },
        },
        {
          id: generateId(),
          name: 'Grid B',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'multiply',
          opacity: 1,
          params: { ...getDefaultParams(), mode: 'grid', rot: 2, lw: 0.2 },
        },
      ],
    },
    {
      name: 'The Split-Duct',
      description: 'Professional iris/rainbow transitions across multiple ink channels.',
      icon: '🌈',
      layers: [
        {
          id: generateId(),
          name: 'Cyan Duct',
          type: 'vector',
          visible: true,
          color: '#06b6d4',
          blendMode: 'screen',
          opacity: 0.8,
          params: { ...getDefaultParams(), rot: 0 },
        },
        {
          id: generateId(),
          name: 'Magenta Duct',
          type: 'vector',
          visible: true,
          color: '#ec4899',
          blendMode: 'screen',
          opacity: 0.8,
          params: { ...getDefaultParams(), rot: 5 },
        },
      ],
    },
    {
      name: 'The Prismatic',
      description: 'Faceted, multi-colored line structures with prismatic depth.',
      icon: '💎',
      layers: [
        {
          id: generateId(),
          name: 'Facet A',
          type: 'vector',
          visible: true,
          color: '#3b82f6',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), s: 1.0 },
        },
        {
          id: generateId(),
          name: 'Facet B',
          type: 'vector',
          visible: true,
          color: '#60a5fa',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), s: 0.98 },
        },
      ],
    },
    {
      name: 'The Asymmetric Key',
      description: 'Non-linear, unique identification patterns for individual tracking.',
      icon: '🔑',
      layers: [
        {
          id: generateId(),
          name: 'Asymmetric Seed',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), family: 'liss', k: 7, mf: 13, phase: 1.2 },
        },
      ],
    },
    {
      name: 'The Modulation Field',
      description: 'Complex fields where geometry reacts to underlying data fields.',
      icon: '📡',
      layers: [
        {
          id: generateId(),
          name: 'Variable Field',
          type: 'vector',
          visible: true,
          color: '#000000',
          blendMode: 'normal',
          opacity: 1,
          params: { ...getDefaultParams(), m: 0.5, mf: 25, lw: 0.2 },
        },
      ],
    },
  ];

  function applyTemplate(t: any) {
    importComposition({ layers: t.layers, params: getDefaultParams() });
    dispatch('close');
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<div
  class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
  role="presentation"
  on:click|self={() => dispatch('close')}
  on:keydown|self={(e) => e.key === 'Escape' && dispatch('close')}
>
  <div
    class="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden p-12 relative flex flex-col"
  >
    <button
      class="absolute top-8 right-8 text-2xl text-gray-300 hover:text-black"
      on:click={() => dispatch('close')}>×</button
    >

    <div class="mb-10">
      <h2 class="text-3xl font-sohne-halbfett font-bold text-gray-900 mb-2">Initialize Design</h2>
      <p class="text-gray-400 font-light text-sm">
        Select a foundational template for your security composition.
      </p>
    </div>

    <div
      class="flex-1 overflow-y-auto pr-4 scrollbar-hide grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {#each templates as t}
        <button
          on:click={() => applyTemplate(t)}
          class="p-8 bg-gray-50/50 border border-gray-100 rounded-[2.5rem] text-left hover:bg-white hover:border-blue-400 hover:shadow-xl transition-all group"
        >
          <div class="text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all">{t.icon}</div>
          <h3 class="text-lg font-sohne-halbfett font-bold text-gray-900 mb-2 leading-tight">
            {t.name}
          </h3>
          <p class="text-[10px] text-gray-400 font-light leading-relaxed">{t.description}</p>
        </button>
      {/each}

      <button
        on:click={() => {
          importComposition({ layers: [], params: getDefaultParams() });
          addLayer();
          dispatch('close');
        }}
        class="p-8 bg-white border border-gray-100 rounded-[2.5rem] text-left hover:border-gray-300 hover:shadow-xl transition-all flex items-center justify-center"
      >
        <div class="text-center">
          <div class="text-2xl mb-2 text-gray-300">+</div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Empty Canvas
          </div>
        </div>
      </button>
    </div>
  </div>
</div>

<style>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
