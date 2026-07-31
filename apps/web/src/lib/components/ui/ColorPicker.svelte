<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { hexToRgb, rgbToHex, rgbToCmyk, cmykToRgb } from '@guilloche/shared';

  export let color = '#000000';
  export let label = 'Color';

  const dispatch = createEventDispatcher();

  let rgb = { r: 0, g: 0, b: 0, a: 1 };
  let cmyk = { c: 0, m: 0, y: 0, k: 0 };
  let hexInput = color;

  $: {
    const res = hexToRgb(color);
    if (res) {
      rgb = res;
      cmyk = rgbToCmyk(res.r, res.g, res.b);
      hexInput = color;
    }
  }

  function handleHexInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(val)) {
      color = val;
      dispatch('change', color);
    }
  }

  function handleRgbInput() {
    color = rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a);
    dispatch('change', color);
  }

  function handleCmykInput() {
    const res = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    rgb = { ...res, a: rgb.a };
    color = rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a);
    dispatch('change', color);
  }
</script>

<div class="space-y-4 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
  <div class="flex items-center justify-between">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-sohne-halbfett"
      >{label}</span
    >
    <div
      class="w-8 h-8 rounded-full border-2 border-white shadow-sm"
      style="background-color: {color}"
    ></div>
  </div>

  <div class="grid grid-cols-1 gap-4">
    <!-- Hex -->
    <div>
      <label for="color-picker-hex" class="text-[8px] font-bold uppercase text-gray-400 block mb-1"
        >Hex</label
      >
      <div class="flex gap-2">
        <input
          id="color-picker-hex"
          type="color"
          bind:value={color}
          on:input={() => dispatch('change', color)}
          class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer"
        />
        <input
          type="text"
          bind:value={hexInput}
          on:input={handleHexInput}
          class="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-1.5 text-xs font-mono uppercase focus:ring-2 focus:ring-black/5 outline-none"
        />
      </div>
    </div>

    <!-- RGB -->
    <div class="grid grid-cols-4 gap-2">
      {#each [{ key: 'r', max: 255, step: 1 }, { key: 'g', max: 255, step: 1 }, { key: 'b', max: 255, step: 1 }, { key: 'a', max: 1, step: 0.01 }] as { key, max, step } (key)}
        <div>
          <label class="text-[8px] font-bold uppercase text-gray-400 block mb-1" for="rgb-{key}"
            >{key}</label
          >
          <input
            id="rgb-{key}"
            type="number"
            min="0"
            {max}
            {step}
            value={key === 'r' ? rgb.r : key === 'g' ? rgb.g : key === 'b' ? rgb.b : rgb.a}
            on:input={(e) => {
              rgb = { ...rgb, [key]: +e.currentTarget.value };
              handleRgbInput();
            }}
            class="w-full bg-white border border-gray-100 rounded-xl px-2 py-1.5 text-[10px] font-mono focus:ring-2 focus:ring-black/5 outline-none"
          />
        </div>
      {/each}
    </div>

    <!-- CMYK -->
    <div class="grid grid-cols-4 gap-2">
      {#each ['c', 'm', 'y', 'k'] as channel (channel)}
        <div>
          <label
            class="text-[8px] font-bold uppercase text-gray-400 block mb-1"
            for="cmyk-{channel}">{channel}</label
          >
          <input
            id="cmyk-{channel}"
            type="number"
            min="0"
            max="100"
            value={channel === 'c'
              ? cmyk.c
              : channel === 'm'
                ? cmyk.m
                : channel === 'y'
                  ? cmyk.y
                  : cmyk.k}
            on:input={(e) => {
              cmyk = { ...cmyk, [channel]: +e.currentTarget.value };
              handleCmykInput();
            }}
            class="w-full bg-white border border-gray-100 rounded-xl px-2 py-1.5 text-[10px] font-mono focus:ring-2 focus:ring-black/5 outline-none"
          />
        </div>
      {/each}
    </div>
  </div>
</div>
