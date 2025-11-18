/**
 * MIDI Output Plugin
 * Generates MIDI files from CVPJ format
 */

import type { OutputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig, ProjectType } from '@/types/cvpj';

export class MidiOutputPlugin implements OutputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'MIDI',
      shortname: 'midi',
      file_ext: ['mid'],
      file_ext_detect: true,
      projtype: 'rm',
    };
  }

  isUsable(): { usable: boolean; message: string } {
    return { usable: true, message: '' };
  }

  getType(): ProjectType {
    return 'rm';
  }

  async parse(project: CVPJProject, config: ConversionConfig): Promise<Blob> {
    const tracks: Uint8Array[] = [];

    // Create tempo track (track 0)
    const tempoTrack = this.createTempoTrack(project);
    tracks.push(tempoTrack);

    // Convert CVPJ tracks to MIDI tracks
    for (const trackId of project.track_order) {
      const track = project.track_data[trackId];
      if (!track) continue;

      const midiTrack = this.convertTrackToMidi(track, project);
      if (midiTrack.length > 0) {
        tracks.push(midiTrack);
      }
    }

    // Build MIDI file
    const midiFile = this.buildMidiFile(tracks, project.time_ppq);

    return new Blob([midiFile], { type: 'audio/midi' });
  }

  private createTempoTrack(project: CVPJProject): Uint8Array {
    const events: number[] = [];

    // Time signature
    events.push(...this.writeVariableLength(0)); // Delta time
    events.push(0xff, 0x58, 0x04); // Time signature meta event
    events.push(project.timesig[0]); // Numerator
    events.push(Math.log2(project.timesig[1])); // Denominator (as power of 2)
    events.push(24); // MIDI clocks per metronome click
    events.push(8); // 32nd notes per quarter note

    // Tempo
    const bpm = project.metadata?.bpm || 120;
    const microsecondsPerQuarter = Math.round(60000000 / bpm);
    events.push(...this.writeVariableLength(0)); // Delta time
    events.push(0xff, 0x51, 0x03); // Set tempo meta event
    events.push((microsecondsPerQuarter >> 16) & 0xff);
    events.push((microsecondsPerQuarter >> 8) & 0xff);
    events.push(microsecondsPerQuarter & 0xff);

    // Track name
    const trackName = 'Tempo Track';
    events.push(...this.writeVariableLength(0)); // Delta time
    events.push(0xff, 0x03); // Track name meta event
    events.push(...this.writeVariableLength(trackName.length));
    for (let i = 0; i < trackName.length; i++) {
      events.push(trackName.charCodeAt(i));
    }

    // End of track
    events.push(...this.writeVariableLength(0)); // Delta time
    events.push(0xff, 0x2f, 0x00); // End of track

    return new Uint8Array(events);
  }

  private convertTrackToMidi(track: any, project: CVPJProject): Uint8Array {
    const events: Array<{ time: number; data: number[] }> = [];

    // Track name
    const trackName = track.visual?.name || 'Track';
    events.push({
      time: 0,
      data: [0xff, 0x03, ...this.writeVariableLength(trackName.length),
             ...Array.from(trackName).map(c => c.charCodeAt(0))],
    });

    // Get notes from placements
    const notes: Array<{ position: number; duration: number; key: number; velocity: number }> = [];

    if (track.placements?.notes) {
      for (const placement of track.placements.notes) {
        if (placement.notelist?.notes) {
          for (const note of placement.notelist.notes) {
            notes.push({
              position: placement.position + note.position,
              duration: note.duration,
              key: note.key,
              velocity: note.velocity || 100,
            });
          }
        }
      }
    }

    // Sort notes by position
    notes.sort((a, b) => a.position - b.position);

    // Convert notes to MIDI events
    const channel = 0; // Use channel 0 for now
    const midiEvents: Array<{ time: number; data: number[] }> = [];

    for (const note of notes) {
      // Note On
      midiEvents.push({
        time: note.position,
        data: [0x90 | channel, note.key, Math.min(127, Math.max(1, note.velocity))],
      });

      // Note Off
      midiEvents.push({
        time: note.position + note.duration,
        data: [0x80 | channel, note.key, 0],
      });
    }

    // Sort all events by time
    midiEvents.sort((a, b) => a.time - b.time);

    // Convert to delta times
    const trackData: number[] = [];
    let currentTime = 0;

    for (const event of midiEvents) {
      const deltaTime = event.time - currentTime;
      trackData.push(...this.writeVariableLength(deltaTime));
      trackData.push(...event.data);
      currentTime = event.time;
    }

    // Add end of track
    trackData.push(...this.writeVariableLength(0));
    trackData.push(0xff, 0x2f, 0x00);

    return new Uint8Array(trackData);
  }

  private buildMidiFile(tracks: Uint8Array[], ppq: number): Uint8Array {
    // Calculate total size
    let totalSize = 14; // Header chunk
    for (const track of tracks) {
      totalSize += 8 + track.length; // Track chunk header + data
    }

    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Write header chunk
    buffer.set([0x4d, 0x54, 0x68, 0x64], offset); // 'MThd'
    offset += 4;
    view.setUint32(offset, 6); // Header length
    offset += 4;
    view.setUint16(offset, 1); // Format 1 (multiple tracks, synchronous)
    offset += 2;
    view.setUint16(offset, tracks.length); // Number of tracks
    offset += 2;
    view.setUint16(offset, ppq); // PPQ
    offset += 2;

    // Write track chunks
    for (const track of tracks) {
      buffer.set([0x4d, 0x54, 0x72, 0x6b], offset); // 'MTrk'
      offset += 4;
      view.setUint32(offset, track.length); // Track length
      offset += 4;
      buffer.set(track, offset);
      offset += track.length;
    }

    return buffer;
  }

  private writeVariableLength(value: number): number[] {
    const bytes: number[] = [];
    let v = value;

    bytes.push(v & 0x7f);
    v >>= 7;

    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }

    return bytes;
  }
}
