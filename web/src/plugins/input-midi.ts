/**
 * MIDI Input Plugin
 * Parses MIDI files into CVPJ format
 */

import type { InputPlugin, BasePlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig, Note } from '@/types/cvpj';

export class MidiInputPlugin implements InputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'MIDI',
      shortname: 'midi',
      file_ext: ['mid', 'midi'],
      file_ext_detect: true,
      projtype: 'rm',
      supported_autodetect: true,
    };
  }

  isUsable(): { usable: boolean; message: string } {
    return { usable: true, message: '' };
  }

  async detect(file: File): Promise<boolean> {
    // Read first 4 bytes to check for MIDI header
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new DataView(buffer);
    const header = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    return header === 'MThd';
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    const buffer = await file.arrayBuffer();
    const midiData = this.parseMidiFile(buffer);

    // Create CVPJ project
    const project: CVPJProject = {
      type: 'rm',
      fxtype: 'none',
      time_ppq: midiData.ppq,
      time_float: false,
      track_data: {},
      track_order: [],
      instruments: {},
      instruments_order: [],
      timesig: [4, 4],
      do_actions: [],
      metadata: {
        bpm: 120,
      },
    };

    // Convert MIDI tracks to CVPJ
    midiData.tracks.forEach((midiTrack, index) => {
      const trackId = `track_${index}`;
      const instId = `inst_${index}`;

      // Create instrument
      project.instruments![instId] = {
        visual: {
          name: midiTrack.name || `Track ${index + 1}`,
        },
        plugslots: [
          {
            plugin: {
              type: 'midi',
              subtype: 'gm',
              name: 'GM Synth',
            },
          },
        ],
      };

      if (!project.instruments_order!.includes(instId)) {
        project.instruments_order!.push(instId);
      }

      // Create track
      project.track_data[trackId] = {
        type: 'instrument',
        inst: instId,
        visual: {
          name: midiTrack.name || `Track ${index + 1}`,
        },
        placements: {
          notes: [
            {
              position: 0,
              duration: midiTrack.duration,
              notelist: {
                notes: midiTrack.notes,
              },
            },
          ],
        },
      };

      project.track_order.push(trackId);
    });

    return project;
  }

  private parseMidiFile(buffer: ArrayBuffer): {
    ppq: number;
    tracks: Array<{
      name?: string;
      notes: Note[];
      duration: number;
    }>;
  } {
    const view = new DataView(buffer);
    let offset = 0;

    // Read header chunk
    const headerType = this.readChars(view, offset, 4);
    offset += 4;

    if (headerType !== 'MThd') {
      throw new Error('Invalid MIDI file: Missing MThd header');
    }

    const headerLength = view.getUint32(offset);
    offset += 4;

    const format = view.getUint16(offset);
    offset += 2;

    const numTracks = view.getUint16(offset);
    offset += 2;

    const division = view.getUint16(offset);
    offset += 2;

    const ppq = division & 0x7fff; // Get PPQ (ignoring SMPTE format)

    const tracks: Array<{
      name?: string;
      notes: Note[];
      duration: number;
    }> = [];

    // Read track chunks
    for (let i = 0; i < numTracks; i++) {
      const trackType = this.readChars(view, offset, 4);
      offset += 4;

      if (trackType !== 'MTrk') {
        throw new Error(`Invalid MIDI file: Expected MTrk, got ${trackType}`);
      }

      const trackLength = view.getUint32(offset);
      offset += 4;

      const trackData = this.parseTrack(view, offset, trackLength, ppq);
      tracks.push(trackData);

      offset += trackLength;
    }

    return { ppq, tracks };
  }

  private parseTrack(
    view: DataView,
    startOffset: number,
    length: number,
    ppq: number
  ): {
    name?: string;
    notes: Note[];
    duration: number;
  } {
    let offset = startOffset;
    const endOffset = startOffset + length;
    const notes: Note[] = [];
    let currentTime = 0;
    let trackName: string | undefined;
    let runningStatus = 0;

    // Track note on/off events
    const activeNotes = new Map<number, { position: number; velocity: number }>();

    while (offset < endOffset) {
      // Read delta time
      const deltaTime = this.readVariableLength(view, offset);
      offset += deltaTime.bytesRead;
      currentTime += deltaTime.value;

      // Read event
      let status = view.getUint8(offset);

      // Handle running status
      if (status < 0x80) {
        status = runningStatus;
      } else {
        offset++;
        runningStatus = status;
      }

      const messageType = status & 0xf0;
      const channel = status & 0x0f;

      if (messageType === 0x90) {
        // Note On
        const key = view.getUint8(offset);
        offset++;
        const velocity = view.getUint8(offset);
        offset++;

        if (velocity > 0) {
          activeNotes.set(key, { position: currentTime, velocity });
        } else {
          // Velocity 0 is Note Off
          const noteOn = activeNotes.get(key);
          if (noteOn) {
            notes.push({
              position: noteOn.position,
              duration: currentTime - noteOn.position,
              key,
              velocity: noteOn.velocity,
            });
            activeNotes.delete(key);
          }
        }
      } else if (messageType === 0x80) {
        // Note Off
        const key = view.getUint8(offset);
        offset++;
        offset++; // Skip velocity

        const noteOn = activeNotes.get(key);
        if (noteOn) {
          notes.push({
            position: noteOn.position,
            duration: currentTime - noteOn.position,
            key,
            velocity: noteOn.velocity,
          });
          activeNotes.delete(key);
        }
      } else if (messageType === 0xb0) {
        // Control Change
        offset += 2;
      } else if (messageType === 0xc0 || messageType === 0xd0) {
        // Program Change or Channel Pressure
        offset += 1;
      } else if (messageType === 0xe0) {
        // Pitch Bend
        offset += 2;
      } else if (status === 0xff) {
        // Meta Event
        const metaType = view.getUint8(offset);
        offset++;
        const metaLength = this.readVariableLength(view, offset);
        offset += metaLength.bytesRead;

        if (metaType === 0x03) {
          // Track Name
          trackName = this.readChars(view, offset, metaLength.value);
        }

        offset += metaLength.value;
      } else if (status === 0xf0 || status === 0xf7) {
        // SysEx
        const sysexLength = this.readVariableLength(view, offset);
        offset += sysexLength.bytesRead + sysexLength.value;
      } else {
        // Unknown event, skip
        console.warn(`Unknown MIDI event: 0x${status.toString(16)}`);
      }
    }

    // Close any remaining open notes
    for (const [key, noteOn] of activeNotes) {
      notes.push({
        position: noteOn.position,
        duration: currentTime - noteOn.position,
        key,
        velocity: noteOn.velocity,
      });
    }

    return {
      name: trackName,
      notes,
      duration: currentTime,
    };
  }

  private readVariableLength(view: DataView, offset: number): { value: number; bytesRead: number } {
    let value = 0;
    let bytesRead = 0;

    while (true) {
      const byte = view.getUint8(offset + bytesRead);
      bytesRead++;

      value = (value << 7) | (byte & 0x7f);

      if ((byte & 0x80) === 0) {
        break;
      }
    }

    return { value, bytesRead };
  }

  private readChars(view: DataView, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }
}
