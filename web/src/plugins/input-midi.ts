/**
 * MIDI Input Plugin
 * Parses MIDI files into CVPJ format
 */

import type { InputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig, Note } from '@/types/cvpj';
import {
  readVariableLength,
  readString,
  MidiMessageType,
  MidiMetaEventType,
  getGMInstrumentName,
} from '@/lib/midi-utils';

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
      timesig: midiData.timeSignature || [4, 4],
      do_actions: [],
      metadata: {
        name: midiData.title,
        bpm: midiData.tempo,
        comment: midiData.copyright,
      },
    };

    // Convert MIDI tracks to CVPJ
    midiData.tracks.forEach((midiTrack, index) => {
      const trackId = `track_${index}`;
      const instId = `inst_${index}`;

      // Create instrument
      const instrumentName =
        midiTrack.instrumentName ||
        (midiTrack.program !== undefined
          ? getGMInstrumentName(midiTrack.program)
          : undefined) ||
        midiTrack.name ||
        `Track ${index + 1}`;

      project.instruments![instId] = {
        visual: {
          name: instrumentName,
        },
        plugslots: [
          {
            plugin: {
              type: 'midi',
              subtype: 'gm',
              name: 'GM Synth',
              params: midiTrack.program !== undefined ? { program: midiTrack.program } : undefined,
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
    tempo: number;
    timeSignature?: [number, number];
    title?: string;
    copyright?: string;
    tracks: Array<{
      name?: string;
      instrumentName?: string;
      program?: number;
      notes: Note[];
      duration: number;
    }>;
  } {
    const view = new DataView(buffer);
    let offset = 0;

    // Read header chunk
    const headerType = readString(view, offset, 4);
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

    let tempo = 120; // Default BPM
    let timeSignature: [number, number] | undefined;
    let title: string | undefined;
    let copyright: string | undefined;

    const tracks: Array<{
      name?: string;
      instrumentName?: string;
      program?: number;
      notes: Note[];
      duration: number;
    }> = [];

    // Read track chunks
    for (let i = 0; i < numTracks; i++) {
      const trackType = readString(view, offset, 4);
      offset += 4;

      if (trackType !== 'MTrk') {
        throw new Error(`Invalid MIDI file: Expected MTrk, got ${trackType}`);
      }

      const trackLength = view.getUint32(offset);
      offset += 4;

      const trackData = this.parseTrack(view, offset, trackLength, ppq);
      tracks.push(trackData);

      // Extract global metadata from first track
      if (i === 0) {
        if (trackData.tempo !== undefined) tempo = trackData.tempo;
        if (trackData.timeSignature) timeSignature = trackData.timeSignature;
        if (trackData.title) title = trackData.title;
        if (trackData.copyright) copyright = trackData.copyright;
      }

      offset += trackLength;
    }

    return { ppq, tempo, timeSignature, title, copyright, tracks };
  }

  private parseTrack(
    view: DataView,
    startOffset: number,
    length: number,
    ppq: number
  ): {
    name?: string;
    instrumentName?: string;
    program?: number;
    tempo?: number;
    timeSignature?: [number, number];
    title?: string;
    copyright?: string;
    notes: Note[];
    duration: number;
  } {
    let offset = startOffset;
    const endOffset = startOffset + length;
    const notes: Note[] = [];
    let currentTime = 0;
    let trackName: string | undefined;
    let instrumentName: string | undefined;
    let program: number | undefined;
    let tempo: number | undefined;
    let timeSignature: [number, number] | undefined;
    let title: string | undefined;
    let copyright: string | undefined;
    let runningStatus = 0;

    // Track note on/off events
    const activeNotes = new Map<number, { position: number; velocity: number }>();

    while (offset < endOffset) {
      // Read delta time
      const deltaTime = readVariableLength(view, offset);
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

      if (messageType === MidiMessageType.NoteOn) {
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
      } else if (messageType === MidiMessageType.NoteOff) {
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
      } else if (messageType === MidiMessageType.ControlChange) {
        // Control Change
        offset += 2;
      } else if (messageType === MidiMessageType.ProgramChange) {
        // Program Change
        program = view.getUint8(offset);
        offset += 1;
      } else if (messageType === MidiMessageType.ChannelAftertouch) {
        // Channel Pressure
        offset += 1;
      } else if (messageType === MidiMessageType.PitchBend) {
        // Pitch Bend
        offset += 2;
      } else if (status === MidiMessageType.MetaEvent) {
        // Meta Event
        const metaType = view.getUint8(offset);
        offset++;
        const metaLength = readVariableLength(view, offset);
        offset += metaLength.bytesRead;

        if (metaType === MidiMetaEventType.TrackName) {
          // Track Name (0x03)
          trackName = readString(view, offset, metaLength.value);
        } else if (metaType === MidiMetaEventType.InstrumentName) {
          // Instrument Name (0x04)
          instrumentName = readString(view, offset, metaLength.value);
        } else if (metaType === MidiMetaEventType.TextEvent) {
          // Text Event (0x01) - Use as title if no track name yet
          if (!title) {
            title = readString(view, offset, metaLength.value);
          }
        } else if (metaType === MidiMetaEventType.CopyrightNotice) {
          // Copyright (0x02)
          copyright = readString(view, offset, metaLength.value);
        } else if (metaType === MidiMetaEventType.SetTempo) {
          // Set Tempo (0x51)
          const microsecondsPerQuarter =
            (view.getUint8(offset) << 16) |
            (view.getUint8(offset + 1) << 8) |
            view.getUint8(offset + 2);
          tempo = Math.round(60000000 / microsecondsPerQuarter);
        } else if (metaType === MidiMetaEventType.TimeSignature) {
          // Time Signature (0x58)
          const numerator = view.getUint8(offset);
          const denominator = Math.pow(2, view.getUint8(offset + 1));
          timeSignature = [numerator, denominator];
        }

        offset += metaLength.value;
      } else if (status === MidiMessageType.SystemExclusive || status === 0xf7) {
        // SysEx
        const sysexLength = readVariableLength(view, offset);
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
      instrumentName,
      program,
      tempo,
      timeSignature,
      title,
      copyright,
      notes,
      duration: currentTime,
    };
  }

  // Helper method for reading strings (fallback if needed)
  private readChars(view: DataView, offset: number, length: number): string {
    return readString(view, offset, length);
  }
}
