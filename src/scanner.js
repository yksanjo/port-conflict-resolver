const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const COMMON_PORTS = [
  80, 443, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009,
  3010, 4000, 4001, 4200, 5000, 5001, 5173, 5174, 5175, 5176, 5177,
  5178, 5179, 5180, 5500, 6000, 7000, 8000, 8080, 8081, 8082, 8083,
  8084, 8085, 8086, 8087, 8088, 8089, 8090, 8443, 8888, 9000, 9001,
  9200, 9300, 27017, 27018, 27019, 5432, 6379, 3306, 11211
];

class PortScanner {
  constructor() {
    this.platform = process.platform;
  }

  /**
   * Execute shell command and return output
   */
  async executeCommand(command) {
    try {
      const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });
      return stdout;
    } catch (error) {
      // Some commands may return non-zero for valid reasons
      return error.stdout || '';
    }
  }

  /**
   * Get list of ports in use based on platform
   */
  async getActivePorts() {
    let command;
    
    if (this.platform === 'win32') {
      command = 'netstat -ano | findstr LISTENING';
    } else if (this.platform === 'darwin') {
      command = 'lsof -i -P -n | grep LISTEN';
    } else {
      // Linux
      command = 'ss -tulpn | grep LISTEN';
    }

    const output = await this.executeCommand(command);
    return this.parseNetstatOutput(output);
  }

  /**
   * Parse netstat/lsof output to extract port information
   */
  parseNetstatOutput(output) {
    const ports = [];
    const lines = output.trim().split('\n');
    
    if (this.platform === 'win32') {
      // Windows format: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[0] === 'TCP') {
          const localAddress = parts[1];
          const portMatch = localAddress.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1]);
            const pid = parseInt(parts[4]);
            if (!isNaN(port) && !isNaN(pid) && pid > 0) {
              ports.push({
                port,
                pid,
                protocol: 'TCP',
                address: localAddress.replace(`:${port}`, ''),
                state: 'LISTENING'
              });
            }
          }
        }
      }
    } else if (this.platform === 'darwin') {
      // macOS format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      // node 12345 user 24u IPv4 0x... 0t0 TCP *:3000 (LISTEN)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 9) {
          const command = parts[0];
          const pid = parseInt(parts[1]);
          const nameMatch = line.match(/:(\d+)\s*\(LISTEN\)/);
          if (nameMatch) {
            const port = parseInt(nameMatch[1]);
            const addressMatch = line.match(/(TCP|UDP)\s+(\S+)/);
            const address = addressMatch ? addressMatch[2] : '*';
            ports.push({
              port,
              pid,
              protocol: addressMatch ? addressMatch[1] : 'TCP',
              address,
              command,
              state: 'LISTENING'
            });
          }
        }
      }
    } else {
      // Linux format: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const localAddr = parts[4];
          const portMatch = localAddr.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1]);
            const pidMatch = line.match(/pid=(\d+)/);
            const pid = pidMatch ? parseInt(pidMatch[1]) : 0;
            const commandMatch = line.match(/users:\(\(\"([^\"]+)\"/);
            const command = commandMatch ? commandMatch[1] : '';
            ports.push({
              port,
              pid,
              protocol: parts[0],
              address: localAddr.replace(`:${port}`, ''),
              command,
              state: parts[1]
            });
          }
        }
      }
    }

    // Remove duplicates
    const uniquePorts = [];
    const seen = new Set();
    for (const p of ports) {
      const key = `${p.port}-${p.pid}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePorts.push(p);
      }
    }

    return uniquePorts.sort((a, b) => a.port - b.port);
  }

  /**
   * Scan a specific port
   */
  async scanPort(port) {
    const activePorts = await this.getActivePorts();
    return activePorts.filter(p => p.port === port);
  }

  /**
   * Scan a range of ports
   */
  async scanRange(start, end) {
    const activePorts = await this.getActivePorts();
    return activePorts.filter(p => p.port >= start && p.port <= end);
  }

  /**
   * Scan common development ports
   */
  async scanCommonPorts() {
    const activePorts = await this.getActivePorts();
    const commonPortSet = new Set(COMMON_PORTS);
    return activePorts.filter(p => commonPortSet.has(p.port));
  }

  /**
   * Get detailed process info for a port
   */
  async getProcessInfo(port) {
    const ports = await this.scanPort(port);
    if (ports.length === 0) {
      return null;
    }

    const portInfo = ports[0];
    
    // Get process name
    let command;
    if (this.platform === 'win32') {
      command = `tasklist /FI "PID eq ${portInfo.pid}" /FO CSV /NH`;
    } else {
      command = `ps -p ${portInfo.pid} -o comm=`;
    }

    try {
      const output = await this.executeCommand(command);
      portInfo.processName = output.trim().split('\n')[0];
      
      // Try to get more details on macOS/Linux
      if (this.platform !== 'win32' && portInfo.pid) {
        const psCommand = `ps -p ${portInfo.pid} -o args=`;
        const argsOutput = await this.executeCommand(psCommand);
        portInfo.processArgs = argsOutput.trim();
      }
    } catch (error) {
      portInfo.processName = 'Unknown';
    }

    return portInfo;
  }

  /**
   * Display ports in a formatted table
   */
  displayPorts(ports) {
    if (ports.length === 0) {
      console.log('No ports found.');
      return;
    }

    console.log('\n' + '═'.repeat(70));
    console.log(' Port    PID       Protocol  Address     State      Command');
    console.log('═'.repeat(70));

    for (const p of ports) {
      const port = String(p.port).padEnd(7);
      const pid = String(p.pid || 'N/A').padEnd(9);
      const protocol = String(p.protocol || 'TCP').padEnd(8);
      const address = String(p.address || '*').padEnd(10);
      const state = String(p.state || 'LISTENING').padEnd(10);
      const command = p.command || p.processName || '';

      console.log(` ${port} ${pid} ${protocol} ${address} ${state} ${command}`);
    }

    console.log('═'.repeat(70));
    console.log(` Total: ${ports.length} port(s) in use\n`);
  }

  /**
   * Get all active ports summary
   */
  async getSummary() {
    const activePorts = await this.getActivePorts();
    return {
      total: activePorts.length,
      ports: activePorts.map(p => p.port),
      byPort: activePorts.reduce((acc, p) => {
        if (!acc[p.port]) {
          acc[p.port] = [];
        }
        acc[p.port].push(p);
        return acc;
      }, {})
    };
  }
}

module.exports = PortScanner;
