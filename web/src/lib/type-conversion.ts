/**
 * Type Conversion System for CVPJ
 *
 * Converts between different project types:
 * - r (Regular): Standard track-based projects
 * - ri (Regular/Indexed): Track-based with indexed notes
 * - rm (Regular/Multiple): Track-based with multi-instrument support
 * - rs (Regular/Scened): Track-based with scenes
 * - m (Multiple): Playlist-based with separate instruments
 * - mi (Multiple/Indexed): Playlist-based with indexed notes
 * - ms (Multiple/Scened): Playlist-based with scenes
 */

import type { CVPJProject, Track, Instrument, ProjectType } from '../types/cvpj';

/**
 * Deep clone utility for objects
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * rm2r: Regular/Multiple → Regular
 *
 * Converts tracks with type='instruments' (multi-instrument) into separate
 * single-instrument tracks (type='instrument').
 *
 * Process:
 * 1. For each 'instruments' track, split placements by instrument ID
 * 2. Create new tracks for each instrument
 * 3. Merge instrument data from instruments{} into tracks
 * 4. Clean up plugins to only include used ones
 * 5. Clear instruments{} and set type='r'
 */
export function convertRM2R(project: CVPJProject): CVPJProject {
  console.log('[TypeConversion] rm2r: RegularMultiple → Regular');

  const result = deepClone(project);
  const usablePlugins = result.plugins || {};
  result.plugins = {};

  const usedPlugins = new Set<string>();
  result.instruments_order = [];

  const oldTrackOrder = [...(result.track_order || [])];
  const nonMultiTracks: Array<[string, Track]> = [];
  const splittedTracks: Record<string, Array<[string, Track, any, any]>> = {};

  // Process each track
  for (const trackId of oldTrackOrder) {
    const track = result.track_data?.[trackId];
    if (!track) continue;

    if (track.type === 'instruments') {
      // Split multi-instrument track into separate tracks
      const instruments = extractInstrumentsFromTrack(track);

      for (const instId of instruments) {
        if (!splittedTracks[instId]) {
          splittedTracks[instId] = [];
        }

        const newTrack = createTrackFromInstrument(
          track,
          instId,
          result.instruments?.[instId]
        );

        if (newTrack.plugslots?.synth) {
          usedPlugins.add(newTrack.plugslots.synth);
        }

        // Extract placements and notes for this instrument
        const placements = extractPlacementsForInstrument(track, instId);
        const notes = extractNotesForInstrument(track, instId);

        splittedTracks[instId].push([trackId, newTrack, placements, notes]);
      }
    } else {
      // Non-multi-instrument track, keep as-is
      nonMultiTracks.push([trackId, track]);
    }
  }

  // Clear old tracks
  result.track_data = {};
  result.track_order = [];

  // Add split tracks
  for (const [instId, trackDataArray] of Object.entries(splittedTracks)) {
    for (const [oldTrackId, track, placements, notes] of trackDataArray) {
      const newTrackId = `rm2r_${instId}_${oldTrackId}`;
      track.type = 'instrument';

      // Assign placements and notes
      if (placements) {
        track.placements = track.placements || {};
        track.placements.notes = placements;
      }
      if (notes && track.notes) {
        track.notes = notes;
      }

      result.track_data[newTrackId] = track;
      result.track_order.push(newTrackId);
    }
  }

  // Add non-multi tracks
  for (const [trackId, track] of nonMultiTracks) {
    result.track_data[trackId] = track;
    result.track_order.push(trackId);

    // Track used plugins from FX slots
    if (track.plugslots?.slots_audio) {
      for (const fxId of track.plugslots.slots_audio) {
        if (fxId) usedPlugins.add(fxId);
      }
    }
  }

  // Track plugins from FX rack
  if (result.fxrack) {
    for (const fxChannel of Object.values(result.fxrack)) {
      if (fxChannel.plugslots?.slots_audio) {
        for (const fxId of fxChannel.plugslots.slots_audio) {
          if (fxId) usedPlugins.add(fxId);
        }
      }
    }
  }

  // Keep only used plugins
  for (const pluginId of usedPlugins) {
    if (pluginId && usablePlugins[pluginId]) {
      result.plugins[pluginId] = usablePlugins[pluginId];
    }
  }

  // Clear instruments and update type
  result.instruments = {};
  result.type = 'r';

  return result;
}

