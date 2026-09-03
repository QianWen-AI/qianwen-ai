import fs from "node:fs";
import path from "node:path";

const CACHE = new Map();

/**
 * Find the enclosing Git worktree root without executing Git. A `.git` file is
 * accepted for linked worktrees and submodules as well as the usual directory.
 *
 * @param {string} start canonical absolute starting directory
 * @returns {string | null} enclosing worktree root, or null outside a worktree
 */
function findWorktreeRoot(start) {
  let current = start;
  while (true) {
    try {
      fs.lstatSync(path.join(current, ".git"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

/**
 * Return whether `candidate` is the same path as `base` or is contained by it.
 *
 * @param {string} base canonical absolute base path
 * @param {string} candidate canonical absolute candidate path
 * @returns {boolean}
 */
function isWithin(base, candidate) {
  const normalizedBase = process.platform === "win32" ? base.toLowerCase() : base;
  const normalizedCandidate = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  const relative = path.relative(normalizedBase, normalizedCandidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/**
 * Resolve an executable from absolute PATH entries while excluding the current
 * Git worktree. Both PATH directories and executable targets are canonicalized
 * so relative entries and symlink aliases cannot bypass the gate.
 *
 * @param {string} command executable basename
 * @returns {string | null} absolute executable path, or null when unavailable
 */
export function resolveExecutable(command) {
  const pathValue = process.env.PATH || "";
  const pathExtValue = process.env.PATHEXT || "";
  const cacheKey = `${process.cwd()}\0${pathValue}\0${pathExtValue}\0${command}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey);

  const isWindows = process.platform === "win32";
  let currentDirectory;
  try {
    currentDirectory = fs.realpathSync(process.cwd());
  } catch {
    CACHE.set(cacheKey, null);
    return null;
  }
  const excludedRoot = findWorktreeRoot(currentDirectory);

  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions = isWindows
    ? (pathExtValue || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];

  for (const directory of directories) {
    if (!path.isAbsolute(directory)) continue;

    let canonicalDirectory;
    try {
      canonicalDirectory = fs.realpathSync(directory);
    } catch {
      continue;
    }
    if (excludedRoot !== null && isWithin(excludedRoot, canonicalDirectory)) continue;

    for (const extension of extensions) {
      const candidate = path.join(canonicalDirectory, command + extension);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (!isWindows) fs.accessSync(candidate, fs.constants.X_OK);
        const canonicalCandidate = fs.realpathSync(candidate);
        if (excludedRoot !== null && isWithin(excludedRoot, canonicalCandidate)) continue;
        CACHE.set(cacheKey, candidate);
        return candidate;
      } catch {
        // Not a usable or trusted candidate; keep scanning.
      }
    }
  }

  CACHE.set(cacheKey, null);
  return null;
}
