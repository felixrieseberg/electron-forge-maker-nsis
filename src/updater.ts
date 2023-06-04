import crypto from 'crypto';
import fs from 'fs';

/**
 * Returns an sha512 hash of the file at the given path
 */
export function getFileHash(filePath: string) {
  const hash = crypto.createHash('sha512');
  const stream = fs.createReadStream(filePath);
  hash.setEncoding('base64');

  return new Promise<string>((resolve, reject) => {
    stream.on('end', () => {
      hash.end();
      resolve(hash.read());
    });

    stream.on('error', (error) => {
      hash.end();
      reject(error);
    });

    stream.pipe(hash);
  });
}

/**
 * Returns file size in bytes
 */
export function getFileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

/**
 * Returns the version of the app at the given path, just so that
 * we and app-builder-lib always agree
 */
export function getVersion(filePath: string): string | null {
  const result = filePath.match(/Setup (.*)\.exe/);
  return !result ? null : result[1];
}
