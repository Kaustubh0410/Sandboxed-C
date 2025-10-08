# Secure C Runner Container
# Uses Ubuntu 22.04 LTS for stability and security updates
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update package list and install essential tools
# - gcc: GNU C Compiler
# - libc6-dev: Standard C library development files
# - coreutils: For timeout command and other utilities
RUN apt-get update && \
    apt-get install -y \
        gcc \
        libc6-dev \
        coreutils \
        --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
# UID 1000 is standard for first non-root user
# This prevents code from running with root privileges
RUN groupadd -r coderunner -g 1000 && \
    useradd -r -g coderunner -u 1000 -m -s /bin/bash coderunner

# Create workspace directory and set proper ownership
RUN mkdir -p /workspace && \
    chown -R coderunner:coderunner /workspace

# Set working directory
WORKDIR /workspace

# Switch to non-root user
# All subsequent commands and code execution will run as this user
USER coderunner

# Default command (can be overridden)
CMD ["/bin/bash"]

# Security Notes:
# 1. Runs as non-root user (UID 1000) to prevent privilege escalation
# 2. Minimal package installation to reduce attack surface
# 3. Clean package cache to reduce image size
# 4. /workspace is the mount point for code files
# 5. No network access by default when run with --network=none
