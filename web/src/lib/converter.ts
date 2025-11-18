/**
 * Core Converter
 * Handles the main conversion process between formats
 */

import type { CVPJProject, ConversionConfig, ProjectType } from '@/types/cvpj';
import { pluginRegistry } from './plugin-system';
import { convertProjectType } from './type-conversion';
import { convertAllPlugins, type PluginConversionContext } from './plugin-conversion';

export interface ConversionProgress {
  stage: 'parsing' | 'type-conversion' | 'plugin-conversion' | 'output' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

export type ProgressCallback = (progress: ConversionProgress) => void;

export class DawConverter {
  private config: ConversionConfig;

  constructor(config: Partial<ConversionConfig> = {}) {
    this.config = {
      songnum: 1,
      searchpaths: [],
      flags_convproj: [],
      flags_core: [],
      ...config,
    };
  }

  async convert(
    inputFile: File,
    inputFormat: string | null,
    outputFormat: string,
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    try {
      // Stage 1: Auto-detect input format if not specified
      onProgress?.({
        stage: 'parsing',
        progress: 0,
        message: 'Detecting input format...',
      });

      let detectedFormat = inputFormat;
      if (!detectedFormat) {
        detectedFormat = await pluginRegistry.autoDetectInput(inputFile);
        if (!detectedFormat) {
          throw new Error('Could not detect input format. Please specify the format manually.');
        }
      }

      // Stage 2: Get plugins
      const inputPlugin = pluginRegistry.getInputPlugin(detectedFormat);
      if (!inputPlugin) {
        throw new Error(`Input plugin not found: ${detectedFormat}`);
      }

      const outputPlugin = pluginRegistry.getOutputPlugin(outputFormat);
      if (!outputPlugin) {
        throw new Error(`Output plugin not found: ${outputFormat}`);
      }

      // Check plugin usability
      const inputUsable = inputPlugin.isUsable();
      if (!inputUsable.usable) {
        throw new Error(`Input plugin not usable: ${inputUsable.message}`);
      }

      const outputUsable = outputPlugin.isUsable();
      if (!outputUsable.usable) {
        throw new Error(`Output plugin not usable: ${outputUsable.message}`);
      }

      // Stage 3: Parse input
      onProgress?.({
        stage: 'parsing',
        progress: 10,
        message: `Parsing ${inputPlugin.getInfo().name}...`,
      });

      const project = await inputPlugin.parse(inputFile, this.config);

      // Stage 4: Type conversion
      const inputType = project.type;
      const outputType = outputPlugin.getType();

      let convertedProject = project;

      if (inputType !== outputType) {
        onProgress?.({
          stage: 'type-conversion',
          progress: 40,
          message: `Converting from ${inputType} to ${outputType}...`,
        });

        convertedProject = convertProjectType(project, outputType);
      }

      // Stage 5: Plugin conversion
      onProgress?.({
        stage: 'plugin-conversion',
        progress: 60,
        message: 'Converting plugins and effects...',
      });

      if (convertedProject.plugins) {
        const conversionContext: PluginConversionContext = {
          sourceDaw: detectedFormat,
          targetDaw: outputFormat,
        };

        convertedProject.plugins = convertAllPlugins(
          convertedProject.plugins,
          outputFormat,
          conversionContext
        );
      }

      // Stage 6: Generate output
      onProgress?.({
        stage: 'output',
        progress: 80,
        message: `Generating ${outputPlugin.getInfo().name}...`,
      });

      const outputBlob = await outputPlugin.parse(convertedProject, this.config);

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Conversion complete!',
      });

      return outputBlob;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      onProgress?.({
        stage: 'error',
        progress: 0,
        message: errorMessage,
      });

      throw error;
    }
  }

}
