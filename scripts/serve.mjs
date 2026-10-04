import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "site");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
let port = 5178;
server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && port < 5190) {
    port++;
    server.listen(port, "127.0.0.1");
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
server.on("listening", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(
    `\nTimber Studio is running at ${url}\nKeep this window open. Press Ctrl+C to stop.\nProjects are stored separately per address; use Export to move a build.\n`,
  );
  if (!process.argv.includes("--no-open")) {
    if (process.platform === "win32")
      spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
        stdio: "ignore",
      });
    else
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
        stdio: "ignore",
      });
  }
});
server.listen(port, "127.0.0.1");
