const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main code execution endpoint
app.post('/api/run', async (req, res) => {
  const { code, stdin = '' } = req.body;

  // Input validation
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      stdout: '',
      stderr: 'Invalid code provided',
      compileError: '',
      exitCode: -1,
      timedOut: false
    });
  }

  if (code.length > 1024 * 1024) {
    return res.status(400).json({
      stdout: '',
      stderr: 'Code too large (max 1MB)',
      compileError: '',
      exitCode: -1,
      timedOut: false
    });
  }

  const runId = uuidv4();
  const workspaceDir = path.join(os.tmpdir(), `c-runner-${runId}`);

  try {
    // Create workspace and write files
    await createWorkspace(workspaceDir, code, stdin);

    console.log(`[${runId}] Workspace ready: ${workspaceDir}`);

    // Compile code
    const compileResult = await compileCode(workspaceDir);
    if (compileResult.error) {
      return res.json({
        stdout: '',
        stderr: '',
        compileError: compileResult.stderr,
        exitCode: compileResult.exitCode,
        timedOut: false
      });
    }

    // Execute code
    const executeResult = await executeCode(workspaceDir);

    res.json({
      stdout: executeResult.stdout,
      stderr: executeResult.stderr,
      compileError: '',
      exitCode: executeResult.exitCode,
      timedOut: executeResult.timedOut
    });

  } catch (error) {
    console.error(`[${runId}] Error:`, error);
    res.status(500).json({
      stdout: '',
      stderr: `Internal server error: ${error.message}`,
      compileError: '',
      exitCode: -1,
      timedOut: false
    });
  } finally {
    cleanupWorkspace(workspaceDir);
  }
});

// Create workspace and write code/input
async function createWorkspace(workspaceDir, code, stdin) {
  return new Promise((resolve, reject) => {
    fs.mkdir(workspaceDir, { recursive: true }, (err) => {
      if (err) return reject(err);
      const mainPath = path.join(workspaceDir, 'main.c');
      fs.writeFile(mainPath, code, (err) => {
        if (err) return reject(err);
        const inputPath = path.join(workspaceDir, 'input.txt');
        fs.writeFile(inputPath, stdin, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
}

// Compile code inside Docker
function compileCode(workspaceDir) {
  return new Promise((resolve) => {
    const cmd = [
      'docker', 'run', '--rm',
      '-v', `${workspaceDir}:/workspace`,
      '--workdir', '/workspace',
      '--memory=256m',
      '--cpus=0.5',
      '--network=none',
      '--user=1000:1000',
      'c-runner:latest',
      'gcc', '-std=c11', '-Wall', '-Wextra', '-O2', 'main.c', '-o', 'main'
    ];

    console.log('Compiling:', cmd.join(' '));

    execFile(cmd[0], cmd.slice(1), { timeout: 10000 }, (error, stdout, stderr) => {
      resolve({
        error: !!error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: error?.code || 0
      });
    });
  });
}

// Execute compiled program inside Docker
function executeCode(workspaceDir) {
  return new Promise((resolve) => {
    const cmd = [
      'docker', 'run', '--rm',
      '-v', `${workspaceDir}:/workspace`,
      '--workdir', '/workspace',
      '--memory=256m',
      '--cpus=0.5',
      '--pids-limit=64',
      '--network=none',
      '--user=1000:1000',
      'c-runner:latest',
      './main'
    ];

    console.log('Running program:', cmd.join(' '));

    execFile(cmd[0], cmd.slice(1), { timeout: 3000 }, (error, stdout, stderr) => {
      const timedOut = error?.killed || false;
      const exitCode = error?.code || 0;

      console.log('Stdout:', stdout);
      console.log('Stderr:', stderr);
      console.log('Exit code:', exitCode, 'Timed out:', timedOut);

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        timedOut
      });
    });
  });
}

// Cleanup workspace
function cleanupWorkspace(workspaceDir) {
  try {
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
      console.log(`Cleaned up workspace: ${workspaceDir}`);
    }
  } catch (err) {
    console.error('Failed to cleanup workspace:', err);
  }
}

// Error middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    stdout: '',
    stderr: 'Internal server error',
    compileError: '',
    exitCode: -1,
    timedOut: false
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 C Compiler Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/run`);
});

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
