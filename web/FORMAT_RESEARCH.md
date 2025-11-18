# Format Research for Browser Implementation

Research conducted: 2025-11-18

## Objective

Investigate additional formats beyond MIDI and Soundation for browser-based implementation in DawVert Web.

---

## Research Scope

Analyzed formats across three categories:
1. **JSON-based formats** - Pure JSON or JSON with minimal dependencies
2. **XML/Text formats** - XML or proprietary text formats
3. **Binary formats** - Binary with or without compression

---

## Format Analysis

### JSON-Based Formats

#### 1. Jummbox/Beepbox (.json)
- **Complexity**: HIGH
- **Project Type**: `mi` (Multiple/Indexed)
- **Dependencies**:
  - External chip wave file (`beepbox_shapes.txt`)
  - Dataset files (`beepbox.dset`)
  - Color scheme data
- **Instrument Types**: chip, PWM, harmonics, FM, FM6op, spectrum, Picked String, custom chip
- **Features**:
  - Complex modulation system
  - Per-note automation (gain, pitch bend)
  - Multiple instrument types per channel
  - Custom waveforms
- **Browser Feasibility**: ❌ LOW
  - Requires external data files not available in browser
  - Complex FM synthesis would need significant porting
  - Dataset system needs alternative implementation

#### 2. Wavtool (.ftr)
- **Complexity**: VERY HIGH
- **Format**: JSON + ZIP
- **Dependencies**:
  - VST2/VST3 plugin support
  - JUCE MemoryBlock parsing
  - Base64 encoded wavetables
  - External audio samples
- **Features**:
  - Custom wavetable synth
  - 4 envelopes, 3 LFOs
  - VST plugin hosting
- **Browser Feasibility**: ❌ VERY LOW
  - VST support impossible in browser
  - Complex wavetable synthesis
  - Requires ZIP and binary parsing

#### 3. Amped Studio (.ampedstudio)
- **Complexity**: VERY HIGH
- **Format**: JSON
- **Dependencies**:
  - WAM (Web Audio Modules) plugins
  - Complex plugin system (Europa, OBXD, Augur)
  - External audio samples
- **Features**:
  - Professional DAW features
  - Complex routing
  - Advanced synthesis
- **Browser Feasibility**: ⚠️ MEDIUM
  - Already web-based (good sign)
  - But Python parser is very complex
  - WAM support would need investigation
  - Potentially viable but requires significant work

#### 4. FruityTracks (.ftr)
- **Complexity**: MEDIUM
- **Format**: Binary with magic number `FThd` + JSON
- **Features**:
  - Audio-only (no MIDI)
  - Simple track/clip structure
  - Volume/pan automation
  - Sample stretching
- **Browser Feasibility**: ⚠️ MEDIUM
  - Mixed binary/JSON format
  - Audio-focused (simpler than MIDI-focused)
  - Would need binary parsing

#### 5. PiyoPiyo (.pmd)
- **Complexity**: MEDIUM
- **Format**: Binary with magic number `PMD`
- **Dependencies**:
  - External audio samples (BASS1.wav, SNARE1.wav, etc.)
  - Dataset file (`piyopiyo.dset`)
- **Features**:
  - Simple 3-channel + drums
  - Custom waveforms
  - Basic envelopes
- **Browser Feasibility**: ❌ LOW
  - Requires external sample files
  - Binary format parsing
  - Dataset dependency

#### 6. Notessimo V2 (.note)
- **Complexity**: MEDIUM
- **Format**: Binary (zlib compressed)
- **Project Type**: `ms` (Multiple/Scened)
- **Dependencies**:
  - Dataset file (`notessimo_v2.dset`)
  - MIDI instrument mapping
- **Features**:
  - 9 layers
  - Scene-based structure
  - Basic note data
- **Browser Feasibility**: ⚠️ LOW-MEDIUM
  - Requires zlib decompression (available in browser)
  - Binary format parsing needed
  - Dataset dependency issue

