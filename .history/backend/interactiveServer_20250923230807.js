// interactiveServer.js
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 3002 });
console.log('🚀 Interactive WebSocket server running on port 3002');

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  console.log(`[${sessionId}] Client connected`);

  // Create a temporary workspace
  const workspaceDir = path.join(os.tmpdir(), `c-runner-${sessionId}`);

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.type === 'code') {
      // Write code to workspace
      const fs = require('fs');
      const mainPath = path.join(workspaceDir, 'main.c');
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(mainPath, data.code);

      // Compile inside Docker
      const compileCmd = [
        'docker', 'run', '--rm',
        '-v', `${workspaceDir}:/workspace`,
        '--workdir', '/workspace',
        'c-runner:latest',
        'gcc', 'main.c', '-o', 'main'
      ];

      const { exec } = require('child_process');
      exec(compileCmd.join(' '), (error, stdout, stderr) => {
        if (error) {
          ws.send(JSON.stringify({ type: 'compileError', data: stderr }));
          return;
        }

        // Run program interactively using PTY
        const term = pty.spawn('docker', [
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

        term.on('data', (data) => ws.send(JSON.stringify({ type: 'stdout', data })));

        ws.on('message', (msg) => {
          const inputData = JSON.parse(msg);
          if (inputData.type === 'stdin') {
            term.write(inputData.data);
          }
        });

        term.on('exit', () => {
          ws.send(JSON.stringify({ type: 'exit' }));
        });
      });
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] Client disconnected`);
  });
});
