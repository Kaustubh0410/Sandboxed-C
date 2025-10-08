import React, { useState } from 'react';
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

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const runCode = async () => {
    setIsRunning(true);
    setResult(null);
  
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
  
      // Ensure stdin is never empty
      const inputToSend = stdin.trim() === '' ? '\n' : stdin;
  
      const response = await axios.post(`${backendUrl}/api/run`, {
        code,
        stdin: inputToSend
      });
  
      setResult(response.data);
    } catch (error) {
      console.error('Error running code:', error);
      setResult({
        stdout: '',
        stderr: 'Failed to connect to backend server. Make sure the backend is running on port 3001.',
        compileError: '',
        exitCode: -1,
        timedOut: false
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  
  
  const getStatusBadge = () => {
    if (!result) return null;
    
    if (result.compileError) {
      return <span className="status-badge error">Compile Error</span>;
    }
    if (result.timedOut) {
      return <span className="status-badge warning">Timed Out</span>;
    }
    if (result.exitCode === 0) {
      return <span className="status-badge success">Success</span>;
    }
    return <span className="status-badge error">Runtime Error</span>;
  };

  const loadExample = (exampleCode) => {
    setCode(exampleCode);
  };

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
              placeholder="Enter input data for your program..."
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
            {result && (
              <>
                {result.compileError && (
                  <div className="output-section error">
                    <h4>❌ Compilation Error</h4>
                    <pre className="output-content">{result.compileError}</pre>
                  </div>
                )}

                {!result.compileError && (
                  <>
                    <div className="output-section">
                      <h4>📄 Standard Output</h4>
                      <pre className="output-content">
                        {result.stdout || '(no output)'}
                      </pre>
                    </div>

                    {result.stderr && (
                      <div className="output-section warning">
                        <h4>⚠️ Standard Error</h4>
                        <pre className="output-content">{result.stderr}</pre>
                      </div>
                    )}

                    <div className="output-meta">
                      <span>Exit Code: {result.exitCode}</span>
                      <span>Time Limit: 3s | Memory Limit: 256MB</span>
                    </div>
                  </>
                )}
              </>
            )}

            {!result && !isRunning && (
              <div className="output-placeholder">
                Click "Run Code" to see output here
              </div>
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
          <button
            className="example-button"
            onClick={() => loadExample(defaultCode)}
          >
            <div className="example-title">👋 Hello World</div>
            <div className="example-description">Basic output</div>
          </button>
          
          <button
            className="example-button"
            onClick={() => loadExample(`#include <stdio.h>

int main() {
    char name[100];
    printf("Enter your name: ");
    scanf("%s", name);
    printf("Hello, %s!\\n", name);
    return 0;
}`)}
          >
            <div className="example-title">📝 User Input</div>
            <div className="example-description">Read from stdin</div>
          </button>

          <button
            className="example-button"
            onClick={() => loadExample(`#include <stdio.h>

int main() {
    int *p = NULL;
    *p = 42;  // This will cause a segfault
    return 0;
}`)}
          >
            <div className="example-title">💥 Segfault Test</div>
            <div className="example-description">Runtime error</div>
          </button>

          <button
            className="example-button"
            onClick={() => loadExample(`#include <stdio.h>

int main() {
    while(1) {
        printf("Infinite loop...\\n");
    }
    return 0;
}`)}
          >
            <div className="example-title">⏰ Timeout Test</div>
            <div className="example-description">Will timeout after 3s</div>
          </button>
        </div>
      </section>

      <footer className="app-footer">
        <div className="security-notice">
          <h3>🔒 Security Features</h3>
          <ul>
            <li>✅ Sandboxed execution in Docker containers</li>
            <li>✅ 3-second timeout and 256MB memory limit</li>
            <li>✅ Non-root user execution (UID 1000)</li>
            <li>✅ Isolated filesystem and process limits</li>
          </ul>
        </div>
        <div className="footer-note">
          <p>⚠️ This is a development prototype. Do not deploy to production without additional security measures.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;