### XML/Text Formats

#### 1. LMMS (.mmp, .mmpz)
- **Complexity**: VERY HIGH
- **Format**: XML (optionally ZIP compressed)
- **Dependencies**:
  - VST2/VST3 plugin database
  - External plugin system
  - Sample search paths
  - Dataset files
- **Features**:
  - Full DAW with VST support
  - Native instruments (SID, OPL, ZynAddSubFX, etc.)
  - Complex routing
  - Automation system
- **Plugin Types**:
  - VST2/VST3 (with chunk data)
  - Native LMMS instruments
  - External sample files
- **Browser Feasibility**: ❌ VERY LOW
  - VST support impossible
  - Complex native instruments would need full reimplementation
  - External plugin database required
  - Sample path resolution issues

#### 2. Reaper (.rpp)
- **Complexity**: HIGH
- **Format**: Proprietary text format
- **Dependencies**:
  - Uses `rpp` Python library for parsing
  - VST/FX plugin support
  - Complex routing
- **Browser Feasibility**: ⚠️ MEDIUM
  - Text-based (good for browser)
  - But requires custom parser implementation
  - No existing JavaScript `rpp` library
  - VST support issue

#### 3. DawProject (.dawproject)
- **Complexity**: HIGH
- **Format**: ZIP + XML standard
- **Dependencies**:
  - Standard but comprehensive
  - Plugin mapping
  - Audio file references
- **Browser Feasibility**: ⚠️ MEDIUM-HIGH
  - Standard format (good documentation)
  - ZIP support already implemented
  - XML parsing available in browser
  - Could be a good candidate with effort

### Binary Formats

#### 1. FL Studio (.flp)
- **Complexity**: VERY HIGH
- **Format**: Proprietary binary
- **Browser Feasibility**: ❌ VERY LOW
  - Complex binary format
  - Requires extensive reverse engineering
  - No public specification

#### 2. Ableton Live (.als)
- **Complexity**: VERY HIGH
- **Format**: GZIP + XML
- **Browser Feasibility**: ❌ VERY LOW
  - Complex XML structure
  - Extensive plugin system
  - Sample management

#### 3. Online Sequencer (.sequence)
- **Complexity**: VERY HIGH
- **Format**: Protobuf binary
- **Dependencies**:
  - Uses `blackboxprotobuf` Python library
  - Custom message structure
- **Browser Feasibility**: ❌ LOW
  - Requires protobuf.js or similar
  - Complex parameter system
  - No protobuf schema available

---

## Key Findings

### Why Most Formats Are Complex

1. **External Dependencies**:
   - Dataset files for instrument/parameter definitions
   - External audio samples
   - Plugin databases (VST2/VST3)
   - Color schemes and UI data

2. **Plugin Systems**:
   - Most DAWs support VST plugins (impossible in browser without audio)
   - Native instruments require significant synthesis code
   - Parameter mapping systems are complex

3. **Project Type Complexity**:
   - Soundation was type `r` (Regular - simplest)
   - Many formats use `mi`, `ms`, `rm` (more complex architectures)

4. **Binary Formats**:
   - Require extensive parsing code
   - Often compressed (zlib, gzip)
   - Protobuf needs external libraries

### Why Soundation Was Ideal

✅ **Simple JSON format**
✅ **Type `r` (Regular) project structure**
✅ **No external dependencies**
✅ **Self-contained plugin definitions**
✅ **Clear parameter mappings**
✅ **Both input and output plugins exist**

---

## Recommendations

### Tier 1: Potentially Viable (Medium Effort)

1. **DawProject (.dawproject)** - ⭐ RECOMMENDED
   - Standard format with documentation
   - ZIP + XML (both available in browser)
   - Growing adoption
   - **Estimated Effort**: 2-3 weeks

