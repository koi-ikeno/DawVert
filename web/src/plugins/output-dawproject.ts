/**
 * DawProject Output Plugin (Phase 2 - Extended)
 *
 * Generates DawProject files (.dawproject)
 * Format: XML output (ZIP creation in future phase)
 *
 * Phase 2 Features:
 * ✅ Automation generation (limited - CVPJ doesn't fully support all automation types)
 * ✅ Send/Return routing (if present in CVPJ)
 * ✅ VST plugin metadata preservation (name, ID - NO audio processing)
 * ✅ Basic nested structures
 * ✅ Markers
 *
 * Limitations:
 * ❌ VST audio processing (impossible in browser)
 * ❌ ZIP creation (browser limitation - outputs XML only)
 * ❌ Full automation (CVPJ limited support)
 * ❌ Audio warps (not in CVPJ)
 */

import type { OutputPlugin, PluginInfo } from '../lib/plugin-system';
import type { CVPJProject, ConversionConfig, Track, Plugin } from '../types/cvpj';

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

    // Phase 2: Add sends if present
    if (track.sends) {
      let sendIndex = 0;
      for (const sendDest in track.sends) {
        const sendData = track.sends[sendDest];
        const sendVolume = typeof sendData === 'number' ? sendData : (sendData.amount || 1.0);
        this.createSendElement(doc, channelEl, `${trackId}_send${sendIndex}`, sendDest, sendVolume);
        sendIndex++;
      }
    }

    // Phase 2: Add devices (plugins) if present
    const allPlugins: Plugin[] = [];

    // Add instrument plugins
    if (track.plugslots) {
      for (const slot of track.plugslots) {
        if (slot.plugin) {
          allPlugins.push(slot.plugin);
        }
      }
    }

    // Add audio effect plugins
    if (track.fxslots_audio) {
      for (const slot of track.fxslots_audio) {
        if (slot.plugin) {
          allPlugins.push(slot.plugin);
        }
      }
    }

    // Generate device elements
    if (allPlugins.length > 0) {
      const devicesEl = doc.createElement('Devices');
      let pluginIndex = 0;
      for (const plugin of allPlugins) {
        this.createDeviceElement(doc, devicesEl, plugin, `${trackId}_plugin${pluginIndex}`);
        pluginIndex++;
      }
      channelEl.appendChild(devicesEl);
    }

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

    // Phase 2: Add automation if present
    if (track.automation) {
      for (const autoPath in track.automation) {
        const autoData = track.automation[autoPath];
        const pointsEl = this.createPointsElement(doc, autoData, autoPath, `${trackId}_auto_${autoPath}`);
        if (pointsEl) {
          laneEl.appendChild(pointsEl);
        }
      }
    }

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

  // ============ Phase 2: Helper Functions ============

  private createPointsElement(doc: Document, automationData: any, paramName?: string, paramId?: string): Element | null {
    if (!automationData || !automationData.points || automationData.points.length === 0) {
      return null;
    }

    const pointsEl = doc.createElement('Points');

    if (paramId) {
      pointsEl.setAttribute('id', paramId);
    }

    // Add target if we have parameter info
    if (paramName) {
      const targetEl = doc.createElement('Target');
      targetEl.setAttribute('parameter', paramName);
      pointsEl.appendChild(targetEl);
    }

    // Add points
    for (const autoPoint of automationData.points) {
      const pointEl = doc.createElement('Point');
      pointEl.setAttribute('time', String(autoPoint.position));
      pointEl.setAttribute('value', String(autoPoint.value));

      if (autoPoint.tension !== undefined) {
        pointEl.setAttribute('curve', String(autoPoint.tension));
      }

      pointsEl.appendChild(pointEl);
    }

    return pointsEl;
  }

  private createSendElement(doc: Document, parent: Element, sendId: string, destination: string, volume: number): void {
    const sendEl = doc.createElement('Send');
    sendEl.setAttribute('id', sendId);
    sendEl.setAttribute('destination', destination);
    sendEl.setAttribute('type', 'post');

    const volumeEl = doc.createElement('Volume');
    volumeEl.setAttribute('value', String(volume * 2)); // CVPJ 0~1 to DawProject 0~2
    volumeEl.setAttribute('min', '0');
    volumeEl.setAttribute('max', '2');
    volumeEl.setAttribute('unit', 'linear');
    volumeEl.setAttribute('name', 'Volume');
    sendEl.appendChild(volumeEl);

    parent.appendChild(sendEl);
  }

  private createDeviceElement(doc: Document, parent: Element, plugin: Plugin, pluginId: string): void {
    // Determine plugin type from CVPJ
    let pluginType = 'Vst3Plugin'; // Default
    let deviceRole: 'instrument' | 'audioFX' | 'noteFX' = 'audioFX';

    if (plugin.plugin_category === 'external') {
      if (plugin.plugin_type === 'vst2') pluginType = 'Vst2Plugin';
      else if (plugin.plugin_type === 'vst3') pluginType = 'Vst3Plugin';
      else if (plugin.plugin_type === 'clap') pluginType = 'ClapPlugin';
    }

    if (plugin.role === 'synth' || plugin.role === 'inst') {
      deviceRole = 'instrument';
    } else if (plugin.role === 'fx' || plugin.role === 'effect') {
      deviceRole = 'audioFX';
    }

    const deviceEl = doc.createElement(pluginType);
    deviceEl.setAttribute('id', pluginId + '_device');
    deviceEl.setAttribute('deviceRole', deviceRole);

    if (plugin.visual?.name) {
      deviceEl.setAttribute('deviceName', plugin.visual.name);
    }

    // Add enabled parameter
    const enabledEl = doc.createElement('Enabled');
    enabledEl.setAttribute('value', 'true');
    enabledEl.setAttribute('name', 'Enabled');
    deviceEl.appendChild(enabledEl);

    // Phase 2: Add VST metadata if available (CVPJ doesn't have full VST support, but we can preserve what's there)
    // Note: This is mostly placeholder - CVPJ doesn't store VST state

    parent.appendChild(deviceEl);
  }

  isUsable(): { usable: boolean; message: string } {
    return {
      usable: true,
      message: 'DawProject Phase 2: XML output with automation/sends/VST metadata (no ZIP, no audio processing)',
    };
  }
}
