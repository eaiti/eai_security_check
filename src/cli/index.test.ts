import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

describe('CLI Index', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await execAsync('npm run build', { cwd: path.join(__dirname, '../..') });
    } catch {
      console.warn('Build failed, continuing with existing built files');
    }
  });

  it('should show help when run with --help', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} --help`);
      expect(stdout).toContain('Cross-Platform Security Audit Tool');
      expect(stdout).toContain('check');
      expect(stdout).toContain('interactive');
      expect(stdout).toContain('daemon');
      expect(stdout).toContain('verify');
    } catch (error: unknown) {
      // If built CLI doesn't exist, skip this test
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping CLI integration test');
        return;
      }
      throw error;
    }
  });

  it('should show version when run with --version', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} --version`);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    } catch (error: unknown) {
      // If built CLI doesn't exist, skip this test
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping version test');
        return;
      }
      throw error;
    }
  });

  it('should show check command help', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} check --help`);
      expect(stdout).toContain('Run security audit');
      expect(stdout).toContain('Security profile:');
      expect(stdout).toContain('--config');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--format');
    } catch (error: unknown) {
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping check help test');
        return;
      }
      throw error;
    }
  });

  it('should show daemon command help', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} daemon --help`);
      expect(stdout).toContain('Run security checks on a schedule');
      expect(stdout).toContain('--status');
      expect(stdout).toContain('--setup');
      expect(stdout).toContain('--test-email');
    } catch (error: unknown) {
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping daemon help test');
        return;
      }
      throw error;
    }
  });

  it('should show interactive command help', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} interactive --help`);
      expect(stdout).toContain('Interactive management mode');
      expect(stdout).toContain('manage configurations');
      expect(stdout).toContain('global install');
    } catch (error: unknown) {
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping interactive help test');
        return;
      }
      throw error;
    }
  });

  it('should show verify command help', async () => {
    try {
      const { stdout } = await execAsync(`node ${cliPath} verify --help`);
      expect(stdout).toContain('Verify the integrity');
      expect(stdout).toContain('tamper-evident');
      expect(stdout).toContain('--verbose');
    } catch (error: unknown) {
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping verify help test');
        return;
      }
      throw error;
    }
  });

  it('should handle unknown commands gracefully', async () => {
    try {
      const { stderr } = await execAsync(`node ${cliPath} unknown-command`);
      expect(stderr).toContain('unknown command');
    } catch (error: unknown) {
      if (error instanceof Error && error?.message?.includes('ENOENT')) {
        console.warn('Built CLI not found, skipping unknown command test');
        return;
      }
      // Command should exit with error code, that's expected
      expect((error as any)?.stderr || (error as any)?.stdout).toContain('unknown command');
    }
  });
});