/**
 * r2m: Regular → Multiple
 *
 * Converts regular track-based project to playlist-based with instruments.
 *
 * Process:
 * 1. Create playlists from tracks
 * 2. For instrument tracks, create instruments{} entries
 * 3. Handle lanes by creating separate playlists
 * 4. Move automation from ['track'] to ['inst']
 * 5. Clear tracks and set type='m'
 */
export function convertR2M(project: CVPJProject): CVPJProject {
  console.log('[TypeConversion] r2m: Regular → Multiple');

  const result = deepClone(project);
  result.playlists = result.playlists || {};
  result.playlist_order = result.playlist_order || [];
  result.instruments = result.instruments || {};
  result.instruments_order = result.instruments_order || [];

  let playlistNum = -1;

  for (const trackId of result.track_order || []) {
    const track = result.track_data?.[trackId];
    if (!track) continue;

    // Check if track uses instruments
    const usesInst = isInstrumentTrack(track);

    // Create playlists
    if (!track.lanes || Object.keys(track.lanes).length === 0) {
      // Non-laned track
      playlistNum++;
      const playlistId = playlistNum.toString();

      result.playlists[playlistId] = {
        visual: deepClone(track.visual || {}),
        placements: deepClone(track.placements || {}),
      };
      result.playlist_order.push(playlistId);

      // Add instrument reference to notes
      if (result.playlists[playlistId].placements?.notes) {
        addInstrumentToNotes(result.playlists[playlistId].placements.notes, trackId);
      }
    } else {
      // Laned track - create playlist per lane
      for (const [laneId, lane] of Object.entries(track.lanes)) {
        playlistNum++;
        const playlistId = playlistNum.toString();

        result.playlists[playlistId] = {
          visual: deepClone(track.visual || {}),
          placements: deepClone(lane.placements || {}),
        };

        if (lane.visual?.name) {
          result.playlists[playlistId].visual.name =
            `${track.visual?.name || ''} (${lane.visual.name})`;
        }

        result.playlist_order.push(playlistId);

        // Add instrument reference to notes
        if (result.playlists[playlistId].placements?.notes) {
          addInstrumentToNotes(result.playlists[playlistId].placements.notes, trackId);
        }
      }
    }

    // Create instrument if needed
    if (usesInst) {
      result.instruments[trackId] = {
        visual: deepClone(track.visual || {}),
        params: deepClone(track.params || {}),
        midi: deepClone(track.midi || {}),
        plugslots: deepClone(track.plugslots || {}),
        is_drum: track.is_drum,
      };
      result.instruments_order.push(trackId);
    }
  }

  // TODO: Move automation from ['track'] to ['inst']
  // This requires automation system implementation

  // Clear tracks
  result.track_data = {};
  result.track_order = [];
  result.type = 'm';

  return result;
}

/**
 * ri2r: Regular/Indexed → Regular
 *
 * Converts indexed notes to regular notes by expanding them using the note index.
 */
export function convertRI2R(project: CVPJProject): CVPJProject {
  console.log('[TypeConversion] ri2r: RegularIndexed → Regular');

  const result = deepClone(project);

  for (const track of Object.values(result.track_data || {})) {
    if (!track.lanes || Object.keys(track.lanes).length === 0) {
      // Unindex notes for non-laned track
      if (track.placements?.notes && track.notelist_index) {
        track.placements.notes = unindexNotes(
          track.placements.notes,
          track.notelist_index
        );
      }
    } else {
      // Unindex notes for each lane
      for (const lane of Object.values(track.lanes)) {
        if (lane.placements?.notes && track.notelist_index) {
          lane.placements.notes = unindexNotes(
            lane.placements.notes,
            track.notelist_index
          );
        }
      }
    }
  }

  result.type = 'r';
  return result;
}

