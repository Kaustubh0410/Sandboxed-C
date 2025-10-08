const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
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

  // Limit code size (1MB max)
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
    // Create temporary workspace
    await createWorkspace(workspaceDir, code, stdin);
    
    console.log(`[${runId}] Starting execution for workspace: ${workspaceDir}`);
    
    // Step 1: Compile the code
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
    
    console.log(`[${runId}] Compilation successful, running program...`);
    
    // Step 2: Execute the compiled program
    const executeResult = await executeCode(workspaceDir);
    
    console.log(`[${runId}] Execution completed. Exit code: ${executeResult.exitCode}, Timed out: ${executeResult.timedOut}`);
    
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
    // Cleanup workspace
    cleanupWorkspace(workspaceDir);
  }
});

// Create workspace directory and files
async function createWorkspace(workspaceDir, code, stdin) {
  return new Promise((resolve, reject) => {
    fs.mkdir(workspaceDir, { recursive: true }, (err) => {
      if (err) return reject(err);
      
      // Write main.c
      const mainPath = path.join(workspaceDir, 'main.c');
      fs.writeFile(mainPath, code, (err) => {
        if (err) return reject(err);
        
        // Write input.txt
        const inputPath = path.join(workspaceDir, 'input.txt');
        fs.writeFile(inputPath, stdin, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
}

// Compile C code using Docker
function compileCode(workspaceDir) {
  return new Promise((resolve) => {
    const compileCmd = `docker run --rm ` +
      `-v "${workspaceDir}:/workspace" ` +
      `--workdir /workspace ` +
      `--memory=256m ` +
      `--cpus=0.5 ` +
      `--network=none ` +
      `--user=1000:1000 ` +
      `c-runner:latest ` +
      `gcc -std=c11 -Wall -Wextra -O2 main.c -o main`;

    console.log(`Executing compile command: ${compileCmd}`);
    
    exec(compileCmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.log(`Compilation failed with exit code: ${error.code}`);
        resolve({
          error: true,
          stdout: stdout,
          stderr: stderr,
          exitCode: error.code || 1
        });
      } else {
        console.log('Compilation successful');
        resolve({
          error: false,
          stdout: stdout,
          stderr: stderr,
          exitCode: 0
        });
      }
    });
  });
}

// Execute compiled program using Docker
function executeCode(workspaceDir) {
  return new Promise((resolve) => {
    // Complex command that handles timeout detection and output capture
    const executeCmd = `docker run --rm ` +
      `-v "${workspaceDir}:/workspace" ` +
      `--workdir /workspace ` +
      `--memory=256m ` +
      `--cpus=0.5 ` +
      `--pids-limit=64 ` +
      `--network=none ` +
      `--user=1000:1000 ` +
      `c-runner:latest ` +
      `sh -c 'timeout 3s ./main < input.txt > program.out 2> program.err; ` +
      `TIMEOUT_EXIT=$?; ` +
      `echo "EXIT_CODE:$TIMEOUT_EXIT"; ` +
      `echo "---STDOUT---"; ` +
      `cat program.out 2>/dev/null || echo ""; ` +
      `echo "---STDERR---"; ` +
      `cat program.err 2>/dev/null || echo ""'`;

    console.log(`Executing run command: ${executeCmd}`);
    
    exec(executeCmd, { timeout: 15000 }, (error, stdout, stderr) => {
      try {
        // Parse the complex output
        const lines = stdout.split('\\n');
        let exitCodeLine = '';
        let stdoutStartIndex = -1;
        let stderrStartIndex = -1;
        
        // Find markers in output
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('EXIT_CODE:')) {
            exitCodeLine = lines[i];
          } else if (lines[i] === '---STDOUT---') {
            stdoutStartIndex = i + 1;
          } else if (lines[i] === '---STDERR---') {
            stderrStartIndex = i + 1;
          }
        }
        
        // Extract exit code
        const exitCode = exitCodeLine ? parseInt(exitCodeLine.split(':')[1]) : (error ? error.code || 1 : 0);
        
        // Extract stdout (between ---STDOUT--- and ---STDERR---)
        let programStdout = '';
        if (stdoutStartIndex !== -1 && stderrStartIndex !== -1) {
          programStdout = lines.slice(stdoutStartIndex, stderrStartIndex - 1).join('\\n');
        }
        
        // Extract stderr (after ---STDERR---)
        let programStderr = '';
        if (stderrStartIndex !== -1) {
          programStderr = lines.slice(stderrStartIndex).join('\\n');
        }
        
        // Check if timeout occurred (GNU timeout returns 124)
        const timedOut = exitCode === 124;
        
        console.log(`Program execution completed. Exit code: ${exitCode}, Timed out: ${timedOut}`);
        console.log(`Stdout length: ${programStdout.length}, Stderr length: ${programStderr.length}`);
        
        resolve({
          stdout: programStdout,
          stderr: programStderr,
          exitCode: timedOut ? 124 : exitCode,
          timedOut: timedOut
        });
        
      } catch (parseError) {
        console.error('Error parsing execution output:', parseError);
        resolve({
          stdout: '',
          stderr: `Error parsing execution output: ${parseError.message}`,
          exitCode: -1,
          timedOut: false
        });
      }
    });
  });
}

// Clean up temporary workspace
function cleanupWorkspace(workspaceDir) {
  try {
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
      console.log(`Cleaned up workspace: ${workspaceDir}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup workspace ${workspaceDir}:`, error);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
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
  console.log(`📡 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/run`);
  console.log('');
  console.log('⚠️  Security Note: This is a development prototype.');
  console.log('   Do not deploy to production without additional security measures.');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});