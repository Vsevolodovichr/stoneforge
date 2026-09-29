import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function pickProjectDirectory(): Promise<string | null> {
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$dialog.Description = "Select a Stoneforge project directory"',
      '$dialog.UseDescriptionForTitle = $true',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }',
    ].join('; ');

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], {
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    const selectedPath = stdout.trim();
    return selectedPath || null;
  }

  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Select a Stoneforge project directory")',
    ], { maxBuffer: 64 * 1024 });
    const selectedPath = stdout.trim();
    return selectedPath || null;
  }

  const { stdout } = await execFileAsync('zenity', [
    '--file-selection',
    '--directory',
    '--title=Select a Stoneforge project directory',
  ], { maxBuffer: 64 * 1024 });
  const selectedPath = stdout.trim();
  return selectedPath || null;
}