/**
 * m2r: Multiple → Regular
 *
 * Converts playlist-based project to track-based.
 */
export function convertM2R(project: CVPJProject): CVPJProject {
  console.log('[TypeConversion] m2r: Multiple → Regular');

  const result = deepClone(project);
  result.track_data = {};
  result.track_order = [];

  // Create tracks from instruments
  for (const [instId, inst] of Object.entries(result.instruments || {})) {
    const trackId = instId;
    result.track_data[trackId] = {
      type: 'instrument',
      visual: deepClone(inst.visual || {}),
      params: deepClone(inst.params || {}),
      midi: deepClone(inst.midi || {}),
      plugslots: deepClone(inst.plugslots || {}),
      is_drum: inst.is_drum,
      placements: {},
      lanes: {},
    };
    result.track_order.push(trackId);
  }

  // Add placements from playlists to tracks (as lanes)
  for (const [playlistId, playlist] of Object.entries(result.playlists || {})) {
    // Split placements by instrument
    const instPlacements = splitPlacementsByInstrument(playlist.placements);

    for (const [instId, placements] of Object.entries(instPlacements)) {
      if (result.track_data[instId]) {
        const track = result.track_data[instId];
        if (!track.lanes) track.lanes = {};

        track.lanes[playlistId] = {
          visual: deepClone(playlist.visual || {}),
          placements: placements,
        };
      }
    }
  }

  // TODO: Move automation from ['inst'] to ['track']

  result.playlists = {};
  result.playlist_order = [];
  result.instruments = {};
  result.instruments_order = [];
  result.type = 'r';

  return result;
}

/**
 * rs2r: Regular/Scened → Regular
 *
 * Converts scene-based tracks to regular laned tracks.
 */
