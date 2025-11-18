/**
 * Stub plugins for future implementation
 * These are placeholder plugins that show the format is recognized but not yet implemented
 */

import type { InputPlugin, OutputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig, ProjectType } from '@/types/cvpj';

/**
 * Base class for stub input plugins
 */
export class StubInputPlugin implements InputPlugin {
  constructor(
    private name: string,
    private shortname: string,
    private fileExt: string[],
    private projtype: ProjectType = 'r'
  ) {}

  getInfo(): PluginInfo {
    return {
      name: this.name,
      shortname: this.shortname,
      file_ext: this.fileExt,
      file_ext_detect: true,
      projtype: this.projtype,
      supported_autodetect: false,
    };
  }

  async detect(file: File): Promise<boolean> {
    return false;
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    throw new Error(`${this.name} input plugin is not yet implemented`);
  }

  isUsable(): { usable: boolean; message: string } {
    return {
      usable: false,
      message: 'This plugin is not yet implemented',
    };
  }
}

/**
 * Base class for stub output plugins
 */
export class StubOutputPlugin implements OutputPlugin {
  constructor(
    private name: string,
    private shortname: string,
    private fileExt: string[],
    private projtype: ProjectType = 'r'
  ) {}

  getInfo(): PluginInfo {
    return {
      name: this.name,
      shortname: this.shortname,
      file_ext: this.fileExt,
      file_ext_detect: true,
      projtype: this.projtype,
    };
  }

  getType(): ProjectType {
    return this.projtype;
  }

  async parse(project: CVPJProject, config: ConversionConfig): Promise<Blob> {
    throw new Error(`${this.name} output plugin is not yet implemented`);
  }

  isUsable(): { usable: boolean; message: string } {
    return {
      usable: false,
      message: 'This plugin is not yet implemented',
    };
  }
}

// FL Studio
export const FLStudioInputStub = new StubInputPlugin('FL Studio', 'flp', ['flp'], 'mi');
export const FLStudioOutputStub = new StubOutputPlugin('FL Studio', 'flp', ['flp'], 'mi');

// LMMS
export const LMMSInputStub = new StubInputPlugin('LMMS', 'lmms', ['mmp', 'mmpz'], 'r');
export const LMMSOutputStub = new StubOutputPlugin('LMMS', 'lmms', ['mmp'], 'r');

// Ableton Live
export const AbletonInputStub = new StubInputPlugin('Ableton Live', 'ableton', ['als'], 'r');
export const AbletonOutputStub = new StubOutputPlugin('Ableton Live', 'ableton', ['als'], 'r');

// Reaper
export const ReaperInputStub = new StubInputPlugin('Reaper', 'reaper', ['rpp'], 'r');
export const ReaperOutputStub = new StubOutputPlugin('Reaper', 'reaper', ['rpp'], 'r');

// DawProject
export const DawProjectInputStub = new StubInputPlugin('DawProject', 'dawproject', ['dawproject'], 'r');
export const DawProjectOutputStub = new StubOutputPlugin('DawProject', 'dawproject', ['dawproject'], 'r');

// Online Sequencer
export const OnlineSeqInputStub = new StubInputPlugin('Online Sequencer', 'onlineseq', ['sequence'], 'r');
export const OnlineSeqOutputStub = new StubOutputPlugin('Online Sequencer', 'onlineseq', ['sequence'], 'r');

// Beepbox/Jummbox
export const BeepboxInputStub = new StubInputPlugin('Beepbox/Jummbox', 'beepbox', ['json'], 'r');

// Waveform
export const WaveformOutputStub = new StubOutputPlugin('Waveform', 'waveform', ['tracktionedit'], 'r');

// Amped Studio
export const AmpedStudioOutputStub = new StubOutputPlugin('Amped Studio', 'amped', ['ampedstudio'], 'r');

// Soundation
export const SoundationOutputStub = new StubOutputPlugin('Soundation', 'soundation', ['sng'], 'r');
