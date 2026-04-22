#!/usr/bin/env node
/**
 * Build script for Maite Marchan's CV site (Spanish only).
 *
 * Inputs:  data/cv.json, data/projects.json
 *          data/cv.pdf, data/portafolio.pdf
 *          data/projects/*.png (extracted drawings)
 *          src/landing.html, src/resume.html, src/projects.html
 *          src/resume-body-partial.html
 *          src/styles.css
 *
 * Output:  dist/index.html             (intro)
 *          dist/resume/index.html      (CV)
 *          dist/projects/index.html    (portfolio)
 *          dist/cv.pdf, dist/portafolio.pdf
 *          dist/assets/projects/*.png
 *          dist/styles.css
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Mustache from "mustache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const dataDir = path.join(root, "data");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

const GITHUB_USER =
  process.env.GITHUB_USER ||
  process.env.GITHUB_REPOSITORY_OWNER ||
  "mmarchanv";
const BUILD_DATE = new Date().toISOString().slice(0, 10);

Mustache.escape = (text) => String(text);

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}
async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}
async function writeFile(dest, content) {
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, content, "utf8");
}
async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

function decorate(cv) {
  return {
    ...cv,
    hasWorkshops: Array.isArray(cv.workshops) && cv.workshops.length > 0,
    profile: {
      ...cv.profile,
      phoneDigits: cv.profile.phone.replace(/[^0-9]/g, ""),
    },
    githubUser: GITHUB_USER,
    buildDate: BUILD_DATE,
  };
}

async function main() {
  console.log("Building Maite Marchan CV site...");

  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(distDir);

  await copyFile(path.join(srcDir, "styles.css"), path.join(distDir, "styles.css"));

  try {
    await copyDir(path.join(srcDir, "assets"), path.join(distDir, "assets"));
    console.log("  OK dist/assets/ (src)");
  } catch {
    console.warn("  WARN no src/assets dir");
  }

  try {
    await copyDir(path.join(dataDir, "projects"), path.join(distDir, "assets", "projects"));
    console.log("  OK dist/assets/projects/");
  } catch {
    console.warn("  WARN no data/projects dir");
  }

  for (const pdf of ["cv.pdf", "portafolio.pdf"]) {
    const src = path.join(dataDir, pdf);
    try {
      await fs.access(src);
      await copyFile(src, path.join(distDir, pdf));
      console.log(`  OK dist/${pdf}`);
    } catch {
      console.warn(`  WARN missing ${pdf}`);
    }
  }

  const cv = await readJson(path.join(dataDir, "cv.json"));
  const projectsData = await readJson(path.join(dataDir, "projects.json"));
  const view = decorate(cv);

  const landingShell = await fs.readFile(path.join(srcDir, "landing.html"), "utf8");
  const resumeShell = await fs.readFile(path.join(srcDir, "resume.html"), "utf8");
  const projectsShell = await fs.readFile(path.join(srcDir, "projects.html"), "utf8");
  const resumeBodyTemplate = await fs.readFile(
    path.join(srcDir, "resume-body-partial.html"),
    "utf8"
  );

  const resumeBody = Mustache.render(resumeBodyTemplate, view);

  const landingHtml = Mustache.render(landingShell, view);
  await writeFile(path.join(distDir, "index.html"), landingHtml);
  console.log("  OK dist/index.html");

  const resumeHtml = Mustache.render(resumeShell, { ...view, resumeBody });
  await writeFile(path.join(distDir, "resume", "index.html"), resumeHtml);
  console.log("  OK dist/resume/index.html");

  const projectsView = { ...view, projects: projectsData.projects };
  const projectsHtml = Mustache.render(projectsShell, projectsView);
  await writeFile(path.join(distDir, "projects", "index.html"), projectsHtml);
  console.log("  OK dist/projects/index.html");

  await writeFile(path.join(distDir, ".nojekyll"), "");
  console.log("Build complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
