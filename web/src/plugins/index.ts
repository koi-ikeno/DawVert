/**
 * Plugin Registration
 * Registers all available input/output plugins
 */

import { pluginRegistry } from '@/lib/plugin-system';
import { MidiInputPlugin } from './input-midi';
import { MidiOutputPlugin } from './output-midi';

export function registerPlugins(): void {
  // Register input plugins
  pluginRegistry.registerInput('midi', new MidiInputPlugin());

  // Register output plugins
  pluginRegistry.registerOutput('midi', new MidiOutputPlugin());

  console.log('Registered plugins:');
  console.log('  Input:', pluginRegistry.getInputPluginsList().map(p => p.shortname).join(', '));
  console.log('  Output:', pluginRegistry.getOutputPluginsList().map(p => p.shortname).join(', '));
}
