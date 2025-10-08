import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';

const defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`;

function App() {
  const [code, setCode] = useState(defaultCode);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const wsRef = useRef(null);

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const runCode = async () => {
    setIsRunning(true);
    setResult(null);
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

    try {
      // If user provided stdin, use REST API
      if (stdin.trim() !== '') {
        const response = await axios.post(`${backendUrl}/api/run`, {
          code,
          stdin
        });
        setResult(response.data);
      } else {
        // Use WebSocket for interactive execution
        wsRef.current = new WebSocket('ws://localhost:3002');

        let outputData = '';
        wsRef.current.onopen = () => {
          wsRef.current.send(JSON.stringify({ type: 'code', code }));
        };

        wsRef.current.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'stdout') {
            outputData += msg.data;
            setResult({ stdout: outputData });
          }
          if (msg.type === 'compileError') {
            setResult({ compileError: msg.data });
          }
          if (msg.type === 'exit') {
            setIsRunning(false);
            wsRef.current.close();
          }
        };
      }
    } catch (error) {
      console.error('Error running code:', error);
      setResult({
        stdout: '',
        stderr: 'Failed to connect to backend server.',
        compileError: '',
        exitCode: -1,
        timedOut: false
      });
      setIsRunning(false);
    }
  };

  const sendInteractiveInput = (input) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', data: input + '\n' }));
    }
  };

  const getStatusBadge = () => {
    if (!result) return null;
    if (result.compileError) return <span className="status-badge error">Compile Error</span>;
    if (result.timedOut) return <span className="status-badge warning">Timed Out</span>;
    if (result.exitCode === 0 || result.stdout) return <span className="status-badge success">Success</span>;
    return <span className="status-badge error">Runtime Error</span>;
  };

  const loadExample = (exampleCode) => setCode(exampleCode);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛡️ Secure Online C Compiler</h1>
        <p>Write, compile, and run C code in a safe sandboxed environment</p>
      </header>

      <main className="app-main">
        <div className="editor-panel">
          <div className="panel-header">
            <h2>📝 Code Editor</h2>
          </div>
          <div className="editor-container">
            <Editor
              height="400px"
              language="c"
              value={code}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                tabSize: 4,
              }}
            />
          </div>

          <div className="stdin-container">
            <div className="panel-header">
              <h3>📥 Standard Input</h3>
            </div>
            <textarea
              className="stdin-input"
              placeholder="Enter input data for your program (leave empty for interactive mode)..."
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              rows="4"
            />
          </div>

          <button 
            className={`run-button ${isRunning ? 'running' : ''}`}
            onClick={runCode} 
            disabled={isRunning}
          >
            {isRunning ? '⏳ Running...' : '▶️ Run Code'}
          </button>
        </div>

        <div className="output-panel">
          <div className="panel-header">
            <h2>📤 Output</h2>
            {getStatusBadge()}
          </div>
          
          <div className="output-container">
            {result ? (
              <>
                {result.compileError && (
                  <div className="output-section error">
                    <h4>❌ Compilation Error</h4>
                    <pre className="output-content">{result.compileError}</pre>
                  </div>
                )}
                {!result.compileError && (
                  <div className="output-section">
                    <h4>📄 Standard Output</h4>
                    <pre className="output-content">
                      {result.stdout || '(no output)'}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              !isRunning && <div className="output-placeholder">Click "Run Code" to see output here</div>
            )}

            {isRunning && (
              <div className="output-placeholder">
                <div className="loading-spinner"></div>
                <span>Compiling and running your code...</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <section className="examples-section">
        <h2>📚 Example Programs</h2>
        <div className="examples-grid">
          <button className="example-button" onClick={() => loadExample(defaultCode)}>
            <div className="example-title">👋 Hello World</div>
            <div className="example-description">Basic output</div>
          </button>
          <button className="example-button" onClick={() => loadExample(`#include <stdio.h>

int main() {
    char name[100];
    printf("Enter your name: ");
    scanf("%s", name);
    printf("Hello, %s!\\n", name);
    return 0;
}`)}>
            <div className="example-title">📝 User Input</div>
            <div className="example-description">Read from stdin</div>
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
