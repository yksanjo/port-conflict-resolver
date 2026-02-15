const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const net = require('net');
const readline = require('readline');

class PortResolver {
  constructor() {
    this.platform = process.platform;
  }

  /**
   * Check if a port is available (not in use)
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Find an available port near the requested port
   */
  async findAvailablePort(startPort = 3000, maxAttempts = 100) {
    // If the start port is available, return it
    if (await this.isPortAvailable(startPort)) {
      return startPort;
    }
    
    // Search for the next available port
    for (let i = 1; i < maxAttempts; i++) {
      const port = startPort + i;
      if (port > 65535) break;
      
      const available = await this.isPortAvailable(port);
      if (available) {
        return port;
      }
    }
    
    throw new Error(`Could not find available port within ${maxAttempts} attempts`);
  }

  /**
   * Get PID of process using a specific port
   */
  async getPortPid(port) {
    let command;
    
    if (this.platform === 'win32') {
      command = `netstat -ano | findstr :${port} | findstr LISTENING`;
    } else if (this.platform === 'darwin') {
      command = `lsof -i :${port} -t`;
    } else {
      // Linux
      command = `ss -tulpn | grep :${port}`;
    }

    try {
      const { stdout } = await execPromise(command);
      
      if (this.platform === 'win32') {
        const match = stdout.match(/LISTENING\s+(\d+)/);
        return match ? parseInt(match[1]) : null;
      } else if (this.platform === 'darwin') {
        const pid = stdout.trim();
        return pid ? parseInt(pid) : null;
      } else {
        const match = stdout.match(/pid=(\d+)/);
        return match ? parseInt(match[1]) : null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Kill process using a specific port
   */
  async killPort(port, force = false) {
    const pid = await this.getPortPid(port);
    
    if (!pid) {
      return { success: false, message: 'No process found on this port' };
    }

    // Get process name before killing
    let processName = 'Unknown';
    try {
      if (this.platform === 'win32') {
        const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
        processName = stdout.trim().split(',')[0] || 'Unknown';
      } else {
        const { stdout } = await execPromise(`ps -p ${pid} -o comm=`);
        processName = stdout.trim() || 'Unknown';
      }
    } catch (error) {
      // Ignore errors getting process name
    }

    // Ask for confirmation unless force flag is set
    if (!force) {
      const confirmed = await this.askConfirmation(
        `Are you sure you want to kill process ${processName} (PID: ${pid}) on port ${port}? (y/N): `
      );
      
      if (!confirmed) {
        return { success: false, message: 'Cancelled by user' };
      }
    }

    // Kill the process
    try {
      if (this.platform === 'win32') {
        await execPromise(`taskkill /PID ${pid} /F`);
      } else {
        // Try SIGTERM first, then SIGKILL if needed
        try {
          await execPromise(`kill -TERM ${pid}`);
        } catch (error) {
          // If SIGTERM fails, try SIGKILL
          await execPromise(`kill -9 ${pid}`);
        }
      }
      
      // Wait a bit and verify the port is free
      await this.delay(500);
      const stillInUse = await this.getPortPid(port);
      
      if (stillInUse) {
        return { 
          success: false, 
          message: 'Process may still be running',
          pid,
          name: processName
        };
      }
      
      return { 
        success: true, 
        message: 'Process killed successfully',
        pid,
        name: processName
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message,
        pid,
        name: processName
      };
    }
  }

  /**
   * Kill all processes on a list of ports
   */
  async killPorts(ports, force = false) {
    const results = [];
    
    for (const port of ports) {
      const result = await this.killPort(port, force);
      results.push({ port, ...result });
    }
    
    return results;
  }

  /**
   * Auto-resolve port conflict by killing conflicting process
   */
  async autoResolve(port, force = false) {
    const pid = await this.getPortPid(port);
    
    if (!pid) {
      return {
        resolved: false,
        port,
        message: 'Port is not in use'
      };
    }

    const result = await this.killPort(port, force);
    
    return {
      resolved: result.success,
      port,
      pid,
      ...result
    };
  }

  /**
   * Get all ports that are in use in a range
   */
  async getUsedPortsInRange(start, end) {
    const usedPorts = [];
    
    for (let port = start; port <= end; port++) {
      const available = await this.isPortAvailable(port);
      if (!available) {
        usedPorts.push(port);
      }
    }
    
    return usedPorts;
  }

  /**
   * Suggest a port configuration for common frameworks
   */
  static getFrameworkSuggestions() {
    return {
      'React/Vite': [5173, 5174, 5175, 5180],
      'Next.js': [3000, 3001, 3002, 3003],
      'Create React App': [3000, 3001, 3002],
      'Vue CLI/Vite': [5173, 5174, 5175, 8080],
      'Angular': [4200, 4201],
      'Express': [3000, 4000, 5000, 8080],
      'FastAPI': [8000, 8001, 8080],
      'Flask': [5000, 5001, 8000],
      'Django': [8000, 8001, 8080],
      'Ruby on Rails': [3000, 5000],
      'Laravel': [8000, 8001],
      'Node.js': [3000, 4000, 5000, 8080],
      'NestJS': [3000, 4000, 5000],
      'Gatsby': [8000, 8001],
      'Hugo': [1313, 1314],
      'Spring Boot': [8080, 8081, 8443],
      'ASP.NET Core': [5000, 5001, 8080],
      'Docker': [2375, 2376, 5000, 8080],
      'PostgreSQL': [5432, 5433],
      'MySQL': [3306, 3307],
      'MongoDB': [27017, 27018, 27019],
      'Redis': [6379, 6380],
      'Elasticsearch': [9200, 9300],
    };
  }

  /**
   * Find best available port for a specific framework
   */
  async findPortForFramework(framework) {
    const suggestions = PortResolver.getFrameworkSuggestions();
    const preferredPorts = suggestions[framework] || [3000, 4000, 5000, 8000];
    
    for (const port of preferredPorts) {
      const available = await this.isPortAvailable(port);
      if (available) {
        return port;
      }
    }
    
    // If none of the preferred ports are available, find any available port
    return await this.findAvailablePort(3000);
  }

  /**
   * Helper: Ask for user confirmation
   */
  async askConfirmation(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Helper: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PortResolver;
