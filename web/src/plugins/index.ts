/**
 * Plugin Registration
 * Registers all available input/output plugins
 */

import { pluginRegistry } from '@/lib/plugin-system';
import { MidiInputPlugin } from './input-midi';
import { MidiOutputPlugin } from './output-midi';
import { SoundationInputPlugin } from './input-soundation';
import { SoundationOutputPlugin } from './output-soundation';
import { DawProjectInputPlugin } from './input-dawproject';
import { DawProjectOutputPlugin } from './output-dawproject';
import {
  FLStudioInputStub,
  FLStudioOutputStub,
  LMMSInputStub,
  LMMSOutputStub,
  AbletonInputStub,
  AbletonOutputStub,
  ReaperInputStub,
  ReaperOutputStub,
  OnlineSeqInputStub,
  OnlineSeqOutputStub,
  BeepboxInputStub,
  WaveformOutputStub,
  AmpedStudioOutputStub,
} from './stub-plugins';

export function registerPlugins(): void {
  // ========== Fully Implemented Plugins ==========

  // MIDI
  pluginRegistry.registerInput('midi', new MidiInputPlugin());
  pluginRegistry.registerOutput('midi', new MidiOutputPlugin());

  // Soundation
  pluginRegistry.registerInput('soundation', new SoundationInputPlugin());
  pluginRegistry.registerOutput('soundation', new SoundationOutputPlugin());

  // DawProject
  pluginRegistry.registerInput('dawproject', new DawProjectInputPlugin());
  pluginRegistry.registerOutput('dawproject', new DawProjectOutputPlugin());

  // ========== Stub Plugins (Not Yet Implemented) ==========
  // These are registered but will show an error when used
  // They serve as placeholders for future implementation

  // FL Studio
  pluginRegistry.registerInput('flp', FLStudioInputStub);
  pluginRegistry.registerOutput('flp', FLStudioOutputStub);

  // LMMS
  pluginRegistry.registerInput('lmms', LMMSInputStub);
  pluginRegistry.registerOutput('lmms', LMMSOutputStub);

  // Ableton Live
  pluginRegistry.registerInput('ableton', AbletonInputStub);
  pluginRegistry.registerOutput('ableton', AbletonOutputStub);

  // Reaper
  pluginRegistry.registerInput('reaper', ReaperInputStub);
  pluginRegistry.registerOutput('reaper', ReaperOutputStub);

  // Online Sequencer
  pluginRegistry.registerInput('onlineseq', OnlineSeqInputStub);
  pluginRegistry.registerOutput('onlineseq', OnlineSeqOutputStub);

  // Beepbox/Jummbox
  pluginRegistry.registerInput('beepbox', BeepboxInputStub);

  // Waveform
  pluginRegistry.registerOutput('waveform', WaveformOutputStub);

  // Amped Studio
  pluginRegistry.registerOutput('amped', AmpedStudioOutputStub);

  // Log registered plugins
  const inputPlugins = pluginRegistry.getInputPluginsList();
  const outputPlugins = pluginRegistry.getOutputPluginsList();

  console.log('Registered plugins:');
  console.log(`  Input (${inputPlugins.length}):`, inputPlugins.map(p => p.shortname).join(', '));
  console.log(`  Output (${outputPlugins.length}):`, outputPlugins.map(p => p.shortname).join(', '));

  // Log implemented vs stub plugins
  const implementedInput = inputPlugins.filter(p =>
    pluginRegistry.getInputPlugin(p.shortname)?.isUsable().usable
  );
  const implementedOutput = outputPlugins.filter(p =>
    pluginRegistry.getOutputPlugin(p.shortname)?.isUsable().usable
  );

  console.log(`  Implemented: ${implementedInput.length} input, ${implementedOutput.length} output`);
  console.log(`  Stubs: ${inputPlugins.length - implementedInput.length} input, ${outputPlugins.length - implementedOutput.length} output`);
}
