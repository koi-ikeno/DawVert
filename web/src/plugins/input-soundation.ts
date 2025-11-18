/**
 * Soundation Input Plugin
 *
 * Parses Soundation project files (.sng, .sngz)
 * Format: JSON or ZIP-compressed JSON
 */

import type { InputPlugin, PluginInfo } from '../lib/plugin-system';
import type { CVPJProject, ConversionConfig, Track, Note } from '../types/cvpj';
import { readFileAsText, readFileAsJSON } from '../lib/utils';
import { extractFileFromZip, listZipFiles, supportsDecompression } from '../lib/zip-utils';

// Soundation Types
interface SoundationParam {
  value: number;
  automation?: Array<{ pos: number; value: number }>;
}

interface SoundationDevice {
  identifier: string;
  bypass?: boolean;
  rackName?: string;
  [key: string]: any; // params and data
}

interface SoundationNote {
  position: number;
  length: number;
  note: number;
  velocity: number;
}

interface SoundationRegion {
  position: number;
  length: number;
  loopcount?: number;
  contentPosition: number;
  muted: boolean;
  name: string;
  notes?: SoundationNote[];
  file?: { url: string };
  reversed?: boolean;
  stretchMode?: number;
  autoStretchBpm?: number;
  type?: number;
  color?: string;
}

interface SoundationChannel {
  name: string;
  type: string; // 'master', 'instrument', 'effect', 'audio'
  mute: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  color?: string;
  userSetName?: string;
  volumeAutomation: Array<{ pos: number; value: number }>;
  panAutomation: Array<{ pos: number; value: number }>;
  effects: SoundationDevice[];
  regions: SoundationRegion[];
  instrument?: SoundationDevice;
}

interface SoundationProject {
  version: number;
  studio: string;
  bpm: number;
  timeSignature: string;
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  channels: SoundationChannel[];
}

