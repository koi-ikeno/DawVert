/**
 * MIDI Helper Functions
 * Common utilities for MIDI file processing
 */

/**
 * Read variable-length quantity (VLQ) from DataView
 * Used in MIDI files for delta times and meta event lengths
 */
export function readVariableLength(
  view: DataView,
  offset: number
): { value: number; bytesRead: number } {
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

/**
 * Write variable-length quantity (VLQ) to array
 */
export function writeVariableLength(value: number): number[] {
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

/**
 * Read a string from DataView
 */
export function readString(view: DataView, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}

/**
 * MIDI message types
 */
export enum MidiMessageType {
  NoteOff = 0x80,
  NoteOn = 0x90,
  PolyphonicAftertouch = 0xa0,
  ControlChange = 0xb0,
  ProgramChange = 0xc0,
  ChannelAftertouch = 0xd0,
  PitchBend = 0xe0,
  SystemExclusive = 0xf0,
  MetaEvent = 0xff,
}

/**
 * MIDI meta event types
 */
export enum MidiMetaEventType {
  SequenceNumber = 0x00,
  TextEvent = 0x01,
  CopyrightNotice = 0x02,
  TrackName = 0x03,
  InstrumentName = 0x04,
  Lyric = 0x05,
  Marker = 0x06,
  CuePoint = 0x07,
  ChannelPrefix = 0x20,
  EndOfTrack = 0x2f,
  SetTempo = 0x51,
  SMPTEOffset = 0x54,
  TimeSignature = 0x58,
  KeySignature = 0x59,
  SequencerSpecific = 0x7f,
}

/**
 * MIDI control change numbers
 */
export enum MidiControlChange {
  BankSelect = 0x00,
  ModulationWheel = 0x01,
  BreathController = 0x02,
  FootController = 0x04,
  PortamentoTime = 0x05,
  DataEntry = 0x06,
  Volume = 0x07,
  Balance = 0x08,
  Pan = 0x0a,
  Expression = 0x0b,
  EffectControl1 = 0x0c,
  EffectControl2 = 0x0d,
  GeneralPurpose1 = 0x10,
  GeneralPurpose2 = 0x11,
  GeneralPurpose3 = 0x12,
  GeneralPurpose4 = 0x13,
  Sustain = 0x40,
  Portamento = 0x41,
  Sostenuto = 0x42,
  SoftPedal = 0x43,
  Legato = 0x44,
  Hold2 = 0x45,
  SoundController1 = 0x46,
  SoundController2 = 0x47,
  SoundController3 = 0x48,
  SoundController4 = 0x49,
  SoundController5 = 0x4a,
  SoundController6 = 0x4b,
  SoundController7 = 0x4c,
  SoundController8 = 0x4d,
  SoundController9 = 0x4e,
  SoundController10 = 0x4f,
  GeneralPurpose5 = 0x50,
  GeneralPurpose6 = 0x51,
  GeneralPurpose7 = 0x52,
  GeneralPurpose8 = 0x53,
  PortamentoControl = 0x54,
  Effects1Depth = 0x5b,
  Effects2Depth = 0x5c,
  Effects3Depth = 0x5d,
  Effects4Depth = 0x5e,
  Effects5Depth = 0x5f,
  AllSoundOff = 0x78,
  ResetAllControllers = 0x79,
  LocalControl = 0x7a,
  AllNotesOff = 0x7b,
  OmniModeOff = 0x7c,
  OmniModeOn = 0x7d,
  MonoModeOn = 0x7e,
  PolyModeOn = 0x7f,
}

/**
 * General MIDI instrument numbers
 */
export const GM_INSTRUMENTS = [
  // Piano (0-7)
  'Acoustic Grand Piano',
  'Bright Acoustic Piano',
  'Electric Grand Piano',
  'Honky-tonk Piano',
  'Electric Piano 1',
  'Electric Piano 2',
  'Harpsichord',
  'Clavinet',
  // Chromatic Percussion (8-15)
  'Celesta',
  'Glockenspiel',
  'Music Box',
  'Vibraphone',
  'Marimba',
  'Xylophone',
  'Tubular Bells',
  'Dulcimer',
  // Organ (16-23)
  'Drawbar Organ',
  'Percussive Organ',
  'Rock Organ',
  'Church Organ',
  'Reed Organ',
  'Accordion',
  'Harmonica',
  'Tango Accordion',
  // Guitar (24-31)
  'Acoustic Guitar (nylon)',
  'Acoustic Guitar (steel)',
  'Electric Guitar (jazz)',
  'Electric Guitar (clean)',
  'Electric Guitar (muted)',
  'Overdriven Guitar',
  'Distortion Guitar',
  'Guitar Harmonics',
  // Bass (32-39)
  'Acoustic Bass',
  'Electric Bass (finger)',
  'Electric Bass (pick)',
  'Fretless Bass',
  'Slap Bass 1',
  'Slap Bass 2',
  'Synth Bass 1',
  'Synth Bass 2',
  // Strings (40-47)
  'Violin',
  'Viola',
  'Cello',
  'Contrabass',
  'Tremolo Strings',
  'Pizzicato Strings',
  'Orchestral Harp',
  'Timpani',
  // Ensemble (48-55)
  'String Ensemble 1',
  'String Ensemble 2',
  'Synth Strings 1',
  'Synth Strings 2',
  'Choir Aahs',
  'Voice Oohs',
  'Synth Choir',
  'Orchestra Hit',
  // Brass (56-63)
  'Trumpet',
  'Trombone',
  'Tuba',
  'Muted Trumpet',
  'French Horn',
  'Brass Section',
  'Synth Brass 1',
  'Synth Brass 2',
  // Reed (64-71)
  'Soprano Sax',
  'Alto Sax',
  'Tenor Sax',
  'Baritone Sax',
  'Oboe',
  'English Horn',
  'Bassoon',
  'Clarinet',
  // Pipe (72-79)
  'Piccolo',
  'Flute',
  'Recorder',
  'Pan Flute',
  'Blown bottle',
  'Shakuhachi',
  'Whistle',
  'Ocarina',
  // Synth Lead (80-87)
  'Lead 1 (square)',
  'Lead 2 (sawtooth)',
  'Lead 3 (calliope)',
  'Lead 4 (chiff)',
  'Lead 5 (charang)',
  'Lead 6 (voice)',
  'Lead 7 (fifths)',
  'Lead 8 (bass + lead)',
  // Synth Pad (88-95)
  'Pad 1 (new age)',
  'Pad 2 (warm)',
  'Pad 3 (polysynth)',
  'Pad 4 (choir)',
  'Pad 5 (bowed)',
  'Pad 6 (metallic)',
  'Pad 7 (halo)',
  'Pad 8 (sweep)',
  // Synth Effects (96-103)
  'FX 1 (rain)',
  'FX 2 (soundtrack)',
  'FX 3 (crystal)',
  'FX 4 (atmosphere)',
  'FX 5 (brightness)',
  'FX 6 (goblins)',
  'FX 7 (echoes)',
  'FX 8 (sci-fi)',
  // Ethnic (104-111)
  'Sitar',
  'Banjo',
  'Shamisen',
  'Koto',
  'Kalimba',
  'Bagpipe',
  'Fiddle',
  'Shanai',
  // Percussive (112-119)
  'Tinkle Bell',
  'Agogo',
  'Steel Drums',
  'Woodblock',
  'Taiko Drum',
  'Melodic Tom',
  'Synth Drum',
  'Reverse Cymbal',
  // Sound effects (120-127)
  'Guitar Fret Noise',
  'Breath Noise',
  'Seashore',
  'Bird Tweet',
  'Telephone Ring',
  'Helicopter',
  'Applause',
  'Gunshot',
];

/**
 * Get GM instrument name by number
 */
export function getGMInstrumentName(number: number): string {
  if (number >= 0 && number < GM_INSTRUMENTS.length) {
    return GM_INSTRUMENTS[number];
  }
  return `Unknown (${number})`;
}
