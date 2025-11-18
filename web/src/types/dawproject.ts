/**
 * DawProject Type Definitions
 *
 * Basic implementation for browser-based conversion
 * VST plugins and advanced features are not supported in Phase 1
 */

// ============ Basic Types ============

export type ContentType = 'notes' | 'audio' | 'audio notes' | 'tracks';
export type ChannelRole = 'regular' | 'master' | 'effect';
export type TimeUnit = 'beats' | 'seconds';

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

  // Not implemented in Phase 1:
  // sends: DawSend[];
  // devices: DawDevice[];
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

  // Not implemented in Phase 1:
  // clips?: DawClips; // Nested clips
  // warps?: DawWarps;
  // lanes?: DawLane;
}

export interface DawClips {
  clips: DawClip[];
}

// ============ Lanes ============

export interface DawLane {
  track?: string; // Track ID reference
  clips: DawClips;

  // Not implemented in Phase 1:
  // points?: DawPoints[]; // Automation
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

  // Not implemented in Phase 1:
  // tempoAutomation?: DawPoints;
  // timeSignatureAutomation?: DawTimeSigPoints;
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
