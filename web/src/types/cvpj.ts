/**
 * CVPJ (Common Virtual Project) Type Definitions
 * TypeScript port of DawVert's internal project representation
 */

// Project Types
export type ProjectType = 'r' | 'ri' | 'rm' | 'rs' | 'm' | 'mi' | 'ms';

export const ProjectTypeNames: Record<ProjectType, string> = {
  r: 'Regular',
  ri: 'RegularIndexed',
  rm: 'RegularMultiple',
  rs: 'RegularScened',
  m: 'Multiple',
  mi: 'MultipleIndexed',
  ms: 'MultipleScened',
};

// Visual Data
export interface Visual {
  name?: string;
  color?: string;
  [key: string]: any;
}

export interface VisualUI {
  height?: number;
  width?: number;
  [key: string]: any;
}

// Parameters
export interface ParamValue {
  value: number;
  type?: string;
}

export interface ParamSet {
  [key: string]: ParamValue | number;
}

// Automation
export interface AutoPoint {
  position: number;
  value: number;
  type?: 'normal' | 'instant' | 'curve';
  tension?: number;
}

export interface AutomationData {
  points: AutoPoint[];
}

export interface Automation {
  [path: string]: AutomationData;
}

// Plugin
export interface PluginState {
  [key: string]: any;
}

export interface Plugin {
  type: string;
  subtype?: string;
  name?: string;
  enabled?: boolean;
  params?: ParamSet;
  state?: PluginState;
  datavals?: any;
  visual?: Visual;
}

export interface PluginSlot {
  plugin?: Plugin;
  [key: string]: any;
}

// Sample Reference
export interface SampleRef {
  fileref?: string;
  found?: boolean;
  fileformat?: string;
  filepath?: string;
  duration?: number;
  samplerate?: number;
  channels?: number;
  [key: string]: any;
}

// Note Data
export interface Note {
  position: number;
  duration: number;
  key: number;
  velocity?: number;
  pan?: number;
  [key: string]: any;
}

export interface NoteList {
  notes: Note[];
}

// Placements
export interface Placement {
  position: number;
  duration: number;
  cut_type?: string;
  muted?: boolean;
  visual?: Visual;
  [key: string]: any;
}

export interface NotePlacement extends Placement {
  notelist?: NoteList;
  notelistindex?: string;
}

export interface AudioPlacement extends Placement {
  sample?: string;
  stretch?: any;
  [key: string]: any;
}

export interface Placements {
  notes?: NotePlacement[];
  audio?: AudioPlacement[];
  [key: string]: any;
}

// Track
export interface Track {
  type?: string;
  visual?: Visual;
  visual_ui?: VisualUI;
  params?: ParamSet;
  placements?: Placements;
  plugslots?: PluginSlot[];
  inst?: string;
  sends?: any;
  fxslots_audio?: PluginSlot[];
  [key: string]: any;
}

// Instrument
export interface Instrument {
  visual?: Visual;
  params?: ParamSet;
  plugslots?: PluginSlot[];
  notelistindex?: { [key: string]: NoteList };
  [key: string]: any;
}

// Playlist
export interface PlaylistItem {
  position: number;
  duration: number;
  track?: string;
  visual?: Visual;
  [key: string]: any;
}

export interface Playlist {
  items: PlaylistItem[];
  visual?: Visual;
}

// Time Signature
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

// Time Marker
export interface TimeMarker {
  position: number;
  name?: string;
  type?: string;
  [key: string]: any;
}

// Metadata
export interface Metadata {
  name?: string;
  author?: string;
  comment?: string;
  genre?: string;
  bpm?: number;
  [key: string]: any;
}

// Scene
export interface Scene {
  visual?: Visual;
  [key: string]: any;
}

export interface ScenePlacement {
  position: number;
  duration: number;
  id: string;
}

// Main Project Structure
export interface CVPJProject {
  type: ProjectType;
  fxtype?: string;

  // Timing
  time_ppq: number;
  time_float: boolean;

  // Tracks and Instruments
  track_data: { [id: string]: Track };
  track_order: string[];
  track_master?: Track;
  track_returns?: { [id: string]: Track };
  instruments?: { [id: string]: Instrument };
  instruments_order?: string[];

  // Plugins
  plugins?: { [id: string]: Plugin };

  // Samples
  sample_index?: { [id: string]: any };
  samplerefs?: { [id: string]: SampleRef };
  filerefs?: { [id: string]: any };

  // Note Lists
  notelist_index?: { [id: string]: NoteList };

  // Parameters
  params?: ParamSet;

  // Effects
  fxrack?: { [id: string]: any };

  // Routing
  trackroute?: { [key: string]: any };

  // Playlist
  playlist?: { [id: string]: Playlist };

  // Time Signature
  timesig: TimeSignature;
  timesig_auto?: any;

  // Actions
  do_actions?: string[];

  // Time Markers
  timemarkers?: TimeMarker[];

  // Metadata
  metadata?: Metadata;

  // Loop
  loop_active?: boolean;
  loop_start?: number;
  loop_end?: number;
  start_pos?: number;

  // Window Data
  window_data?: { [key: string]: any };

  // Automation
  automation?: Automation;

  // Groups
  groups?: { [id: string]: any };

  // Sample Folders
  sample_folders?: string[];

  // Scenes
  scenes?: { [id: string]: Scene };
  scene_placements?: ScenePlacement[];
}

// Plugin Info
export interface PluginInfo {
  name: string;
  shortname: string;
  file_ext: string[];
  file_ext_detect?: boolean;
  projtype?: ProjectType;
  supported_autodetect?: boolean;
  [key: string]: any;
}

// Conversion Config
export interface ConversionConfig {
  path_samples_extracted?: string;
  path_samples_downloaded?: string;
  path_samples_generated?: string;
  path_samples_converted?: string;
  songnum?: number;
  searchpaths?: string[];
  flags_convproj?: string[];
  flags_core?: string[];
  [key: string]: any;
}
