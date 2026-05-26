import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export async function runShellText(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: Number(process.env.RUNTIME_CMD_TIMEOUT_MS || 120000)
  });
  return { stdout, stderr };
}

export async function runShellBuffer(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024,
    timeout: Number(process.env.RUNTIME_CMD_TIMEOUT_MS || 120000)
  });
  return { stdout, stderr };
}
