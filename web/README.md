# DawVert Web

Web browser version of [DawVert](https://github.com/SatyrDiamond/DawVert) - a DAW project converter.

## Features

- 🌐 **Runs entirely in your browser** - No server uploads, all processing is done locally
- 🔒 **Privacy-focused** - Your project files never leave your device
- 🎵 **Format conversion** - Convert between different DAW project formats
- 🎨 **Modern UI** - Clean, responsive interface built with React and TypeScript
- ⚡ **Fast** - TypeScript implementation with optimized performance

## Supported Formats

### Fully Implemented

#### Input & Output
- **MIDI** (.mid, .midi) - Full MIDI file support with note events, tempo, time signature

### Planned (Stubs Available)

The following formats are registered in the system but not yet implemented. They will show "(Not Yet Implemented)" in the UI:

#### Input Formats
- FL Studio (.flp)
- LMMS (.mmp, .mmpz)
- Ableton Live (.als)
- Reaper (.rpp)
- DawProject (.dawproject)
- Online Sequencer (.sequence)
- Beepbox/Jummbox (.json)

#### Output Formats
- FL Studio (.flp)
- LMMS (.mmp)
- Ableton Live (.als)
- Reaper (.rpp)
- DawProject (.dawproject)
- Online Sequencer (.sequence)
- Waveform (.tracktionedit)
- Amped Studio (.ampedstudio)
- Soundation (.sng)

## Development

### Prerequisites

- Node.js 18+ (or use without npm - see below)
- npm or yarn

### Installation

```bash
cd web
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Running Without npm

If you don't have access to npm registries, you can still run the project by:

1. Opening `index.html` in a modern web browser with ES modules support
2. Using a local development server (e.g., Python's `http.server`)

```bash
# In the web directory
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

Note: Without a proper build setup, some features may not work correctly. For best results, use the npm-based development workflow.

## Project Structure

```
web/
├── src/
│   ├── components/     # React components (future)
│   ├── lib/           # Core conversion libraries
│   │   ├── converter.ts      # Main conversion orchestrator
│   │   └── plugin-system.ts  # Plugin registry and management
│   ├── plugins/       # Format plugins
│   │   ├── input-midi.ts     # MIDI input plugin
│   │   ├── output-midi.ts    # MIDI output plugin
│   │   └── index.ts          # Plugin registration
│   ├── types/         # TypeScript type definitions
│   │   └── cvpj.ts           # CVPJ project types
│   ├── App.tsx        # Main React app
│   ├── App.css        # Styles
│   └── main.tsx       # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture

DawVert Web follows the same plugin-based architecture as the original DawVert:

1. **Input Plugins** - Parse various DAW formats into a common CVPJ (Common Virtual Project) format
2. **CVPJ Core** - Internal representation of music projects
3. **Type Conversion** - Convert between different project type representations (Regular, Multiple, Indexed, etc.)
4. **Plugin Conversion** - Map plugins/effects between different DAWs
5. **Output Plugins** - Generate output files in target DAW formats

### Adding New Format Support

See `src/plugins/README.md` for detailed documentation on implementing new plugins.

Quick overview:

1. Create an input plugin in `src/plugins/input-<format>.ts`
2. Implement the `InputPlugin` interface
3. Create an output plugin in `src/plugins/output-<format>.ts`
4. Implement the `OutputPlugin` interface
5. Register both plugins in `src/plugins/index.ts` (replace the stub with your implementation)

Example minimal plugin:

```typescript
import type { InputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig } from '@/types/cvpj';
import { readFileAsArrayBuffer } from '@/lib/utils';

export class MyFormatInputPlugin implements InputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'My Format',
      shortname: 'myformat',
      file_ext: ['myf'],
      projtype: 'r',
      supported_autodetect: true,
    };
  }

  async detect(file: File): Promise<boolean> {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new DataView(buffer);
    // Check magic number or file signature
    return view.getUint32(0) === 0x4D594621; // Example
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    const buffer = await readFileAsArrayBuffer(file);
    // Parse and return CVPJ project
    return {
      type: 'r',
      time_ppq: 96,
      time_float: false,
      track_data: {},
      track_order: [],
      timesig: [4, 4],
    };
  }

  isUsable(): { usable: boolean; message: string } {
    return { usable: true, message: '' };
  }
}
```

Utilities available in `src/lib/utils.ts`:
- File reading (ArrayBuffer, Text, JSON, XML)
- Binary data manipulation
- MIDI/audio conversions
- And more...

## License

GPL-3.0-or-later

This is a web port of [DawVert](https://github.com/SatyrDiamond/DawVert) by SatyrDiamond.

## Credits

- Original DawVert by [SatyrDiamond](https://github.com/SatyrDiamond)
- Web port developed for browser-based DAW conversion
