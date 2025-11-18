/**
 * Plugin Conversion System
 *
 * Converts plugin/instrument definitions between different DAW formats.
 * Supports:
 * - Universal plugins → DAW-specific plugins
 * - DAW-specific plugins → Universal plugins
 * - DAW-to-DAW plugin conversions
 */

import type { Plugin } from '../types/cvpj';

export interface PluginConversionContext {
  sourceDaw: string;
  targetDaw: string;
  sampleFolder?: string;
}

/**
 * Plugin Converter Registry
 */
class PluginConverterRegistry {
  private converters: Map<string, PluginConverter> = new Map();

  register(converter: PluginConverter): void {
    const key = this.makeKey(
      converter.sourcePlugin,
      converter.targetPlugin
    );
    this.converters.set(key, converter);
    console.log(`[PluginConv] Registered: ${key}`);
  }

  private makeKey(source: PluginType, target: PluginType): string {
    return `${source.category}:${source.type || '*'}:${source.subtype || '*'} -> ${target.category}:${target.type || '*'}:${target.subtype || '*'}`;
  }

  find(plugin: Plugin, targetDaw: string): PluginConverter | null {
    // Try exact match first
    for (const converter of this.converters.values()) {
      if (this.matchesPlugin(plugin, converter.sourcePlugin)) {
        if (converter.targetPlugin.category === 'native' &&
            converter.targetDaw === targetDaw) {
          return converter;
        }
        if (converter.targetPlugin.category === 'universal') {
          return converter;
        }
      }
    }
    return null;
  }

  private matchesPlugin(plugin: Plugin, type: PluginType): boolean {
    if (type.category !== '*' && plugin.plugin_category !== type.category) {
      return false;
    }
    if (type.type !== '*' && type.type && plugin.plugin_type !== type.type) {
      return false;
    }
    if (type.subtype !== '*' && type.subtype && plugin.plugin_subtype !== type.subtype) {
      return false;
    }
    return true;
  }
}

export interface PluginType {
  category: string; // 'universal', 'native', 'external', etc.
  type?: string;    // 'synth-osc', 'filter', 'eq', etc.
  subtype?: string; // Additional specifier
}

export interface PluginConverter {
  name: string;
  sourcePlugin: PluginType;
  targetPlugin: PluginType;
  targetDaw?: string;
  convert: (plugin: Plugin, context: PluginConversionContext) => Plugin | null;
}

// Global registry
const registry = new PluginConverterRegistry();

/**
 * Convert plugin to target DAW format
 */
export function convertPlugin(
  plugin: Plugin,
  targetDaw: string,
  context: PluginConversionContext
): Plugin {
  const converter = registry.find(plugin, targetDaw);

  if (converter) {
    console.log(`[PluginConv] Converting ${plugin.plugin_category}:${plugin.plugin_type} using ${converter.name}`);
    const result = converter.convert(plugin, context);
    if (result) return result;
  }

  // No conversion available, return original
  return plugin;
}

/**
 * Register a plugin converter
 */
export function registerPluginConverter(converter: PluginConverter): void {
  registry.register(converter);
}

// ============================================================================
// Built-in Converters
// ============================================================================

/**
 * Universal Synth-OSC → MIDI General MIDI
 *
 * Converts basic oscillator synths to General MIDI instruments.
 */
registerPluginConverter({
  name: 'Universal Synth-OSC → MIDI GM',
  sourcePlugin: { category: 'universal', type: 'synth-osc' },
  targetPlugin: { category: 'midi', type: 'gm' },
  targetDaw: 'midi',
  convert: (plugin, context) => {
    // Determine best GM instrument based on oscillator shape
    let gmInstrument = 0; // Acoustic Grand Piano (default)

    if (plugin.oscillators && plugin.oscillators.length > 0) {
      const osc = plugin.oscillators[0];
      const shape = osc.shape || 'sine';

      // Map oscillator shapes to GM instruments
      switch (shape) {
        case 'sine':
          gmInstrument = 80; // Lead 1 (square)
          break;
        case 'square':
          gmInstrument = 80; // Lead 1 (square)
          break;
        case 'saw':
          gmInstrument = 81; // Lead 2 (sawtooth)
          break;
        case 'triangle':
          gmInstrument = 72; // Piccolo
          break;
        case 'pulse':
          gmInstrument = 80; // Lead 1 (square)
          break;
        default:
          gmInstrument = 88; // Synth Pad 1
      }
    }

    return {
      ...plugin,
      plugin_category: 'midi',
      plugin_type: 'gm',
      plugin_subtype: undefined,
      params: {
        ...plugin.params,
        program: gmInstrument,
      },
    };
  },
});

