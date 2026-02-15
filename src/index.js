#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const PortScanner = require('./scanner');
const PortResolver = require('./resolver');

const program = new Command();

program
  .name('port-resolver')
  .description('Automatically detects and resolves port conflicts across local development services')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan for ports in use')
  .option('-p, --port <port>', 'Scan specific port')
  .option('-r, --range <range>', 'Scan port range (e.g., 3000-4000)')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const scanner = new PortScanner();
    
    try {
      if (options.port) {
        const ports = await scanner.scanPort(parseInt(options.port));
        if (options.json) {
          console.log(JSON.stringify(ports, null, 2));
        } else {
          scanner.displayPorts(ports);
        }
      } else if (options.range) {
        const [start, end] = options.range.split('-').map(Number);
        const ports = await scanner.scanRange(start, end);
        if (options.json) {
          console.log(JSON.stringify(ports, null, 2));
        } else {
          scanner.displayPorts(ports);
        }
      } else {
        const ports = await scanner.scanCommonPorts();
        if (options.json) {
          console.log(JSON.stringify(ports, null, 2));
        } else {
          scanner.displayPorts(ports);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error scanning ports:'), error.message);
      process.exit(1);
    }
  });

program
  .command('kill')
  .description('Kill process using a specific port')
  .argument('<port>', 'Port number')
  .option('-f, --force', 'Force kill without confirmation')
  .action(async (port, options) => {
    const resolver = new PortResolver();
    
    try {
      const result = await resolver.killPort(parseInt(port), options.force);
      if (result.success) {
        console.log(chalk.green(`✓ Successfully killed process on port ${port}`));
        console.log(chalk.gray(`  PID: ${result.pid}, Name: ${result.name}`));
      } else {
        console.log(chalk.yellow(`No process found on port ${port}`));
      }
    } catch (error) {
      console.error(chalk.red('Error killing port:'), error.message);
      process.exit(1);
    }
  });

program
  .command('resolve')
  .description('Resolve port conflict by finding an alternative port')
  .argument('<port>', 'Port that has conflict')
  .option('-a, --allocate <port>', 'Try to allocate specific port')
  .option('-c, --check', 'Check if port is available')
  .action(async (port, options) => {
    const resolver = new PortResolver();
    const scanner = new PortScanner();
    
    try {
      if (options.check) {
        const isAvailable = await resolver.isPortAvailable(parseInt(port));
        if (isAvailable) {
          console.log(chalk.green(`✓ Port ${port} is available`));
        } else {
          console.log(chalk.red(`✗ Port ${port} is in use`));
          const ports = await scanner.scanPort(parseInt(port));
          scanner.displayPorts(ports);
        }
        return;
      }

      if (options.allocate) {
        const targetPort = parseInt(options.allocate);
        const isAvailable = await resolver.isPortAvailable(targetPort);
        
        if (isAvailable) {
          console.log(chalk.green(`✓ Port ${targetPort} is available and ready to use`));
        } else {
          console.log(chalk.red(`✗ Port ${targetPort} is in use`));
          
          // Find alternative
          const alternative = await resolver.findAvailablePort(targetPort);
          console.log(chalk.yellow(`  Suggestion: Try port ${alternative}`));
          
          const ports = await scanner.scanPort(targetPort);
          scanner.displayPorts(ports);
        }
        return;
      }

      // Default: find an available port near the requested one
      const availablePort = await resolver.findAvailablePort(parseInt(port));
      console.log(chalk.green(`Port ${parseInt(port)} is in use.`));
      console.log(chalk.blue(`  Suggested alternative: ${availablePort}`));
      
    } catch (error) {
      console.error(chalk.red('Error resolving port:'), error.message);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch for port changes and notify')
  .argument('<port>', 'Port to watch')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '5')
  .action(async (port, options) => {
    const scanner = new PortScanner();
    
    console.log(chalk.blue(`Watching port ${port}... (Press Ctrl+C to stop)`));
    console.log(chalk.gray(`Check interval: ${options.interval} seconds\n`));
    
    const interval = setInterval(async () => {
      const ports = await scanner.scanPort(parseInt(port));
      if (ports.length > 0) {
        console.log(chalk.yellow(`[${new Date().toLocaleTimeString()}] Port ${port} is now in use:`));
        scanner.displayPorts(ports);
      } else {
        console.log(chalk.green(`[${new Date().toLocaleTimeString()}] Port ${port} is now available`));
      }
    }, parseInt(options.interval) * 1000);

    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.gray('\n\nStopped watching.'));
      process.exit(0);
    });
  });

program.parse();
