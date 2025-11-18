/**
 * DawProject Type Definitions
 *
 * Phase 2: Extended implementation with automation, sends, and VST metadata
 * VST audio processing not supported (metadata only)
 */

// ============ Basic Types ============

export type ContentType = 'notes' | 'audio' | 'audio notes' | 'tracks';
export type ChannelRole = 'regular' | 'master' | 'effect';
export type TimeUnit = 'beats' | 'seconds';
export type DeviceRole = 'instrument' | 'audioFX' | 'noteFX';
export type PluginType = 'Vst2Plugin' | 'Vst3Plugin' | 'ClapPlugin';

// ============ Parameters ============

export interface DawParam<T = number> {
  value: T;
  name?: string;
  id?: string;
  unit?: string;
  min?: number;
  max?: number;
}

export interface DawBoolParam extends DawParam<boolean> {
  value: boolean;
}

export interface DawNumericParam extends DawParam<number> {
  value: number;
}

export interface DawPathParam {
  path: string;
  external?: boolean;
}

// ============ Transport ============

export interface DawTimeSignature {
  numerator: number;
  denominator: number;
}

export interface DawTransport {
  tempo: DawNumericParam;
  timeSignature: DawTimeSignature;
}

// ============ Application ============

export interface DawApplication {
  name: string;
  version: string;
}

// ============ Channel ============

export interface DawChannel {
  role?: ChannelRole;
  audioChannels?: number;
  destination?: string;
  solo?: boolean;
  id?: string;

  mute: DawBoolParam;
  pan: DawNumericParam;
  volume: DawNumericParam;

  // Phase 2:
  sends?: DawSend[];
  devices?: DawDevice[];
}

// ============ Track ============

export interface DawTrack {
  id?: string;
  name?: string;
  color?: string;
  contentType?: ContentType;
  loaded?: boolean;

  channel: DawChannel;
  tracks?: DawTrack[]; // Nested tracks (groups)
}

// ============ Notes ============

export interface DawNote {
  time: number;
  duration: number;
  key: number; // MIDI note number
  vel?: number; // Velocity (0-1)
  rel?: number; // Release velocity
  channel?: number; // MIDI channel

  // Phase 2:
  points?: DawPoints; // Per-note automation
  lanes?: DawLane; // Per-note lanes
}

export interface DawNotes {
  id?: string;
  notes: DawNote[];
}

// ============ Audio ============

export interface DawAudio {
  id?: string;
  file: DawPathParam;
  channels?: number;
  duration?: number;
  sampleRate?: number;
  algorithm?: string;
}

// ============ Clips ============

export interface DawClip {
  time: number;
  duration: number;
  timeUnit?: TimeUnit;
  contentTimeUnit?: TimeUnit;

  name?: string;
  color?: string;

  playStart?: number;
  playStop?: number;
  loopStart?: number;
  loopEnd?: number;

  fadeTimeUnit?: TimeUnit;
  fadeInTime?: number;
  fadeOutTime?: number;

  notes?: DawNotes;
  audio?: DawAudio;

  // Phase 2:
  clips?: DawClips; // Nested clips
  warps?: DawWarps;
  lanes?: DawLane;
}

export interface DawClips {
  clips: DawClip[];
}

// ============ Lanes ============

export interface DawLane {
  track?: string; // Track ID reference
  clips: DawClips;

  // Phase 2:
  points?: DawPoints[]; // Automation
}

export interface DawLaneContainer {
  id?: string;
  timeUnit?: TimeUnit;
  lanes: DawLane[];
}

// ============ Markers ============

export interface DawMarker {
  time: number;
  name?: string;
  color?: string;
}

export interface DawMarkers {
  id?: string;
  markers: DawMarker[];
}

// ============ Arrangement ============

export interface DawArrangement {
  id: string;
  lanes: DawLaneContainer;
  markers?: DawMarkers;

  // Phase 2:
  tempoAutomation?: DawPoints;
  timeSignatureAutomation?: DawTimeSigPoints;
}

// ============ Project ============

export interface DawProject {
  version: string;
  application: DawApplication;
  transport: DawTransport;
  structure: DawTrack[]; // Root-level tracks
  arrangement: DawArrangement;
  metadata?: Record<string, string>;
}

// ============ Metadata ============

export interface DawMetadata {
  Title?: string;
  Artist?: string;
  Album?: string;
  Genre?: string;
  Comment?: string;
  Year?: string;
  Copyright?: string;
  OriginalArtist?: string;
  Songwriter?: string;
  Producer?: string;
}

// ============ Phase 2: Automation ============

export interface DawPoint {
  time: number;
  value: number;
  curve?: number; // Curve amount for smooth interpolation
}

export interface DawBoolPoint {
  time: number;
  value: boolean;
}

export interface DawTarget {
  parameter?: string; // Parameter ID reference
  expression?: string; // Expression type (e.g., 'gain', 'pan', 'pitch', 'transpose')
}

export interface DawPoints {
  target?: DawTarget;
  points: DawPoint[];
  pointsBool?: DawBoolPoint[];
  unit?: string;
  id?: string;
}

export interface DawTimeSigPoint {
  time: number;
  numerator: number;
  denominator: number;
}

export interface DawTimeSigPoints {
  points: DawTimeSigPoint[];
}

// ============ Phase 2: Sends ============

export interface DawSend {
  destination: string; // Return track ID
  type?: string;
  id?: string;
  volume: DawNumericParam;
}

// ============ Phase 2: Devices (VST Metadata) ============

export interface DawRealParameter {
  parameterID: number;
  value: number;
  name?: string;
  id?: string;
}

export interface DawDevice {
  pluginType: PluginType;
  deviceRole?: DeviceRole;
  deviceName?: string;
  id?: string;
  enabled?: DawBoolParam;

  // VST2/VST3/CLAP specific
  state?: string; // Path to state file in ZIP
  vstId?: string; // VST unique ID
  clsid?: string; // VST3 CLSID
  realParameters?: DawRealParameter[]; // Parameter values
}

// ============ Phase 2: Warps ============

export interface DawWarpPoint {
  time: number; // Time in project
  contentTime: number; // Time in audio file
}

export interface DawWarps {
  id?: string;
  timeUnit?: TimeUnit;
  contentTimeUnit?: TimeUnit;
  audio?: DawAudio;
  points: DawWarpPoint[];
}
