# DawVert Web Plugins

This directory contains format plugins for DawVert Web. Each plugin is responsible for parsing a specific DAW or music project format.

## Plugin Architecture

Plugins are divided into two types:

1. **Input Plugins** - Parse project files into the CVPJ (Common Virtual Project) format
2. **Output Plugins** - Generate project files from CVPJ format

## Implementing a Plugin

### Input Plugin

Input plugins must implement the `InputPlugin` interface:

```typescript
import type { InputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig } from '@/types/cvpj';

export class MyFormatInputPlugin implements InputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'My Format',
      shortname: 'myformat',
      file_ext: ['myf', 'myfmt'],
      file_ext_detect: true,
      projtype: 'r', // Project type: r, m, mi, rm, ri, ms, rs
      supported_autodetect: true,
    };
  }

  async detect(file: File): Promise<boolean> {
    // Read file header and check if it matches this format
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new DataView(buffer);
    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    return magic === 'MYFM';
  }

  async parse(file: File, config: ConversionConfig): Promise<CVPJProject> {
    // Parse the file and return a CVPJ project
    const buffer = await file.arrayBuffer();

    const project: CVPJProject = {
      type: 'r',
      time_ppq: 96,
      time_float: false,
      track_data: {},
      track_order: [],
      timesig: [4, 4],
      // ... other project data
    };

    // Parse file and populate project
    // ...

    return project;
  }

  isUsable(): { usable: boolean; message: string } {
    // Check if the plugin can be used (e.g., dependencies available)
    return { usable: true, message: '' };
  }
}
```

### Output Plugin

Output plugins must implement the `OutputPlugin` interface:

```typescript
import type { OutputPlugin } from '@/lib/plugin-system';
import type { CVPJProject, PluginInfo, ConversionConfig, ProjectType } from '@/types/cvpj';

export class MyFormatOutputPlugin implements OutputPlugin {
  getInfo(): PluginInfo {
    return {
      name: 'My Format',
      shortname: 'myformat',
      file_ext: ['myf'],
      file_ext_detect: true,
      projtype: 'r',
    };
  }

  getType(): ProjectType {
    return 'r'; // Must match projtype in getInfo()
  }

  async parse(project: CVPJProject, config: ConversionConfig): Promise<Blob> {
    // Generate output file from CVPJ project

    // Build your format's data structure
    const outputData = this.buildOutputData(project);

    // Convert to binary or text
    const blob = new Blob([outputData], { type: 'application/octet-stream' });

    return blob;
  }

  isUsable(): { usable: boolean; message: string } {
    return { usable: true, message: '' };
  }

  private buildOutputData(project: CVPJProject): ArrayBuffer {
    // Implement format generation
    // ...
    return new ArrayBuffer(0);
  }
}
```

### Registering a Plugin

Add your plugin to `src/plugins/index.ts`:

```typescript
import { pluginRegistry } from '@/lib/plugin-system';
import { MyFormatInputPlugin } from './input-myformat';
import { MyFormatOutputPlugin } from './output-myformat';

export function registerPlugins(): void {
  // Existing plugins
  pluginRegistry.registerInput('midi', new MidiInputPlugin());
  pluginRegistry.registerOutput('midi', new MidiOutputPlugin());

  // Your new plugin
  pluginRegistry.registerInput('myformat', new MyFormatInputPlugin());
  pluginRegistry.registerOutput('myformat', new MyFormatOutputPlugin());
}
```

## Project Types

CVPJ supports different project type representations:

- **r** (Regular) - Single timeline with tracks
- **ri** (RegularIndexed) - Regular with pattern/clip indexing
- **rm** (RegularMultiple) - Regular with multiple instruments per track
- **rs** (RegularScened) - Regular with scene/clip launcher
- **m** (Multiple) - Multiple playlists
- **mi** (MultipleIndexed) - Multiple playlists with indexing
- **ms** (MultipleScened) - Multiple playlists with scenes

## Utilities

Common utilities are available in `src/lib/utils.ts`:

- `readFileAsArrayBuffer(file)` - Read file as ArrayBuffer
- `readFileAsText(file)` - Read file as text
- `readFileAsJSON(file)` - Read file as JSON
- `parseXML(xmlString)` - Parse XML string
- `createBlobFromJSON(data)` - Create JSON blob
- `clamp(value, min, max)` - Clamp value
- `mapRange(value, ...)` - Map value between ranges
- And many more...

## Currently Implemented Plugins

### Input Plugins

- **midi** - MIDI file parser (`.mid`, `.midi`)

### Output Plugins

- **midi** - MIDI file generator (`.mid`)

## Planned Plugins

Future plugin implementations:

- FL Studio (FLP)
- LMMS (MMP)
- Ableton Live (ALS)
- Reaper (RPP)
- DawProject (DAWPROJECT)
- Online Sequencer (SEQUENCE)
- Beepbox/Jummbox (JSON)

## Testing

Test your plugin by:

1. Creating a sample file in the format
2. Using the web UI to convert it
3. Checking the console for errors
4. Verifying the output file

## Contributing

When implementing a new plugin:

1. Follow the existing code style
2. Add comprehensive error handling
3. Document any format-specific quirks
4. Update this README with your plugin
5. Add sample files for testing (if possible)

## Resources

- [Original DawVert Repository](https://github.com/SatyrDiamond/DawVert)
- [CVPJ Documentation](https://github.com/SatyrDiamond/DawVert/tree/main/docs)
- [MIDI Specification](https://www.midi.org/specifications)
