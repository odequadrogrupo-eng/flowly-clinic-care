import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDir = resolve(process.cwd(), ".output", "public");
const distDir = resolve(process.cwd(), "dist");

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await cp(sourceDir, distDir, { recursive: true });

  const assetsDir = resolve(distDir, "assets");
  const files = await readdir(assetsDir);
  const indexJs = files.find((file) => /^index-.*\.js$/.test(file));
  const stylesCss = files.find((file) => /^styles-.*\.css$/.test(file));

  if (!indexJs) {
    throw new Error("Unable to find client entry file in dist/assets (index-*.js)");
  }

  const html = [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "  <title>ClinicFlow</title>",
    stylesCss ? `  <link rel="stylesheet" href="/assets/${stylesCss}" />` : "",
    "</head>",
    "<body>",
    '  <div id="root"></div>',
    `  <script type="module" src="/assets/${indexJs}"></script>`,
    "</body>",
    "</html>",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(resolve(distDir, "index.html"), html, "utf8");

  const robotsPath = resolve(distDir, "robots.txt");
  const robots = await readFile(robotsPath, "utf8").catch(() => "User-agent: *\nAllow: /\n");
  if (!robots.includes("User-agent")) {
    await writeFile(robotsPath, "User-agent: *\nAllow: /\n", "utf8");
  }

  console.log("[build] dist generated from .output/public");
}

main().catch((error) => {
  console.error("[build] failed to generate dist", error);
  process.exitCode = 1;
});
