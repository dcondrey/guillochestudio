<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    MACHINE_PROFILES,
    LASER_MATERIAL_PRESETS,
    CNC_TOOLS,
    generateCNCGCode,
    generateLaserGCode,
    generateDXF,
    estimateJobTime,
    downloadGCode,
    downloadDXF,
    type CNCSettings,
    type LaserSettings,
    type DXFOptions,
  } from '$lib/services/cnc';
  import { patternToPathSegments, type PathSegment } from '$lib/services/plotter';

  export let svgContent: string;
  export let width: number = 400;
  export let height: number = 400;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let activeTab: 'cnc' | 'laser' | 'dxf' = 'laser';
  let selectedMachineId = 'ortur-lm2';
  let paths: PathSegment[] = [];
  let gcode = '';
  let dxfContent = '';
  let jobEstimate: ReturnType<typeof estimateJobTime> | null = null;

  // CNC Settings
  let cncSettings: Partial<CNCSettings> = {
    operation: 'engrave',
    feedRate: 1000,
    plungeRate: 300,
    spindleSpeed: 12000,
    passes: 1,
    depthPerPass: 1,
    coolant: false,
  };

  // Laser Settings
  let laserSettings: Partial<LaserSettings> = {
    mode: 'cut',
    power: 80,
    speed: 400,
    passes: 1,
    airAssist: true,
  };

  // DXF Options
  let dxfOptions: DXFOptions = {
    units: 'mm',
    version: '2000',
    layerByColor: true,
    precision: 4,
  };

  let selectedMaterialPreset = '';
  let selectedTool = 'endmill-3mm';

  $: selectedMachine =
    MACHINE_PROFILES.find((m) => m.id === selectedMachineId) ?? MACHINE_PROFILES[0];
  $: isLaser = selectedMachine.type === 'laser';
  $: isCNC = selectedMachine.type === 'cnc';

  $: {
    // Parse paths when SVG changes
    const scale = Math.min(
      selectedMachine.workArea.width / width,
      selectedMachine.workArea.height / height
    );
    paths = patternToPathSegments(svgContent, scale);
  }

  $: {
    // Generate output when settings change
    generateOutput();
  }

  // Type-safe mode setters
  function setLaserMode(mode: 'cut' | 'engrave' | 'score'): void {
    laserSettings.mode = mode;
    laserSettings = laserSettings;
  }

  function setCNCOperation(op: 'cut' | 'engrave' | 'score' | 'drill'): void {
    cncSettings.operation = op;
    cncSettings = cncSettings;
  }

  function generateOutput(): void {
    if (paths.length === 0) return;

    const fullSettings = isLaser
      ? ({ machine: selectedMachine, ...laserSettings } as LaserSettings)
      : ({ machine: selectedMachine, ...cncSettings } as CNCSettings);

    if (activeTab === 'cnc' && isCNC) {
      gcode = generateCNCGCode(paths, fullSettings as CNCSettings);
      jobEstimate = estimateJobTime(
        paths,
        cncSettings.feedRate ?? 1000,
        selectedMachine.rapidFeedRate
      );
    } else if (activeTab === 'laser' && isLaser) {
      gcode = generateLaserGCode(paths, fullSettings as LaserSettings);
      jobEstimate = estimateJobTime(
        paths,
        laserSettings.speed ?? 1000,
        selectedMachine.rapidFeedRate
      );
    } else if (activeTab === 'dxf') {
      dxfContent = generateDXF(paths, dxfOptions);
      jobEstimate = null;
    }
  }

  function applyMaterialPreset(presetId: string): void {
    const preset = LASER_MATERIAL_PRESETS[presetId];
    if (preset) {
      laserSettings.power = preset.power;
      laserSettings.speed = preset.speed;
      laserSettings.passes = preset.passes;
      laserSettings = laserSettings;
    }
  }

  function handleDownload(): void {
    if (activeTab === 'dxf') {
      downloadDXF(dxfContent, 'guilloche-pattern');
    } else {
      downloadGCode(gcode, `guilloche-${selectedMachine.type}`);
    }
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) {
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m`;
  }
</script>

<div class="cnc-panel bg-gray-900 rounded-lg overflow-hidden flex flex-col h-full">
  <!-- Header -->
  <div
    class="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0"
  >
    <h2 class="text-white font-semibold flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      CNC / Laser Export
    </h2>
    <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-white">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Settings Panel -->
    <div class="w-80 border-r border-gray-700 flex flex-col overflow-hidden">
      <!-- Format Tabs -->
      <div class="flex border-b border-gray-700 shrink-0">
        <button
          class="flex-1 px-3 py-2 text-sm font-medium transition-colors"
          class:text-indigo-400={activeTab === 'laser'}
          class:bg-gray-800={activeTab === 'laser'}
          class:text-gray-400={activeTab !== 'laser'}
          on:click={() => (activeTab = 'laser')}
        >
          Laser
        </button>
        <button
          class="flex-1 px-3 py-2 text-sm font-medium transition-colors"
          class:text-indigo-400={activeTab === 'cnc'}
          class:bg-gray-800={activeTab === 'cnc'}
          class:text-gray-400={activeTab !== 'cnc'}
          on:click={() => (activeTab = 'cnc')}
        >
          CNC
        </button>
        <button
          class="flex-1 px-3 py-2 text-sm font-medium transition-colors"
          class:text-indigo-400={activeTab === 'dxf'}
          class:bg-gray-800={activeTab === 'dxf'}
          class:text-gray-400={activeTab !== 'dxf'}
          on:click={() => (activeTab = 'dxf')}
        >
          DXF
        </button>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Machine Selection -->
        <div class="space-y-2">
          <label for="cnc-machine" class="block text-sm font-medium text-gray-300">Machine</label>
          <select
            id="cnc-machine"
            bind:value={selectedMachineId}
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          >
            {#if activeTab === 'laser'}
              <optgroup label="Laser Cutters">
                {#each MACHINE_PROFILES.filter((m) => m.type === 'laser') as machine}
                  <option value={machine.id}>{machine.name}</option>
                {/each}
              </optgroup>
            {:else if activeTab === 'cnc'}
              <optgroup label="CNC Machines">
                {#each MACHINE_PROFILES.filter((m) => m.type === 'cnc') as machine}
                  <option value={machine.id}>{machine.name}</option>
                {/each}
              </optgroup>
            {/if}
          </select>
          <p class="text-xs text-gray-500">
            Work area: {selectedMachine.workArea.width} × {selectedMachine.workArea.height}mm
          </p>
        </div>

        {#if activeTab === 'laser'}
          <!-- Laser Settings -->
          <div class="space-y-3">
            <label for="cnc-material-preset" class="block text-sm font-medium text-gray-300"
              >Material Preset</label
            >
            <select
              id="cnc-material-preset"
              bind:value={selectedMaterialPreset}
              on:change={() => applyMaterialPreset(selectedMaterialPreset)}
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Custom</option>
              {#each Object.entries(LASER_MATERIAL_PRESETS) as [id, _]}
                <option value={id}>{id.replace(/-/g, ' ')}</option>
              {/each}
            </select>
          </div>

          <div role="group" aria-labelledby="laser-mode-label" class="space-y-3">
            <span id="laser-mode-label" class="block text-sm font-medium text-gray-300">Mode</span>
            <div class="grid grid-cols-3 gap-2">
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={laserSettings.mode === 'cut'}
                class:text-white={laserSettings.mode === 'cut'}
                class:bg-gray-700={laserSettings.mode !== 'cut'}
                class:text-gray-300={laserSettings.mode !== 'cut'}
                on:click={() => setLaserMode('cut')}
              >
                cut
              </button>
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={laserSettings.mode === 'engrave'}
                class:text-white={laserSettings.mode === 'engrave'}
                class:bg-gray-700={laserSettings.mode !== 'engrave'}
                class:text-gray-300={laserSettings.mode !== 'engrave'}
                on:click={() => setLaserMode('engrave')}
              >
                engrave
              </button>
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={laserSettings.mode === 'score'}
                class:text-white={laserSettings.mode === 'score'}
                class:bg-gray-700={laserSettings.mode !== 'score'}
                class:text-gray-300={laserSettings.mode !== 'score'}
                on:click={() => setLaserMode('score')}
              >
                score
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between">
              <label for="laser-power" class="text-sm font-medium text-gray-300">Power</label>
              <span class="text-sm text-indigo-400">{laserSettings.power}%</span>
            </div>
            <input
              id="laser-power"
              type="range"
              bind:value={laserSettings.power}
              min="1"
              max="100"
              class="w-full"
            />
          </div>

          <div class="space-y-2">
            <div class="flex justify-between">
              <label for="laser-speed" class="text-sm font-medium text-gray-300">Speed</label>
              <span class="text-sm text-indigo-400">{laserSettings.speed} mm/min</span>
            </div>
            <input
              id="laser-speed"
              type="range"
              bind:value={laserSettings.speed}
              min="100"
              max={selectedMachine.maxFeedRate}
              step="50"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="laser-passes" class="text-xs text-gray-500">Passes</label>
              <input
                id="laser-passes"
                type="number"
                bind:value={laserSettings.passes}
                min="1"
                max="10"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              bind:checked={laserSettings.airAssist}
              class="rounded bg-gray-700 border-gray-600 text-indigo-600"
            />
            Air assist
          </label>
        {:else if activeTab === 'cnc'}
          <!-- CNC Settings -->
          <div class="space-y-3">
            <label for="cnc-tool" class="block text-sm font-medium text-gray-300">Tool</label>
            <select
              id="cnc-tool"
              bind:value={selectedTool}
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              {#each Object.entries(CNC_TOOLS) as [id, tool]}
                <option value={id}>{tool.description}</option>
              {/each}
            </select>
          </div>

          <div role="group" aria-labelledby="cnc-operation-label" class="space-y-3">
            <span id="cnc-operation-label" class="block text-sm font-medium text-gray-300"
              >Operation</span
            >
            <div class="grid grid-cols-2 gap-2">
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={cncSettings.operation === 'cut'}
                class:text-white={cncSettings.operation === 'cut'}
                class:bg-gray-700={cncSettings.operation !== 'cut'}
                class:text-gray-300={cncSettings.operation !== 'cut'}
                on:click={() => setCNCOperation('cut')}
              >
                cut
              </button>
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={cncSettings.operation === 'engrave'}
                class:text-white={cncSettings.operation === 'engrave'}
                class:bg-gray-700={cncSettings.operation !== 'engrave'}
                class:text-gray-300={cncSettings.operation !== 'engrave'}
                on:click={() => setCNCOperation('engrave')}
              >
                engrave
              </button>
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={cncSettings.operation === 'score'}
                class:text-white={cncSettings.operation === 'score'}
                class:bg-gray-700={cncSettings.operation !== 'score'}
                class:text-gray-300={cncSettings.operation !== 'score'}
                on:click={() => setCNCOperation('score')}
              >
                score
              </button>
              <button
                class="px-3 py-2 text-sm rounded capitalize transition-colors"
                class:bg-indigo-600={cncSettings.operation === 'drill'}
                class:text-white={cncSettings.operation === 'drill'}
                class:bg-gray-700={cncSettings.operation !== 'drill'}
                class:text-gray-300={cncSettings.operation !== 'drill'}
                on:click={() => setCNCOperation('drill')}
              >
                drill
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="cnc-feed-rate" class="text-xs text-gray-500">Feed Rate (mm/min)</label>
              <input
                id="cnc-feed-rate"
                type="number"
                bind:value={cncSettings.feedRate}
                min="100"
                max={selectedMachine.maxFeedRate}
                step="100"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label for="cnc-plunge-rate" class="text-xs text-gray-500">Plunge Rate (mm/min)</label
              >
              <input
                id="cnc-plunge-rate"
                type="number"
                bind:value={cncSettings.plungeRate}
                min="50"
                max="1000"
                step="50"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="cnc-spindle-speed" class="text-xs text-gray-500"
                >Spindle Speed (RPM)</label
              >
              <input
                id="cnc-spindle-speed"
                type="number"
                bind:value={cncSettings.spindleSpeed}
                min="1000"
                max={selectedMachine.maxSpindleSpeed}
                step="1000"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label for="cnc-passes" class="text-xs text-gray-500">Passes</label>
              <input
                id="cnc-passes"
                type="number"
                bind:value={cncSettings.passes}
                min="1"
                max="20"
                class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label for="cnc-depth-per-pass" class="text-xs text-gray-500">Depth per Pass (mm)</label
            >
            <input
              id="cnc-depth-per-pass"
              type="number"
              bind:value={cncSettings.depthPerPass}
              min="0.1"
              max="10"
              step="0.1"
              class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>

          <label class="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              bind:checked={cncSettings.coolant}
              class="rounded bg-gray-700 border-gray-600 text-indigo-600"
            />
            Enable coolant
          </label>
        {:else if activeTab === 'dxf'}
          <!-- DXF Options -->
          <div role="group" aria-labelledby="dxf-units-label" class="space-y-3">
            <span id="dxf-units-label" class="block text-sm font-medium text-gray-300">Units</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                class="px-3 py-2 text-sm rounded transition-colors"
                class:bg-indigo-600={dxfOptions.units === 'mm'}
                class:text-white={dxfOptions.units === 'mm'}
                class:bg-gray-700={dxfOptions.units !== 'mm'}
                class:text-gray-300={dxfOptions.units !== 'mm'}
                on:click={() => {
                  dxfOptions.units = 'mm';
                  dxfOptions = dxfOptions;
                }}
              >
                Millimeters
              </button>
              <button
                class="px-3 py-2 text-sm rounded transition-colors"
                class:bg-indigo-600={dxfOptions.units === 'inch'}
                class:text-white={dxfOptions.units === 'inch'}
                class:bg-gray-700={dxfOptions.units !== 'inch'}
                class:text-gray-300={dxfOptions.units !== 'inch'}
                on:click={() => {
                  dxfOptions.units = 'inch';
                  dxfOptions = dxfOptions;
                }}
              >
                Inches
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label for="dxf-version" class="block text-sm font-medium text-gray-300"
              >DXF Version</label
            >
            <select
              id="dxf-version"
              bind:value={dxfOptions.version}
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="R12">R12 (Maximum Compatibility)</option>
              <option value="R14">R14</option>
              <option value="2000">AutoCAD 2000</option>
              <option value="2004">AutoCAD 2004</option>
              <option value="2007">AutoCAD 2007</option>
            </select>
          </div>

          <label class="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              bind:checked={dxfOptions.layerByColor}
              class="rounded bg-gray-700 border-gray-600 text-indigo-600"
            />
            Separate layers by color
          </label>

          <div>
            <label for="dxf-precision" class="text-xs text-gray-500">Decimal Precision</label>
            <input
              id="dxf-precision"
              type="number"
              bind:value={dxfOptions.precision}
              min="1"
              max="8"
              class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>
        {/if}

        <!-- Job Estimate -->
        {#if jobEstimate && activeTab !== 'dxf'}
          <div class="p-3 bg-gray-800 rounded-lg space-y-2">
            <h3 class="text-sm font-medium text-gray-300">Job Estimate</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p class="text-xs text-gray-500">Total Time</p>
                <p class="text-white font-medium">{formatTime(jobEstimate.totalTime)}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Path Length</p>
                <p class="text-white font-medium">{(jobEstimate.pathLength / 1000).toFixed(2)} m</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Cutting</p>
                <p class="text-gray-400">{formatTime(jobEstimate.cuttingTime)}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Rapids</p>
                <p class="text-gray-400">{formatTime(jobEstimate.rapidTime)}</p>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      <!-- Code Preview -->
      <div class="flex-1 overflow-auto p-4">
        <pre class="text-xs text-gray-300 font-mono whitespace-pre-wrap">{activeTab === 'dxf'
            ? dxfContent.slice(0, 5000)
            : gcode.slice(0, 5000)}{(activeTab === 'dxf' ? dxfContent : gcode).length > 5000
            ? '\n... (truncated)'
            : ''}</pre>
      </div>

      <!-- Actions -->
      <div
        class="px-4 py-3 bg-gray-900 border-t border-gray-700 flex items-center justify-between shrink-0"
      >
        <div class="text-sm text-gray-400">
          {paths.length} paths | {(activeTab === 'dxf'
            ? dxfContent
            : gcode
          ).length.toLocaleString()} characters
        </div>
        <div class="flex gap-2">
          <button
            on:click={() => navigator.clipboard.writeText(activeTab === 'dxf' ? dxfContent : gcode)}
            class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </button>
          <button
            on:click={handleDownload}
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download {activeTab === 'dxf' ? '.dxf' : '.gcode'}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .cnc-panel {
    width: 100%;
    height: 100%;
    min-height: 500px;
  }
</style>
