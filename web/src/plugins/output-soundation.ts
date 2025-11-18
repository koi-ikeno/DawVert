/**
 * Soundation Output Plugin
 *
 * Generates Soundation project files (.sng)
 * Format: JSON
 */

import type { OutputPlugin, PluginInfo } from '../lib/plugin-system';
import type { CVPJProject, ConversionConfig, Track } from '../types/cvpj';

// Soundation Types (same as input)
interface SoundationParam {
  value: number;
  automation?: Array<{ pos: number; value: number }>;
}

interface SoundationDevice {
  identifier: string;
  bypass?: boolean;
  rackName?: string;
  [key: string]: any;
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
  type: string;
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

export class SoundationOutputPlugin implements OutputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'Soundation',
      shortname: 'soundation',
      file_ext: ['sng'],
      projtype: 'r',
      supported_autodetect: false,
    };
  }

  getType(): 'r' | 'ri' | 'rm' | 'rs' | 'm' | 'mi' | 'ms' {
    return 'r';
  }

  async parse(project: CVPJProject, config: ConversionConfig): Promise<Blob> {
    const bpm = project.metadata?.bpm || 120;
    const timing = 22050 * (120 / bpm);

    const soundationProject: SoundationProject = {
      version: 2.3,
      studio: '3.10.7',
      bpm: bpm,
      timeSignature: `${project.timesig?.[0] || 4}/${project.timesig?.[1] || 4}`,
      looping: project.loop_active || false,
      loopStart: project.loop_start || 0,
      loopEnd: project.loop_end || 4102,
      channels: [],
    };

    // Add master channel
    if (project.track_master) {
      const masterChannel: SoundationChannel = {
        name: 'Master Channel',
        type: 'master',
        mute: !(project.track_master.params?.enabled !== false),
        solo: Boolean(project.track_master.params?.solo),
        volume: Number(project.track_master.params?.vol || 1),
        pan: this.cvpjPanToSoundation(Number(project.track_master.params?.pan || 0)),
        userSetName: project.track_master.visual?.name || 'Master Channel',
        volumeAutomation: [],
        panAutomation: [],
        effects: [],
        regions: [],
      };

      soundationProject.channels.push(masterChannel);
    }

    // Add tracks
    for (const trackId of project.track_order || []) {
      const track = project.track_data?.[trackId];
      if (!track) continue;

      if (track.type === 'instrument') {
        const channel = this.createInstrumentChannel(track, trackId, project, timing);
        soundationProject.channels.push(channel);
      } else if (track.type === 'audio') {
        const channel = this.createAudioChannel(track, trackId, project, timing);
        soundationProject.channels.push(channel);
      }
    }

    // Convert to JSON
    const jsonString = JSON.stringify(soundationProject, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  private createInstrumentChannel(
    track: Track,
    trackId: string,
    project: CVPJProject,
    timing: number
  ): SoundationChannel {
    const channel: SoundationChannel = {
      name: track.visual?.name || 'Instrument',
      type: 'instrument',
      mute: !(track.params?.enabled !== false),
      solo: Boolean(track.params?.solo),
      volume: Number(track.params?.vol || 1),
      pan: this.cvpjPanToSoundation(Number(track.params?.pan || 0)),
      userSetName: track.visual?.name,
      color: track.visual?.color,
      volumeAutomation: [],
      panAutomation: [],
      effects: [],
      regions: [],
    };

    // Convert CVPJ notes to Soundation format
    if (track.notes && track.notes.length > 0) {
      // Group notes into regions (for simplicity, one region for all notes)
      const notes: SoundationNote[] = track.notes.map(note => ({
        position: note.position,
        length: note.duration,
        note: note.key + 60, // Convert back to MIDI note number
        velocity: note.velocity || 1,
      }));

      // Find the extent of all notes
      const minPos = Math.min(...notes.map(n => n.position));
      const maxPos = Math.max(...notes.map(n => n.position + n.length));

      const region: SoundationRegion = {
        position: minPos,
        length: maxPos - minPos,
        contentPosition: 0,
        muted: false,
        name: 'Pattern',
        notes: notes.map(n => ({
          ...n,
          position: n.position - minPos, // Make relative to region
        })),
      };

      channel.regions.push(region);
    }

    // Add instrument
    if (track.plugslots?.synth && project.plugins) {
      const plugin = project.plugins[track.plugslots.synth];
      if (plugin) {
        channel.instrument = this.createDevice(plugin);
      }
    }

    // Add effects
    if (track.plugslots?.slots_audio && project.plugins) {
      for (const fxId of track.plugslots.slots_audio) {
        const plugin = project.plugins[fxId];
        if (plugin) {
          channel.effects.push(this.createDevice(plugin));
        }
      }
    }

    return channel;
  }

  private createAudioChannel(
    track: Track,
    trackId: string,
    project: CVPJProject,
    timing: number
  ): SoundationChannel {
    const channel: SoundationChannel = {
      name: track.visual?.name || 'Audio',
      type: 'audio',
      mute: !(track.params?.enabled !== false),
      solo: Boolean(track.params?.solo),
      volume: Number(track.params?.vol || 1),
      pan: this.cvpjPanToSoundation(Number(track.params?.pan || 0)),
      userSetName: track.visual?.name,
      color: track.visual?.color,
      volumeAutomation: [],
      panAutomation: [],
      effects: [],
      regions: [],
    };

    // Add audio regions
    if (track.placements?.audio) {
      for (const placement of track.placements.audio) {
        const region: SoundationRegion = {
          position: placement.position,
          length: placement.duration,
          contentPosition: 0,
          muted: false,
          name: 'Audio Clip',
          file: placement.sample?.sampleref ? { url: placement.sample.sampleref } : undefined,
          reversed: placement.sample?.reverse,
          stretchMode: placement.sample?.stretch?.preserve_pitch ? 3 : 0,
          loopcount: 1,
          type: 1,
        };

        channel.regions.push(region);
      }
    }

    return channel;
  }

  private createDevice(plugin: any): SoundationDevice {
    const device: SoundationDevice = {
      identifier: plugin.plugin_subtype || plugin.plugin_type || 'unknown',
      bypass: !plugin.enabled,
      rackName: plugin.name,
    };

    // Add parameters
    if (plugin.params) {
      for (const [key, value] of Object.entries(plugin.params)) {
        device[key] = {
          value: value,
          automation: [],
        };
      }
    }

    return device;
  }

  private cvpjPanToSoundation(pan: number): number {
    // CVPJ pan is -1 to 1, Soundation is 0 to 1
    return (pan / 2) + 0.5;
  }

  isUsable(): { usable: boolean; message: string } {
    return {
      usable: true,
      message: '',
    };
  }
}
