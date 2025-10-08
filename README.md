# Secure Online C Compiler

A complete, secure online C compiler with sandboxed execution environment. Features a React frontend with Monaco Editor and a Node.js backend that uses Docker containers for safe code compilation and execution.

## Project Structure

```
secure-c-compiler/
├── README.md
├── docker-compose.yml
├── runner/
│   └── Dockerfile
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   └── index.js
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js
        └── App.css
```

## Features

- **Secure Sandboxing**: Each code execution runs in an isolated Docker container
- **Resource Limits**: 3-second timeout, 256MB memory limit, process limits
- **Non-root Execution**: All code runs as unprivileged user (UID 1000)
- **Modern UI**: Monaco Editor with syntax highlighting and IntelliSense
- **Real-time Output**: Shows stdout, stderr, compilation errors, and exit codes
- **Example Programs**: Built-in examples for testing various scenarios

## Security Controls

- ✅ **Time Limits**: 3-second execution timeout using GNU `timeout`
- ✅ **Memory Limits**: 256MB RAM limit via Docker `--memory`
- ✅ **Process Limits**: Maximum 64 processes via `--pids-limit`
- ✅ **Non-root User**: Code runs as user with UID 1000, not root
- ✅ **Isolated Filesystem**: Each execution gets a clean, temporary workspace
- ✅ **No Network Access**: Containers run without network capabilities
- ✅ **Resource Cleanup**: Automatic cleanup of temporary files after execution

## Quick Start

### Prerequisites

- Docker installed and running
- Node.js 16+ and npm
- Docker BuildKit enabled

### Option 1: Using Docker Compose (Recommended for Demo)

**⚠️ SECURITY WARNING**: This method mounts the Docker socket inside a container, which grants significant privileges. Use only for development/demo purposes.

```bash
# Clone or create the project files
# Build and start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Option 2: Manual Setup (Recommended for Production)

1. **Build the Runner Image**
   ```bash
   docker build -t c-runner:latest ./runner
   ```

2. **Start the Backend**
   ```bash
   cd backend
   npm install
   npm start
   # Backend runs on http://localhost:3001
   ```

3. **Start the Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   # Frontend runs on http://localhost:3000
   ```

## API Reference

### POST /api/run

Compiles and executes C code in a sandboxed environment.

**Request:**
```json
{
  "code": "string",     // C source code
  "stdin": "string"     // Optional input data
}
```

**Response:**
```json
{
  "stdout": "string",      // Program output
  "stderr": "string",      // Error output
  "compileError": "string", // Compilation errors
  "exitCode": "number",    // Process exit code
  "timedOut": "boolean"    // Whether execution was killed by timeout
}
```

## Testing Examples

### 1. Hello World
```c
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
```
Expected: Success with "Hello, World!" output

### 2. User Input Test
```c
#include <stdio.h>

int main() {
    char name[100];
    printf("Enter your name: ");
    scanf("%s", name);
    printf("Hello, %s!\\n", name);
    return 0;
}
```
Input: `John`
Expected: "Hello, John!" output

### 3. Segfault Test
```c
#include <stdio.h>

int main() {
    int *p = NULL;
    *p = 42;
    return 0;
}
```
Expected: Non-zero exit code (segmentation fault)

### 4. Infinite Loop Test
```c
#include <stdio.h>

int main() {
    while(1) {
        printf("Infinite loop...\\n");
    }
    return 0;
}
```
Expected: `timedOut: true` after 3 seconds

## Security Verification

### Test Memory Limit
```bash
curl -X POST http://localhost:3001/api/run \\
  -H "Content-Type: application/json" \\
  -d '{"code":"#include <stdlib.h>\\nint main(){malloc(300*1024*1024);return 0;}"}'
```

### Test Timeout
```bash
curl -X POST http://localhost:3001/api/run \\
  -H "Content-Type: application/json" \\
  -d '{"code":"int main(){while(1);return 0;}"}'
```

### Test Segfault Handling
```bash
curl -X POST http://localhost:3001/api/run \\
  -H "Content-Type: application/json" \\
  -d '{"code":"int main(){int*p=0;*p=1;return 0;}"}'
```


## How Security is Enforced

1. **Time Limits**: GNU `timeout 3s` command kills processes after 3 seconds (exit code 124 = timeout)
2. **Memory Limits**: Docker `--memory=256m` flag prevents containers from using more than 256MB RAM
3. **Sandboxing**: Each execution runs in a fresh Docker container with no network access, limited processes, and isolated filesystem as non-root user (UID 1000)

## Architecture Notes

- **Backend**: Uses Node.js `child_process.exec()` to run Docker commands
- **Frontend**: React with Monaco Editor for syntax highlighting
- **Runner**: Ubuntu 22.04 with GCC, non-root user, minimal attack surface
- **Cleanup**: Automatic removal of containers and temporary files after each run

## Troubleshooting

- **Backend Connection Failed**: Ensure backend is running on port 3001
- **Docker Permission Denied**: Add your user to the docker group or run with sudo
- **Container Build Failed**: Check Docker daemon is running and BuildKit is enabled
- **Timeout Not Working**: Verify GNU coreutils is installed in runner image
# Sandboxed-C