export class SoundationInputPlugin implements InputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'Soundation',
      shortname: 'soundation',
      file_ext: ['sng', 'sngz'],
      projtype: 'r',
      supported_autodetect: false,
    };
  }

  async detect(file: File): Promise<boolean> {
    // Soundation files can be .sng (plain JSON) or .sngz (ZIP)
    // For now, rely on file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'sng' || ext === 'sngz';
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    let soundationData: SoundationProject;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'sngz') {
      // ZIP compressed - extract .sng file
      if (!supportsDecompression()) {
        throw new Error('Your browser does not support ZIP decompression. Please use a modern browser or extract the .sng file manually.');
      }

      // List files in ZIP to find .sng file
      const files = await listZipFiles(file);
      const sngFile = files.find(f => f.endsWith('.sng'));

      if (!sngFile) {
        throw new Error('No .sng file found in the ZIP archive');
      }

      // Extract the .sng file
      const sngData = await extractFileFromZip(file, sngFile);
      if (!sngData) {
        throw new Error('Failed to extract .sng file from ZIP');
      }

      // Parse JSON from extracted data
      const jsonText = new TextDecoder().decode(sngData);
      soundationData = JSON.parse(jsonText) as SoundationProject;
    } else {
      // Plain JSON
      soundationData = await readFileAsJSON(file) as SoundationProject;
    }

    // Create CVPJ project
    const project: CVPJProject = {
      type: 'r',
      time_ppq: 22050 * (120 / soundationData.bpm), // Soundation's timing
      time_float: false,
      track_data: {},
      track_order: [],
      plugins: {},
      timesig: this.parseTimeSignature(soundationData.timeSignature),
      metadata: {},
      loop_active: soundationData.looping,
      loop_start: soundationData.loopStart,
      loop_end: soundationData.loopEnd,
    };

    // Set BPM
    project.metadata.bpm = soundationData.bpm;

    // Process channels
    let trackNum = 0;
    for (const channel of soundationData.channels) {
      trackNum++;
      const trackId = `soundation${trackNum}`;

      if (channel.type === 'master') {
        // Master track
        project.track_master = {
          visual: {
            name: channel.name,
          },
          params: {
            vol: channel.volume,
            pan: (channel.pan - 0.5) * 2, // Convert 0-1 to -1 to 1
            enabled: !channel.mute,
            solo: channel.solo,
          },
          plugslots: {
            slots_audio: [],
          },
        };

        // TODO: Add automation and effects for master
      } else if (channel.type === 'instrument') {
        // Instrument track
        const track: Track = {
          type: 'instrument',
          visual: {
            name: channel.userSetName || channel.name,
            color: channel.color,
          },
          params: {
            vol: channel.volume,
            pan: (channel.pan - 0.5) * 2,
            enabled: !channel.mute,
            solo: channel.solo,
          },
          placements: {
            notes: [],
          },
          plugslots: {
            slots_audio: [],
          },
          notes: [],
        };

        // Process regions (MIDI clips)
        for (const region of channel.regions) {
          if (region.notes && region.notes.length > 0) {
            const clipLength = Math.round(region.length / project.time_ppq) * project.time_ppq;
            const clipLoopCount = Math.round(region.loopcount || 1);

            // Add notes to track
            for (const sndNote of region.notes) {
              const note: Note = {
                position: region.position + sndNote.position,
                duration: sndNote.length,
                key: sndNote.note - 60, // Convert to MIDI note offset
                velocity: sndNote.velocity,
              };
              track.notes!.push(note);
            }
          }
        }

        // Add instrument plugin if present
        if (channel.instrument) {
          const pluginId = trackId + '_inst';
          project.plugins![pluginId] = this.parseInstrument(channel.instrument);
          track.plugslots.synth = pluginId;
        }

        // Add effects
        for (let fxIdx = 0; fxIdx < channel.effects.length; fxIdx++) {
          const effect = channel.effects[fxIdx];
          const fxId = `${trackId}_fx${fxIdx}`;
          project.plugins![fxId] = this.parseEffect(effect);
          track.plugslots.slots_audio.push(fxId);
        }

        project.track_data[trackId] = track;
        project.track_order.push(trackId);

      } else if (channel.type === 'audio') {
        // Audio track (sample-based)
        const track: Track = {
          type: 'audio',
          visual: {
            name: channel.userSetName || channel.name,
            color: channel.color,
          },
          params: {
            vol: channel.volume,
            pan: (channel.pan - 0.5) * 2,
            enabled: !channel.mute,
            solo: channel.solo,
          },
          placements: {
            audio: [],
          },
          plugslots: {
            slots_audio: [],
          },
        };

        // Process regions (audio clips)
        for (const region of channel.regions) {
          if (region.file && region.file.url) {
            // Audio placement
            const audioPlacement = {
              position: region.position,
              duration: region.length * (region.loopcount || 1),
              sample: {
                sampleref: region.file.url,
                reverse: region.reversed || false,
                stretch: {
                  preserve_pitch: region.stretchMode === 3,
                  algorithm: region.stretchMode === 3 ? 'stretch' : undefined,
                },
              },
            };

            track.placements.audio!.push(audioPlacement);
          }
        }

        project.track_data[trackId] = track;
        project.track_order.push(trackId);
      }
    }

    return project;
  }

  private parseTimeSignature(timeSig: string): [number, number] {
    const parts = timeSig.split('/');
    if (parts.length === 2) {
      return [parseInt(parts[0]), parseInt(parts[1])];
    }
    return [4, 4]; // Default
  }

  private parseInstrument(device: SoundationDevice): any {
    // Create a basic plugin representation
    const plugin: any = {
      plugin_category: 'native',
      plugin_type: 'soundation',
      plugin_subtype: device.identifier,
      name: device.rackName || device.identifier,
      enabled: !device.bypass,
      params: {},
    };

    // Extract parameters
    for (const [key, value] of Object.entries(device)) {
      if (key !== 'identifier' && key !== 'bypass' && key !== 'rackName') {
        if (typeof value === 'object' && value !== null && 'value' in value) {
          plugin.params[key] = (value as SoundationParam).value;
        }
      }
    }

    return plugin;
  }

  private parseEffect(device: SoundationDevice): any {
    return this.parseInstrument(device); // Same structure
  }

  isUsable(): { usable: boolean; message: string } {
    if (supportsDecompression()) {
      return {
        usable: true,
        message: 'Soundation .sng and .sngz files supported',
      };
    } else {
      return {
        usable: true,
        message: 'Soundation .sng files supported. .sngz requires a modern browser with DecompressionStream support.',
      };
    }
  }
}