2. **Amped Studio (.ampedstudio)** - ⭐ INTERESTING
   - Already web-based
   - JSON format
   - But complex plugin system
   - **Estimated Effort**: 2-4 weeks

### Tier 2: High Effort but Possible

3. **Reaper (.rpp)**
   - Text-based (good for browser)
   - Needs custom parser
   - VST support limited
   - **Estimated Effort**: 3-4 weeks

4. **LMMS (.mmp) - Basic Subset**
   - XML parsing available
   - Could support only basic instruments (no VST)
   - Sample playback limited
   - **Estimated Effort**: 4-6 weeks (for basic support)

### Tier 3: Not Recommended for Near Term

- FL Studio (.flp) - Requires significant reverse engineering
- Ableton Live (.als) - Too complex
- Online Sequencer (.sequence) - Protobuf dependency
- Jummbox (.json) - External data dependencies
- Most binary formats - Parsing complexity

---

## Alternative Approaches

### 1. Enhance Existing Implementation

Instead of adding complex formats, improve what we have:

- ✅ Better error handling and validation
- ✅ Progress indicators during conversion
- ✅ File preview before conversion
- ✅ Better UI/UX
- ✅ Web Workers for heavy processing
- ✅ Batch conversion support
- ✅ More type conversions (5/10 currently)
- ✅ More plugin converters (6 currently)

### 2. Simple Format Variants

- **MIDI Type 0/1/2 enhancements** - Better metadata, sysex support
- **Soundation variants** - Handle edge cases, more effects
- **Simple JSON exports** - Create our own simple format for testing

### 3. Modular Implementation Strategy

For complex formats like LMMS or DawProject:
- Phase 1: Basic project structure (tempo, tracks, notes)
- Phase 2: Simple effects (EQ, delay, reverb)
- Phase 3: Basic instruments (oscillators, samples)
- Phase 4: Advanced features (automation, routing)

---

## Conclusion

After extensive research, most formats are **significantly more complex** than Soundation. The primary challenges are:

1. **External dependencies** (datasets, plugins, samples)
2. **VST support** (impossible in browser context)
3. **Binary formats** (require extensive parsing)
4. **Complex synthesis** (FM, wavetable, etc.)

### Recommended Next Steps

**Option A: DawProject Implementation** (Best ROI)
- Standard format
- Browser-compatible (XML + ZIP)
- Growing adoption
- Good documentation

**Option B: Enhancement Phase** (Lower Risk)
- Improve existing MIDI/Soundation support
- Better UI/UX
- More robust error handling
- Complete remaining type conversions
- Add more plugin converters

**Option C: Amped Studio Research** (High Risk, High Reward)
- Already web-based
- JSON format
- But needs deeper investigation

---

## Formats Summary Table

| Format | Type | Complexity | Browser Viable | Effort | Priority |
|--------|------|------------|----------------|--------|----------|
| **DawProject** | ZIP+XML | High | ✅ Yes | 2-3 weeks | ⭐⭐⭐ |
| **Amped Studio** | JSON | Very High | ⚠️ Maybe | 2-4 weeks | ⭐⭐ |
| **Reaper** | Text | High | ⚠️ Maybe | 3-4 weeks | ⭐ |
| **LMMS (Basic)** | XML | Very High | ⚠️ Partial | 4-6 weeks | ⭐ |
| **Jummbox** | JSON | High | ❌ No | N/A | - |
| **Wavtool** | JSON+ZIP | Very High | ❌ No | N/A | - |
| **PiyoPiyo** | Binary | Medium | ❌ No | N/A | - |
| **Notessimo V2** | Binary | Medium | ⚠️ Maybe | 3 weeks | - |
| **FL Studio** | Binary | Very High | ❌ No | N/A | - |
| **Ableton** | GZIP+XML | Very High | ❌ No | N/A | - |
| **Online Seq** | Protobuf | Very High | ❌ No | N/A | - |

---

**Research Status**: Complete
**Next Action Required**: Decision on implementation priority
