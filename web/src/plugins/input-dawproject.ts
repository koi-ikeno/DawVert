/**
 * DawProject Input Plugin (Basic Implementation)
 *
 * Parses DawProject files (.dawproject)
 * Format: ZIP archive containing project.xml and optional metadata.xml
 *
 * Phase 1 Limitations:
 * - No VST/VST3/CLAP plugin support
 * - No automation (beyond basic parameters)
 * - No send/return routing
 * - No audio warps/timestretching
 * - Basic tracks, notes, and audio only
 */

import type { InputPlugin, PluginInfo } from '../lib/plugin-system';
import type { CVPJProject, ConversionConfig, Track, Note } from '../types/cvpj';
import type { DawProject, DawTrack, DawClip, DawNote, DawNumericParam, DawBoolParam } from '../types/dawproject';
import { extractFileFromZip, listZipFiles, supportsDecompression } from '../lib/zip-utils';

export class DawProjectInputPlugin implements InputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'DawProject',
      shortname: 'dawproject',
      file_ext: ['dawproject'],
      projtype: 'r',
      supported_autodetect: true,
    };
  }

  async detect(file: File): Promise<boolean> {
    try {
      if (!supportsDecompression()) return false;

      const files = await listZipFiles(file);
      return files.includes('project.xml');
    } catch {
      return false;
    }
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    if (!supportsDecompression()) {
      throw new Error('Your browser does not support ZIP decompression. Please use a modern browser.');
    }

    // Extract project.xml from ZIP
    const projectXmlData = await extractFileFromZip(file, 'project.xml');
    if (!projectXmlData) {
      throw new Error('project.xml not found in DawProject archive');
    }

    // Parse XML
    const xmlText = new TextDecoder().decode(projectXmlData);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Failed to parse project.xml: ' + parserError.textContent);
    }

    // Parse DawProject
    const dawProject = this.parseProjectXML(xmlDoc);

    // Extract metadata.xml if exists
    try {
      const metadataXmlData = await extractFileFromZip(file, 'metadata.xml');
      if (metadataXmlData) {
        const metadataText = new TextDecoder().decode(metadataXmlData);
        const metadataDoc = parser.parseFromString(metadataText, 'text/xml');
        dawProject.metadata = this.parseMetadataXML(metadataDoc);
      }
    } catch {
      // Metadata is optional
    }

    // Convert to CVPJ
    return this.dawProjectToCVPJ(dawProject);
  }

  private parseProjectXML(xmlDoc: Document): DawProject {
    const root = xmlDoc.documentElement;

    const project: DawProject = {
      version: root.getAttribute('version') || '1.0',
      application: { name: '', version: '' },
      transport: {
        tempo: { value: 120, unit: 'bpm', min: 20, max: 600 },
        timeSignature: { numerator: 4, denominator: 4 },
      },
      structure: [],
      arrangement: {
        id: '',
        lanes: {
          lanes: [],
        },
      },
    };

    // Parse Application
    const appEl = root.querySelector('Application');
    if (appEl) {
      project.application.name = appEl.getAttribute('name') || '';
      project.application.version = appEl.getAttribute('version') || '';
    }

    // Parse Transport
    const transportEl = root.querySelector('Transport');
    if (transportEl) {
      const tempoEl = transportEl.querySelector('Tempo');
      if (tempoEl) {
        project.transport.tempo = this.parseNumericParam(tempoEl, 120);
      }

      const timeSigEl = transportEl.querySelector('TimeSignature');
      if (timeSigEl) {
        project.transport.timeSignature = {
          numerator: parseInt(timeSigEl.getAttribute('numerator') || '4'),
          denominator: parseInt(timeSigEl.getAttribute('denominator') || '4'),
        };
      }
    }

    // Parse Structure
    const structureEl = root.querySelector('Structure');
    if (structureEl) {
      const trackEls = structureEl.querySelectorAll(':scope > Track');
      trackEls.forEach(trackEl => {
        project.structure.push(this.parseTrack(trackEl));
      });
    }

    // Parse Arrangement
    const arrangementEl = root.querySelector('Arrangement');
    if (arrangementEl) {
      project.arrangement.id = arrangementEl.getAttribute('id') || '';

      const lanesContainer = arrangementEl.querySelector('Lanes');
      if (lanesContainer) {
        project.arrangement.lanes.id = lanesContainer.getAttribute('id') || undefined;
        project.arrangement.lanes.timeUnit = (lanesContainer.getAttribute('timeUnit') as any) || undefined;

        const laneEls = lanesContainer.querySelectorAll(':scope > Lanes');
        laneEls.forEach(laneEl => {
          const lane = {
            track: laneEl.getAttribute('track') || undefined,
            clips: { clips: [] as DawClip[] },
          };

          const clipsEl = laneEl.querySelector('Clips');
          if (clipsEl) {
            const clipEls = clipsEl.querySelectorAll(':scope > Clip');
            clipEls.forEach(clipEl => {
              lane.clips.clips.push(this.parseClip(clipEl));
            });
          }

          project.arrangement.lanes.lanes.push(lane);
        });
      }

      // Parse Markers
      const markersEl = arrangementEl.querySelector('Markers');
      if (markersEl) {
        project.arrangement.markers = {
          id: markersEl.getAttribute('id') || undefined,
          markers: [],
        };

        const markerEls = markersEl.querySelectorAll('Marker');
        markerEls.forEach(markerEl => {
          project.arrangement.markers!.markers.push({
            time: parseFloat(markerEl.getAttribute('time') || '0'),
            name: markerEl.getAttribute('name') || undefined,
            color: markerEl.getAttribute('color') || undefined,
          });
        });
      }
    }

    return project;
  }

  private parseTrack(trackEl: Element): DawTrack {
    const track: DawTrack = {
      id: trackEl.getAttribute('id') || undefined,
      name: trackEl.getAttribute('name') || undefined,
      color: trackEl.getAttribute('color') || undefined,
      contentType: (trackEl.getAttribute('contentType') as any) || undefined,
      loaded: trackEl.getAttribute('loaded') === 'true',
      channel: {
        mute: { value: false },
        pan: { value: 0.5, unit: 'normalized', min: 0, max: 1 },
        volume: { value: 1.0, unit: 'linear', min: 0, max: 2 },
      },
    };

    // Parse Channel
    const channelEl = trackEl.querySelector('Channel');
    if (channelEl) {
      track.channel.role = (channelEl.getAttribute('role') as any) || undefined;
      track.channel.solo = channelEl.getAttribute('solo') === 'true';
      track.channel.id = channelEl.getAttribute('id') || undefined;

      const muteEl = channelEl.querySelector('Mute');
      if (muteEl) {
        track.channel.mute = this.parseBoolParam(muteEl, false);
      }

      const panEl = channelEl.querySelector('Pan');
      if (panEl) {
        track.channel.pan = this.parseNumericParam(panEl, 0.5);
      }

      const volumeEl = channelEl.querySelector('Volume');
      if (volumeEl) {
        track.channel.volume = this.parseNumericParam(volumeEl, 1.0);
      }
    }

    // Parse nested tracks
    const nestedTrackEls = trackEl.querySelectorAll(':scope > Track');
    if (nestedTrackEls.length > 0) {
      track.tracks = [];
      nestedTrackEls.forEach(nestedEl => {
        track.tracks!.push(this.parseTrack(nestedEl));
      });
    }

    return track;
  }

  private parseClip(clipEl: Element): DawClip {
    const clip: DawClip = {
      time: parseFloat(clipEl.getAttribute('time') || '0'),
      duration: parseFloat(clipEl.getAttribute('duration') || '0'),
      timeUnit: (clipEl.getAttribute('timeUnit') as any) || undefined,
      contentTimeUnit: (clipEl.getAttribute('contentTimeUnit') as any) || undefined,
      name: clipEl.getAttribute('name') || undefined,
      color: clipEl.getAttribute('color') || undefined,
      playStart: parseFloat(clipEl.getAttribute('playStart') || '0') || undefined,
      playStop: parseFloat(clipEl.getAttribute('playStop') || '0') || undefined,
      loopStart: parseFloat(clipEl.getAttribute('loopStart') || '0') || undefined,
      loopEnd: parseFloat(clipEl.getAttribute('loopEnd') || '0') || undefined,
      fadeTimeUnit: (clipEl.getAttribute('fadeTimeUnit') as any) || undefined,
      fadeInTime: parseFloat(clipEl.getAttribute('fadeInTime') || '0') || undefined,
      fadeOutTime: parseFloat(clipEl.getAttribute('fadeOutTime') || '0') || undefined,
    };

    // Parse Notes
    const notesEl = clipEl.querySelector('Notes');
    if (notesEl) {
      clip.notes = {
        id: notesEl.getAttribute('id') || undefined,
        notes: [],
      };

      const noteEls = notesEl.querySelectorAll('Note');
      noteEls.forEach(noteEl => {
        clip.notes!.notes.push({
          time: parseFloat(noteEl.getAttribute('time') || '0'),
          duration: parseFloat(noteEl.getAttribute('duration') || '0'),
          key: parseInt(noteEl.getAttribute('key') || '60'),
          vel: parseFloat(noteEl.getAttribute('vel') || '1'),
          rel: parseFloat(noteEl.getAttribute('rel') || '0') || undefined,
          channel: parseInt(noteEl.getAttribute('channel') || '0') || undefined,
        });
      });
    }

    // Parse Audio
    const audioEl = clipEl.querySelector('Audio');
    if (audioEl) {
      const fileEl = audioEl.querySelector('File');
      clip.audio = {
        id: audioEl.getAttribute('id') || undefined,
        channels: parseInt(audioEl.getAttribute('channels') || '2') || undefined,
        duration: parseFloat(audioEl.getAttribute('duration') || '0') || undefined,
        sampleRate: parseInt(audioEl.getAttribute('sampleRate') || '44100') || undefined,
        algorithm: audioEl.getAttribute('algorithm') || undefined,
        file: {
          path: fileEl?.getAttribute('path') || '',
        },
      };
    }

    return clip;
  }

  private parseBoolParam(el: Element, defaultValue: boolean): DawBoolParam {
    return {
      value: el.getAttribute('value') === 'true',
      id: el.getAttribute('id') || undefined,
      name: el.getAttribute('name') || undefined,
    };
  }

  private parseNumericParam(el: Element, defaultValue: number): DawNumericParam {
    return {
      value: parseFloat(el.getAttribute('value') || String(defaultValue)),
      id: el.getAttribute('id') || undefined,
      name: el.getAttribute('name') || undefined,
      unit: el.getAttribute('unit') || undefined,
      min: parseFloat(el.getAttribute('min') || '0') || undefined,
      max: parseFloat(el.getAttribute('max') || '0') || undefined,
    };
  }

  private parseMetadataXML(xmlDoc: Document): Record<string, string> {
    const metadata: Record<string, string> = {};
    const root = xmlDoc.documentElement;

    Array.from(root.children).forEach(child => {
      if (child.textContent) {
        metadata[child.tagName] = child.textContent;
      }
    });

    return metadata;
  }

  private dawProjectToCVPJ(dawProject: DawProject): CVPJProject {
    const project: CVPJProject = {
      type: 'r',
      time_ppq: 96,
      time_float: false,
      track_data: {},
      track_order: [],
      plugins: {},
      timesig: [
        dawProject.transport.timeSignature.numerator,
        dawProject.transport.timeSignature.denominator,
      ],
      metadata: {},
    };

    // Set BPM
    project.metadata.bpm = dawProject.transport.tempo.value;

    // Convert tracks
    const trackMap = new Map<string, Track>();
    this.convertTracks(dawProject.structure, project, trackMap);

    // Convert clips from arrangement
    for (const lane of dawProject.arrangement.lanes.lanes) {
      if (lane.track && trackMap.has(lane.track)) {
        const track = trackMap.get(lane.track)!;
        this.convertClips(lane.clips.clips, track, project);
      }
    }

    // Convert markers
    if (dawProject.arrangement.markers) {
      // TODO: Implement marker conversion
      // CVPJ doesn't have a direct marker equivalent, may need custom structure
    }

    // Convert metadata
    if (dawProject.metadata) {
      if (dawProject.metadata.Title) project.metadata.title = dawProject.metadata.Title;
      if (dawProject.metadata.Artist) project.metadata.artist = dawProject.metadata.Artist;
      if (dawProject.metadata.Album) project.metadata.album = dawProject.metadata.Album;
      if (dawProject.metadata.Genre) project.metadata.genre = dawProject.metadata.Genre;
      if (dawProject.metadata.Comment) project.metadata.comment = dawProject.metadata.Comment;
      if (dawProject.metadata.Year) project.metadata.year = parseInt(dawProject.metadata.Year);
      if (dawProject.metadata.Copyright) project.metadata.copyright = dawProject.metadata.Copyright;
    }

    return project;
  }

  private convertTracks(
    dawTracks: DawTrack[],
    project: CVPJProject,
    trackMap: Map<string, Track>,
    groupId?: string
  ): void {
    for (const dawTrack of dawTracks) {
      if (!dawTrack.id) continue;

      const trackId = dawTrack.id;

      // Determine track type
      let trackType: 'instrument' | 'audio' | 'hybrid' = 'instrument';
      if (dawTrack.contentType === 'audio') {
        trackType = 'audio';
      } else if (dawTrack.contentType === 'audio notes') {
        trackType = 'hybrid';
      }

      // Create track
      const track: Track = {
        type: trackType,
        visual: {
          name: dawTrack.name,
          color: dawTrack.color,
        },
        params: {
          vol: this.convertVolume(dawTrack.channel.volume.value),
          pan: this.convertPan(dawTrack.channel.pan.value, dawTrack.channel.pan.unit),
          enabled: !dawTrack.channel.mute.value,
          solo: dawTrack.channel.solo || false,
        },
        placements: {
          notes: [],
          audio: [],
        },
        plugslots: {
          slots_audio: [],
        },
        notes: [],
      };

      if (groupId) {
        track.group = groupId;
      }

      project.track_data[trackId] = track;
      project.track_order.push(trackId);
      trackMap.set(trackId, track);

      // Convert nested tracks (groups)
      if (dawTrack.tracks && dawTrack.tracks.length > 0) {
        this.convertTracks(dawTrack.tracks, project, trackMap, trackId);
      }
    }
  }

  private convertClips(clips: DawClip[], track: Track, project: CVPJProject): void {
    for (const clip of clips) {
      if (clip.notes) {
        // Convert note clip
        for (const dawNote of clip.notes.notes) {
          const note: Note = {
            position: clip.time + dawNote.time,
            duration: dawNote.duration,
            key: dawNote.key - 60, // Convert to offset from middle C
            velocity: dawNote.vel || 1.0,
          };

          if (dawNote.channel !== undefined) {
            note.channel = dawNote.channel;
          }

          track.notes!.push(note);
        }
      }

      if (clip.audio && clip.audio.file) {
        // Convert audio clip
        const audioPlacement = {
          position: clip.time,
          duration: clip.duration,
          sample: {
            sampleref: clip.audio.file.path,
          },
        };

        track.placements.audio!.push(audioPlacement);
      }
    }
  }

  private convertVolume(value: number): number {
    // DawProject: 0-2 (linear), CVPJ: 0-1 (linear)
    return Math.min(1.0, value / 2.0);
  }

  private convertPan(value: number, unit?: string): number {
    // DawProject: 0-1 (normalized), CVPJ: -1 to 1
    if (unit === 'normalized') {
      return (value - 0.5) * 2;
    }
    return value;
  }

  isUsable(): { usable: boolean; message: string } {
    if (supportsDecompression()) {
      return {
        usable: true,
        message: 'DawProject files supported (Basic: tracks, notes, audio. No VST plugins)',
      };
    } else {
      return {
        usable: false,
        message: 'DawProject requires a modern browser with DecompressionStream support',
      };
    }
  }
}