export function convertRS2R(project: CVPJProject): CVPJProject {
  console.log('[TypeConversion] rs2r: RegularScened → Regular');

  const result = deepClone(project);

  for (const track of Object.values(result.track_data || {})) {
    if (!track.scenes) continue;

    // Collect all unique lane IDs from scenes
    const laneIds = new Set<string>();
    for (const sceneData of Object.values(track.scenes)) {
      for (const laneId of Object.keys(sceneData)) {
        laneIds.add(laneId);
      }
    }

    // Create lanes
    if (!track.lanes) track.lanes = {};
    for (const laneId of laneIds) {
      if (!track.lanes[laneId]) {
        track.lanes[laneId] = {
          visual: {},
          placements: {},
        };
      }
    }

    // TODO: Merge scene placements into lanes
    // This requires scene_placements and scenes data
  }

  result.type = 'r';
  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract unique instrument IDs from a multi-instrument track
 */
function extractInstrumentsFromTrack(track: Track): string[] {
  const instruments = new Set<string>();

  // Check placements for instrument references
  if (track.placements?.notes) {
    for (const note of track.placements.notes as any[]) {
      if (note.inst) instruments.add(note.inst);
    }
  }

  // Check notes for instrument references
  if (track.notes) {
    for (const note of track.notes) {
      if ((note as any).inst) instruments.add((note as any).inst);
    }
  }

  return Array.from(instruments);
}

/**
 * Create a new track from instrument data
 */
function createTrackFromInstrument(
  sourceTrack: Track,
  instId: string,
  instrument?: Instrument
): Track {
  const newTrack: Track = {
    type: 'instrument',
    visual: deepClone(sourceTrack.visual || {}),
    params: deepClone(sourceTrack.params || {}),
    placements: {},
    plugslots: {},
  };

  if (instrument) {
    // Merge instrument data
    newTrack.plugslots = deepClone(instrument.plugslots || {});
    newTrack.is_drum = instrument.is_drum;

    // Merge visual name
    if (instrument.visual?.name) {
      if (newTrack.visual?.name) {
        newTrack.visual.name = `${instrument.visual.name} (${newTrack.visual.name})`;
      } else {
        newTrack.visual = newTrack.visual || {};
        newTrack.visual.name = instrument.visual.name;
      }
    }

    // Merge color
    if (instrument.visual?.color && !newTrack.visual?.color) {
      newTrack.visual = newTrack.visual || {};
      newTrack.visual.color = instrument.visual.color;
    }
  } else {
    // No instrument data, use ID as name
    newTrack.visual = newTrack.visual || {};
    newTrack.visual.name = instId;
  }

  return newTrack;
}

/**
 * Extract placements for a specific instrument
 */
function extractPlacementsForInstrument(track: Track, instId: string): any {
  if (!track.placements?.notes) return null;

  const filtered = (track.placements.notes as any[]).filter(
    note => note.inst === instId
  );

  return filtered.length > 0 ? filtered : null;
}

/**
 * Extract notes for a specific instrument
 */
function extractNotesForInstrument(track: Track, instId: string): any {
  if (!track.notes) return null;

  const filtered = track.notes.filter(
    note => (note as any).inst === instId
  );

  return filtered.length > 0 ? filtered : null;
}

/**
 * Check if track is an instrument track
 */
function isInstrumentTrack(track: Track): boolean {
  if (track.type === 'instruments') return true;
  if (track.type === 'instrument') return true;
  if (track.placements?.notes && (track.placements.notes as any[]).length > 0) return true;
  if (track.notes && track.notes.length > 0) return true;
  return false;
}

/**
 * Add instrument ID to all notes in placements
 */
function addInstrumentToNotes(placements: any, instId: string): void {
  if (Array.isArray(placements)) {
    for (const note of placements) {
      note.inst = instId;
    }
  } else if (placements && typeof placements === 'object') {
    // Handle nested structures
    for (const value of Object.values(placements)) {
      if (Array.isArray(value)) {
        for (const note of value) {
          if (note && typeof note === 'object') {
            note.inst = instId;
          }
        }
      }
    }
  }
}

/**
 * Unindex notes using the note index
 */
function unindexNotes(notes: any, noteIndex: any): any {
  // Simplified implementation - full version would expand indexed notes
  // using the noteIndex lookup table
  return notes;
}

/**
 * Split placements by instrument ID
 */
function splitPlacementsByInstrument(placements: any): Record<string, any> {
  const result: Record<string, any> = {};

  if (!placements) return result;

  // Extract notes and group by instrument
  const notes = placements.notes || [];
  for (const note of notes) {
    const instId = (note as any).inst || 'default';
    if (!result[instId]) {
      result[instId] = { notes: [] };
    }
    result[instId].notes.push(note);
  }

  return result;
}

/**
 * Main conversion dispatcher
 *
 * Automatically converts project to target type using the shortest path.
 */
export function convertProjectType(
  project: CVPJProject,
  targetType: ProjectType
): CVPJProject {
  const sourceType = project.type;

  if (sourceType === targetType) {
    return project; // No conversion needed
  }

  console.log(`[TypeConversion] Converting ${sourceType} → ${targetType}`);

  // Define conversion paths
  const conversions: Record<string, (p: CVPJProject) => CVPJProject> = {
    'rm->r': convertRM2R,
    'r->m': convertR2M,
    'ri->r': convertRI2R,
    'm->r': convertM2R,
    'rs->r': convertRS2R,
  };

  // Try direct conversion
  const directPath = `${sourceType}->${targetType}`;
  if (conversions[directPath]) {
    return conversions[directPath](project);
  }

  // Try multi-step conversion (e.g., rm -> r -> m)
  // For now, convert to 'r' first, then to target
  if (sourceType !== 'r') {
    let intermediate = project;

    // Convert to 'r' first
    if (sourceType === 'rm') intermediate = convertRM2R(intermediate);
    else if (sourceType === 'ri') intermediate = convertRI2R(intermediate);
    else if (sourceType === 'm') intermediate = convertM2R(intermediate);
    else if (sourceType === 'rs') intermediate = convertRS2R(intermediate);

    // Then convert from 'r' to target
    if (targetType === 'm') return convertR2M(intermediate);
    if (targetType === 'r') return intermediate;
  }

  console.warn(`[TypeConversion] No conversion path found for ${sourceType} → ${targetType}`);
  return project;
}
