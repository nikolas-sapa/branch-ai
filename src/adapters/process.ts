import { spawn } from "node:child_process";

/** Decode complete lines and validate process completion before reporting success. */
export async function* processLines(command: string, args: string[]): AsyncGenerator<string> {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  let spawnError: Error | undefined;
  let closed = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-4096);
  });
  child.on("error", (error: Error) => { spawnError = error; });
  const completion = new Promise<Error | undefined>((resolve) => {
    child.on("close", (code, signal) => {
      closed = true;
      if (spawnError) resolve(new Error(`${command} failed to start: ${spawnError.message}`));
      else if (code !== 0) resolve(new Error(
        `${command} exited with ${signal ? `signal ${signal}` : `exit code ${code}`}${stderr ? `: ${stderr}` : ""}`
      ));
      else resolve(undefined);
    });
  });

  try {
    let buffer = "";
    for await (const chunk of child.stdout) {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        yield buffer.slice(0, newline + 1);
        buffer = buffer.slice(newline + 1);
      }
    }
    if (buffer) yield buffer;
    const failure = await completion;
    if (failure) throw failure;
  } finally {
    if (!closed) child.kill();
  }
}
