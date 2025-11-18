import { useState, useEffect } from 'react';
import { pluginRegistry } from './lib/plugin-system';
import { DawConverter, ConversionProgress } from './lib/converter';
import { registerPlugins } from './plugins';
import './App.css';

interface PluginOption {
  shortname: string;
  name: string;
}

function App() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputPlugins, setInputPlugins] = useState<PluginOption[]>([]);
  const [outputPlugins, setOutputPlugins] = useState<PluginOption[]>([]);
  const [selectedInputPlugin, setSelectedInputPlugin] = useState<string>('auto');
  const [selectedOutputPlugin, setSelectedOutputPlugin] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Register plugins on mount
    registerPlugins();

    // Load plugin lists
    const inputs = pluginRegistry.getInputPluginsList().map(p => ({
      shortname: p.shortname,
      name: p.info.name,
    }));
    setInputPlugins(inputs);

    const outputs = pluginRegistry.getOutputPluginsList().map(p => ({
      shortname: p.shortname,
      name: p.info.name,
    }));
    setOutputPlugins(outputs);

    // Set default output plugin
    if (outputs.length > 0) {
      setSelectedOutputPlugin(outputs[0].shortname);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInputFile(file);
      setError(null);
    }
  };

  const handleConvert = async () => {
    if (!inputFile || !selectedOutputPlugin) {
      setError('Please select an input file and output format');
      return;
    }

    setIsConverting(true);
    setError(null);
    setProgress(null);

    try {
      const converter = new DawConverter();
      const inputPlugin = selectedInputPlugin === 'auto' ? null : selectedInputPlugin;

      const outputBlob = await converter.convert(
        inputFile,
        inputPlugin,
        selectedOutputPlugin,
        (progressData) => {
          setProgress(progressData);
        }
      );

      // Download the converted file
      const outputPlugin = pluginRegistry.getOutputPlugin(selectedOutputPlugin);
      const fileExt = outputPlugin?.getInfo().file_ext[0] || 'dat';
      const fileName = inputFile.name.replace(/\.[^.]+$/, `.${fileExt}`);

      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setProgress(null);
    } finally {
      setIsConverting(false);
    }
  };

  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'error': return '#ef4444';
      case 'complete': return '#10b981';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎵 DawVert Web</h1>
        <p>DAW Project Converter - Running in Your Browser</p>
      </header>

      <main className="container">
        <div className="card">
          <h2>Input File</h2>
          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              accept=".mid,.midi"
              disabled={isConverting}
            />
            <label htmlFor="file-input" className="file-input-label">
              {inputFile ? inputFile.name : 'Choose a file...'}
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="input-format">Input Format</label>
            <select
              id="input-format"
              value={selectedInputPlugin}
              onChange={(e) => setSelectedInputPlugin(e.target.value)}
              disabled={isConverting}
            >
              <option value="auto">Auto-detect</option>
              {inputPlugins.map((plugin) => (
                <option key={plugin.shortname} value={plugin.shortname}>
                  {plugin.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="arrow">→</div>

        <div className="card">
          <h2>Output Format</h2>
          <div className="form-group">
            <label htmlFor="output-format">Format</label>
            <select
              id="output-format"
              value={selectedOutputPlugin}
              onChange={(e) => setSelectedOutputPlugin(e.target.value)}
              disabled={isConverting}
            >
              {outputPlugins.map((plugin) => (
                <option key={plugin.shortname} value={plugin.shortname}>
                  {plugin.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="convert-button"
          onClick={handleConvert}
          disabled={!inputFile || !selectedOutputPlugin || isConverting}
        >
          {isConverting ? 'Converting...' : 'Convert'}
        </button>

        {progress && (
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div
                className="progress-bar"
                style={{
                  width: `${progress.progress}%`,
                  backgroundColor: getProgressColor(progress.stage),
                }}
              />
            </div>
            <p className="progress-message" style={{ color: getProgressColor(progress.stage) }}>
              {progress.message}
            </p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="info-section">
          <h3>About DawVert Web</h3>
          <p>
            DawVert Web is a browser-based version of the DawVert DAW project converter.
            It allows you to convert music project files between different DAW formats
            entirely in your browser - no server uploads required!
          </p>
          <p>
            <strong>Currently supported formats:</strong>
          </p>
          <ul>
            <li>MIDI (.mid, .midi)</li>
          </ul>
          <p>
            <em>More formats coming soon...</em>
          </p>
        </div>
      </main>

      <footer className="footer">
        <p>
          Based on{' '}
          <a href="https://github.com/SatyrDiamond/DawVert" target="_blank" rel="noopener noreferrer">
            DawVert
          </a>{' '}
          by SatyrDiamond | GPL-3.0 License
        </p>
      </footer>
    </div>
  );
}

export default App;
