# Port Conflict Resolver

Automatically detects and resolves port conflicts across local development services.

## Features

- **Scan Ports**: View all ports currently in use on your system
- **Kill Processes**: Terminate processes that are blocking specific ports
- **Resolve Conflicts**: Find alternative available ports when conflicts occur
- **Port Watching**: Monitor a port for changes in availability
- **Framework Suggestions**: Get recommended ports for popular frameworks
- **Cross-Platform**: Works on macOS, Linux, and Windows

## Installation

```bash
# Clone or download this repository
cd port-conflict-resolver

# Install dependencies
npm install

# Make executable (optional)
chmod +x src/index.js

# Install globally (optional)
npm link
```

## Usage

### Scan for Ports in Use

```bash
# Scan common development ports (default)
npm start scan

# Scan a specific port
npm start scan -- -p 3000

# Scan a port range
npm start scan -- -r 3000-4000

# Output as JSON
npm start scan -- -j
```

### Kill Process on Port

```bash
# Kill process on port 3000 (with confirmation)
npm start kill 3000

# Force kill without confirmation
npm start kill 3000 -- -f
```

### Resolve Port Conflict

```bash
# Check if a port is available
npm start resolve 3000 -- -c

# Try to allocate a specific port
npm start resolve -- -a 8080

# Find an available port near the requested one
npm start resolve 3000
```

### Watch Port Changes

```bash
# Watch port 3000 for changes (default interval: 5 seconds)
npm start watch 3000

# Custom check interval
npm start watch 3000 -- -i 10
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `scan` | Scan for ports in use |
| `scan -p <port>` | Scan specific port |
| `scan -r <start-end>` | Scan port range |
| `kill <port>` | Kill process on port |
| `resolve <port>` | Find alternative port |
| `resolve <port> -c` | Check if port is available |
| `resolve -- -a <port>` | Try to allocate specific port |
| `watch <port>` | Watch port for changes |

## Framework Port Suggestions

The tool includes port suggestions for popular frameworks:

- React/Vite: 5173, 5174, 5175, 5180
- Next.js: 3000, 3001, 3002, 3003
- Vue CLI/Vite: 5173, 8080
- Angular: 4200, 4201
- Express: 3000, 4000, 5000, 8080
- FastAPI: 8000, 8001, 8080
- Django: 8000, 8001, 8080
- Laravel: 8000, 8001
- NestJS: 3000, 4000, 5000
- Spring Boot: 8080, 8081, 8443
- PostgreSQL: 5432, 5433
- MySQL: 3306, 3307
- MongoDB: 27017, 27018, 27019
- Redis: 6379, 6380

## Examples

### Check what's using port 3000

```bash
$ npm start scan -- -p 3000

 Port    PID       Protocol  Address     State      Command
══════════════════════════════════════════════════════════════════
 3000   12345      TCP       *           LISTENING   node
══════════════════════════════════════════════════════════════════
 Total: 1 port(s) in use
```

### Resolve port conflict

```bash
$ npm start resolve 3000
Port 3000 is in use.
  Suggested alternative: 3001
```

### Kill blocking process

```bash
$ npm start kill 3000 -- -f
✓ Successfully killed process on port 3000
  PID: 12345, Name: node
```

## License

MIT
