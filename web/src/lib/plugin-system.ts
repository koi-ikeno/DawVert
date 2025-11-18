/**
 * Plugin System for DawVert Web
 * Manages input/output plugins for format conversion
 */

import type { CVPJProject, PluginInfo, ConversionConfig, ProjectType } from '@/types/cvpj';

export type PluginType = 'input' | 'output';

export interface BasePlugin {
  getInfo(): PluginInfo;
  isUsable(): { usable: boolean; message: string };
}

export interface InputPlugin extends BasePlugin {
  detect(file: File): Promise<boolean>;
  parse(file: File, config: ConversionConfig): Promise<CVPJProject>;
}

export interface OutputPlugin extends BasePlugin {
  getType(): ProjectType;
  parse(project: CVPJProject, config: ConversionConfig): Promise<Blob>;
}

export class PluginRegistry {
  private inputPlugins: Map<string, InputPlugin> = new Map();
  private outputPlugins: Map<string, OutputPlugin> = new Map();

  registerInput(shortname: string, plugin: InputPlugin): void {
    this.inputPlugins.set(shortname, plugin);
  }

  registerOutput(shortname: string, plugin: OutputPlugin): void {
    this.outputPlugins.set(shortname, plugin);
  }

  getInputPlugin(shortname: string): InputPlugin | undefined {
    return this.inputPlugins.get(shortname);
  }

  getOutputPlugin(shortname: string): OutputPlugin | undefined {
    return this.outputPlugins.get(shortname);
  }

  getInputPlugins(): Map<string, InputPlugin> {
    return this.inputPlugins;
  }

  getOutputPlugins(): Map<string, OutputPlugin> {
    return this.outputPlugins;
  }

  getInputPluginsList(): Array<{ shortname: string; info: PluginInfo }> {
    return Array.from(this.inputPlugins.entries()).map(([shortname, plugin]) => ({
      shortname,
      info: plugin.getInfo(),
    }));
  }

  getOutputPluginsList(): Array<{ shortname: string; info: PluginInfo }> {
    return Array.from(this.outputPlugins.entries()).map(([shortname, plugin]) => ({
      shortname,
      info: plugin.getInfo(),
    }));
  }

  async autoDetectInput(file: File): Promise<string | null> {
    // Try to detect by file extension first
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    for (const [shortname, plugin] of this.inputPlugins.entries()) {
      const info = plugin.getInfo();
      if (info.file_ext_detect && info.file_ext.some(ext => '.' + ext.toLowerCase() === fileExt)) {
        // Verify with actual detection if available
        if (info.supported_autodetect) {
          try {
            const detected = await plugin.detect(file);
            if (detected) return shortname;
          } catch (e) {
            console.warn(`Detection failed for ${shortname}:`, e);
          }
        } else {
          return shortname;
        }
      }
    }

    // If extension-based detection failed, try content-based detection
    for (const [shortname, plugin] of this.inputPlugins.entries()) {
      const info = plugin.getInfo();
      if (info.supported_autodetect) {
        try {
          const detected = await plugin.detect(file);
          if (detected) return shortname;
        } catch (e) {
          console.warn(`Detection failed for ${shortname}:`, e);
        }
      }
    }

    return null;
  }
}

// Global plugin registry instance
export const pluginRegistry = new PluginRegistry();