/**
 * Universal Filter → Generic Filter
 *
 * Preserves filter settings in a generic format.
 */
registerPluginConverter({
  name: 'Universal Filter → Generic',
  sourcePlugin: { category: 'universal', type: 'filter' },
  targetPlugin: { category: 'universal', type: 'filter' },
  convert: (plugin, context) => {
    // Pass through - universal filters are already generic
    return plugin;
  },
});

/**
 * Universal EQ → Generic EQ
 *
 * Preserves EQ settings in a generic format.
 */
registerPluginConverter({
  name: 'Universal EQ → Generic',
  sourcePlugin: { category: 'universal', type: 'eq' },
  targetPlugin: { category: 'universal', type: 'eq' },
  convert: (plugin, context) => {
    // Pass through - universal EQs are already generic
    return plugin;
  },
});

/**
 * Universal Bitcrush → Generic
 *
 * Preserves bitcrush settings in a generic format.
 */
registerPluginConverter({
  name: 'Universal Bitcrush → Generic',
  sourcePlugin: { category: 'universal', type: 'bitcrush' },
  targetPlugin: { category: 'universal', type: 'bitcrush' },
  convert: (plugin, context) => {
    return plugin;
  },
});

/**
 * Universal Delay → Generic
 *
 * Preserves delay settings in a generic format.
 */
registerPluginConverter({
  name: 'Universal Delay → Generic',
  sourcePlugin: { category: 'universal', type: 'delay' },
  targetPlugin: { category: 'universal', type: 'delay' },
  convert: (plugin, context) => {
    return plugin;
  },
});

/**
 * Universal Reverb → Generic
 *
 * Preserves reverb settings in a generic format.
 */
registerPluginConverter({
  name: 'Universal Reverb → Generic',
  sourcePlugin: { category: 'universal', type: 'reverb' },
  targetPlugin: { category: 'universal', type: 'reverb' },
  convert: (plugin, context) => {
    return plugin;
  },
});

/**
 * MIDI GM → Universal Synth-OSC
 *
 * Converts General MIDI instruments to basic oscillator synths.
 */
registerPluginConverter({
  name: 'MIDI GM → Universal Synth-OSC',
  sourcePlugin: { category: 'midi', type: 'gm' },
  targetPlugin: { category: 'universal', type: 'synth-osc' },
  convert: (plugin, context) => {
    const program = plugin.params?.program || 0;

    // Determine oscillator shape based on GM program
    let shape: 'sine' | 'square' | 'saw' | 'triangle' | 'pulse' = 'sine';

    if (program >= 80 && program <= 87) {
      // Lead instruments → saw/square
      shape = program % 2 === 0 ? 'square' : 'saw';
    } else if (program >= 88 && program <= 95) {
      // Pad instruments → sine/triangle
      shape = program % 2 === 0 ? 'sine' : 'triangle';
    } else if (program >= 0 && program <= 7) {
      // Piano → triangle
      shape = 'triangle';
    } else if (program >= 24 && program <= 31) {
      // Guitar → saw
      shape = 'saw';
    } else if (program >= 32 && program <= 39) {
      // Bass → square
      shape = 'square';
    } else {
      // Default → sine
      shape = 'sine';
    }

    return {
      ...plugin,
      plugin_category: 'universal',
      plugin_type: 'synth-osc',
      plugin_subtype: undefined,
      oscillators: [
        {
          enabled: true,
          shape: shape,
          volume: 1.0,
          pitch: 0,
          pan: 0,
        },
      ],
    };
  },
});

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert all plugins in a project to target DAW format
 */
export function convertAllPlugins(
  plugins: Record<string, Plugin>,
  targetDaw: string,
  context: PluginConversionContext
): Record<string, Plugin> {
  const result: Record<string, Plugin> = {};

  for (const [id, plugin] of Object.entries(plugins)) {
    result[id] = convertPlugin(plugin, targetDaw, {
      ...context,
      targetDaw,
    });
  }

  return result;
}

/**
 * Check if plugin can be converted to target DAW
 */
export function canConvertPlugin(plugin: Plugin, targetDaw: string): boolean {
  return registry.find(plugin, targetDaw) !== null;
}

/**
 * Get list of available conversions for a plugin
 */
export function getAvailableConversions(plugin: Plugin): string[] {
  const conversions: string[] = [];

  // This would iterate through all registered converters
  // For now, return generic list
  conversions.push('midi');
  conversions.push('universal');

  return conversions;
}

// ============================================================================
// Export Registry for Custom Converters
// ============================================================================

export { registry as pluginConverterRegistry };
