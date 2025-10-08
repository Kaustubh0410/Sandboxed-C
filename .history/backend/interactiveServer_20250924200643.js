// interactiveServer.js
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const wss = new WebSocket.Server({ port: 3002 });
console.log('🚀 Interactive WebSocket server running on port 3002');

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  console.log(`[${sessionId}] Client connected`);

  // Create a temporary workspace
  const workspaceDir = path.join(os.tmpdir(), `c-runner-${sessionId}`);

  // Ensure workspace exists
  fs.mkdirSync(workspaceDir, { recursive: true });

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.type === 'code') {
      // Write code to workspace
      const mainPath = path.join(workspaceDir, 'main.c');
      fs.writeFileSync(mainPath, data.code);

      // Compile inside Docker
      const compileCmd = [
        'docker', 'run', '--rm',
        '-v', `${workspaceDir}:/workspace`,
        '--workdir', '/workspace',
        'c-runner:latest',
        'gcc', 'main.c', '-o', 'main'
      ];

      exec(compileCmd.join(' '), (error, stdout, stderr) => {
        if (error) {
          ws.send(JSON.stringify({ type: 'compileError', data: stderr }));
          return;
        }

        // Run program interactively using PTY
        ws.term = pty.spawn('docker', [
          'run', '--rm', '-i', '-t',
          '-v', `${workspaceDir}:/workspace`,
          '--workdir', '/workspace',
          'c-runner:latest',
          './main'
        ], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        });

        ws.term.on('data', (data) => ws.send(JSON.stringify({ type: 'stdout', data })));
        ws.term.on('exit', () => ws.send(JSON.stringify({ type: 'exit' })));
      });
    }

    if (data.type === 'stdin') {
      // Forward input to the running PTY
      if (ws.term) {
        ws.term.write(data.data);
      }
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] Client disconnected`);
    // Cleanup workspace
    try {
      if (fs.existsSync(workspaceDir)) {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
        console.log(`Cleaned up workspace: ${workspaceDir}`);
      }
    } catch (err) {
      console.error('Failed to cleanup workspace:', err);
    }
  });
});
