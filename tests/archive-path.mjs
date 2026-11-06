import path from 'node:path';

// ZIP entry names use '/', but extracted filesystem paths follow the host OS.
// Check the relative path rather than comparing platform-specific prefixes.
export function archivePath(destination, name, paths = path) {
  const target = paths.resolve(destination, name);
  const relative = paths.relative(paths.resolve(destination), target);
  if (!relative || relative === '..' || relative.startsWith('..' + paths.sep) || paths.isAbsolute(relative)) {
    throw new Error('ZIP entry escapes extraction destination: ' + name);
  }
  return target;
}
