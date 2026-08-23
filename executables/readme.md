# Quickstart — Download the Executable for Your Operating System

Pre-built binaries for PI-CHAT GATEWAY are available below. Download the executable that matches your operating system and architecture, then follow the platform-specific instructions.

---

## Windows

| Architecture | File | Download |
|---|---|---|
| Windows x64 (Intel/AMD 64-bit) | `server.exe` | [Download](windows_x64/server.exe) |

**How to run:** Double-click the `.exe` file, or run from Command Prompt / PowerShell:
```
server.exe -addr :8080 -data ./data
```

---

## Linux

| Architecture | File | Download |
|---|---|---|
| Linux x64 (Intel/AMD 64-bit) | `server` | [Download](linux_x64/server) |
| Linux ARM64 (Pi 3/4/5 / Zero 2 W, 64-bit OS) | `server` | [Download](linux_arm64/server) |
| Raspberry Pi Zero W / Pi 1 (ARMv6) | `server` | [Download](linux_arm_pi_zero_w/server) |
| Raspberry Pi 2/3/4/5 (32-bit OS, ARMv7) | `server` | [Download](linux_arm_pi3_32/server) |

**How to run:**
```bash
chmod +x server
./server -addr :8080 -data ./data
```

To run it in the background (survives closing the terminal), use the helper script in this folder:
```bash
./backgnd.sh ./linux_x64/server -addr :8080 -data ./data
```

---

## macOS

| Architecture | File | Download |
|---|---|---|
| macOS Intel (x64) | `server` | [Download](mac_x64/server) |
| macOS Apple Silicon (M1/M2/M3/M4) | `server` | [Download](mac_arm64/server) |

**How to run:**
```bash
chmod +x server
./server -addr :8080 -data ./data
```

> **Note:** macOS may block the executable because it's from an unidentified developer. To bypass this:
> - Go to **System Settings > Privacy & Security**
> - Scroll down and click **"Open Anyway"** next to the blocked message
> - Or in Terminal, run: `xattr -d com.apple.quarantine server`

---

## First Time Setup

When you start the server for the first time, it will:
1. Create the necessary directory structure (`data/`) with flat-file JSON storage
2. Serve the embedded web UI at `http://<host>:8080`
3. Let you add LLM providers (Ollama / llama.cpp endpoints), models, and system prompts through the web UI — no config files to edit by hand

## Building from Source

If you prefer to build from source, see the main project [README.md](../README.md) for instructions, or run `build_all.bat` / `build_all.ps1` in this `executables/` folder.