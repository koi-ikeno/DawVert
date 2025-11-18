/**
 * DawProject Output Plugin (Basic Implementation)
 *
 * Generates DawProject files (.dawproject)
 * Format: ZIP archive containing project.xml
 *
 * Phase 1 Limitations:
 * - No VST/VST3/CLAP plugin support
 * - No automation
 * - No send/return routing
 * - Basic tracks, notes, and audio only
 * - No ZIP creation (browser limitation) - outputs uncompressed XML only
 */

import type { OutputPlugin, PluginInfo } from '../lib/plugin-system';
import type { CVPJProject, ConversionConfig, Track } from '../types/cvpj';

export class DawProjectOutputPlugin implements OutputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'DawProject',
      shortname: 'dawproject',
      file_ext: ['xml'], // Note: outputs XML only (no ZIP in browser Phase 1)
      projtype: 'r',
      supported_autodetect: false,
    };
  }

  async generate(project: CVPJProject, config: ConversionConfig): Promise<Blob> {
    const xmlContent = this.cvpjToDawProject(project);
    return new Blob([xmlContent], { type: 'application/xml' });
  }

  private cvpjToDawProject(project: CVPJProject): string {
    // Create XML document
    const doc = document.implementation.createDocument(null, 'Project', null);
    const root = doc.documentElement;
    root.setAttribute('version', '1.0');

    // Application
    const appEl = doc.createElement('Application');
    appEl.setAttribute('name', 'DawVert Web');
    appEl.setAttribute('version', '1.0');
    root.appendChild(appEl);

    // Transport
    const transportEl = doc.createElement('Transport');

    const tempoEl = doc.createElement('Tempo');
    const bpm = project.metadata?.bpm || 120;
    tempoEl.setAttribute('value', String(bpm));
    tempoEl.setAttribute('min', '20');
    tempoEl.setAttribute('max', '600');
    tempoEl.setAttribute('unit', 'bpm');
    tempoEl.setAttribute('name', 'Tempo');
    transportEl.appendChild(tempoEl);

    const timeSigEl = doc.createElement('TimeSignature');
    timeSigEl.setAttribute('numerator', String(project.timesig?.[0] || 4));
    timeSigEl.setAttribute('denominator', String(project.timesig?.[1] || 4));
    transportEl.appendChild(timeSigEl);

    root.appendChild(transportEl);

    // Structure
    const structureEl = doc.createElement('Structure');
    for (const trackId of project.track_order || []) {
      const track = project.track_data[trackId];
      if (track) {
        this.createTrackElement(doc, structureEl, trackId, track);
      }
    }
    root.appendChild(structureEl);

    // Arrangement
    const arrangementEl = doc.createElement('Arrangement');
    arrangementEl.setAttribute('id', 'arrangement1');

    const lanesContainerEl = doc.createElement('Lanes');
    lanesContainerEl.setAttribute('timeUnit', 'beats');

    for (const trackId of project.track_order || []) {
      const track = project.track_data[trackId];
      if (track) {
        this.createLaneElement(doc, lanesContainerEl, trackId, track);
      }
    }

    arrangementEl.appendChild(lanesContainerEl);
    root.appendChild(arrangementEl);

    // Serialize to pretty XML
    return this.prettifyXML(new XMLSerializer().serializeToString(doc));
  }

  private createTrackElement(
    doc: Document,
    parent: Element,
    trackId: string,
    track: Track
  ): void {
    const trackEl = doc.createElement('Track');
    trackEl.setAttribute('id', trackId);

    if (track.visual?.name) {
      trackEl.setAttribute('name', track.visual.name);
    }

    if (track.visual?.color) {
      trackEl.setAttribute('color', track.visual.color);
    }

    // Content type
    if (track.type === 'audio') {
      trackEl.setAttribute('contentType', 'audio');
    } else if (track.type === 'hybrid') {
      trackEl.setAttribute('contentType', 'audio notes');
    } else {
      trackEl.setAttribute('contentType', 'notes');
    }

    trackEl.setAttribute('loaded', 'true');

    // Channel
    const channelEl = doc.createElement('Channel');
    channelEl.setAttribute('role', 'regular');
    channelEl.setAttribute('id', trackId + '_channel');

    // Mute
    const muteEl = doc.createElement('Mute');
    const enabled = track.params?.enabled !== undefined ? track.params.enabled : true;
    muteEl.setAttribute('value', String(!enabled));
    muteEl.setAttribute('name', 'Mute');
    channelEl.appendChild(muteEl);

    // Pan
    const panEl = doc.createElement('Pan');
    const pan = track.params?.pan || 0;
    panEl.setAttribute('value', String((pan / 2) + 0.5)); // CVPJ -1~1 to DawProject 0~1
    panEl.setAttribute('min', '0');
    panEl.setAttribute('max', '1');
    panEl.setAttribute('unit', 'normalized');
    panEl.setAttribute('name', 'Pan');
    channelEl.appendChild(panEl);

    // Volume
    const volumeEl = doc.createElement('Volume');
    const vol = track.params?.vol || 1.0;
    volumeEl.setAttribute('value', String(vol * 2)); // CVPJ 0~1 to DawProject 0~2
    volumeEl.setAttribute('min', '0');
    volumeEl.setAttribute('max', '2');
    volumeEl.setAttribute('unit', 'linear');
    volumeEl.setAttribute('name', 'Volume');
    channelEl.appendChild(volumeEl);

    trackEl.appendChild(channelEl);
    parent.appendChild(trackEl);
  }

  private createLaneElement(
    doc: Document,
    parent: Element,
    trackId: string,
    track: Track
  ): void {
    const laneEl = doc.createElement('Lanes');
    laneEl.setAttribute('track', trackId);

    const clipsEl = doc.createElement('Clips');

    // Add note clips
    if (track.notes && track.notes.length > 0) {
      const clipEl = doc.createElement('Clip');

      // Calculate clip bounds
      let minTime = Infinity;
      let maxTime = -Infinity;
      for (const note of track.notes) {
        minTime = Math.min(minTime, note.position);
        maxTime = Math.max(maxTime, note.position + note.duration);
      }

      clipEl.setAttribute('time', String(minTime));
      clipEl.setAttribute('duration', String(maxTime - minTime));
      clipEl.setAttribute('name', track.visual?.name || 'Notes');

      if (track.visual?.color) {
        clipEl.setAttribute('color', track.visual.color.toUpperCase());
      }

      // Notes container
      const notesEl = doc.createElement('Notes');

      for (const note of track.notes) {
        const noteEl = doc.createElement('Note');
        noteEl.setAttribute('time', String(note.position - minTime)); // Relative to clip
        noteEl.setAttribute('duration', String(note.duration));
        noteEl.setAttribute('key', String(note.key + 60)); // Offset to MIDI note number
        noteEl.setAttribute('vel', String(note.velocity || 1.0));

        if (note.channel !== undefined) {
          noteEl.setAttribute('channel', String(note.channel));
        }

        notesEl.appendChild(noteEl);
      }

      clipEl.appendChild(notesEl);
      clipsEl.appendChild(clipEl);
    }

    // Add audio clips
    if (track.placements?.audio) {
      for (const audioPlacement of track.placements.audio) {
        const clipEl = doc.createElement('Clip');
        clipEl.setAttribute('time', String(audioPlacement.position));
        clipEl.setAttribute('duration', String(audioPlacement.duration));

        if (audioPlacement.sample?.sampleref) {
          const audioEl = doc.createElement('Audio');
          const fileEl = doc.createElement('File');
          fileEl.setAttribute('path', audioPlacement.sample.sampleref);
          audioEl.appendChild(fileEl);
          clipEl.appendChild(audioEl);
        }

        clipsEl.appendChild(clipEl);
      }
    }

    laneEl.appendChild(clipsEl);
    parent.appendChild(laneEl);
  }

  private prettifyXML(xml: string): string {
    const PADDING = '  '; // 2 spaces
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;

    xml = xml.replace(reg, '$1\n$2$3');

    return xml.split('\n').map((line) => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      const padding = PADDING.repeat(pad);
      pad += indent;

      return padding + line;
    }).join('\n');
  }

  isUsable(): { usable: boolean; message: string } {
    return {
      usable: true,
      message: 'DawProject output (XML only, basic features)',
    };
  }
}
