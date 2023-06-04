import MakerBase, { MakerOptions } from '@electron-forge/maker-base';
import { sign } from 'electron-windows-sign';
import { buildForge } from 'app-builder-lib';
import fs from 'fs-extra';
import path from 'path';

import { MakerNSISConfig } from './config';
import { getFileHash, getFileSize, getVersion } from './updater';

import debug from 'debug';
const log = debug('electron-forge:maker:nsis');

export default class MakerNSIS extends MakerBase<MakerNSISConfig> {
  name = 'nsis';

  defaultPlatforms: string[] = ['win32'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  async codesign(options: MakerOptions, outPath: string) {
    if (this.config.codesign) {
      try {
        await sign({ ...this.config.codesign, appDirectory: outPath });
      } catch (error) {
        console.error('Failed to codesign using electron-windows-sign. Check your config and the output for details!', error);
        throw error;
      }

      // Setup signing. If these variables are set, app-builder-lib will actually
      // codesign.
      if (!process.env.CSC_LINK) {
        log(`Setting process.env.CSC_LINK to ${this.config.codesign.certificateFile}`);
        process.env.CSC_LINK = this.config.codesign.certificateFile;
      }

      if (!process.env.CSC_KEY_PASSWORD) {
        log('Setting process.env.CSC_KEY_PASSWORD to the passed password');
        process.env.CSC_KEY_PASSWORD = this.config.codesign.certificatePassword;
      }
    } else {
      log('Skipping code signing, if you need it set \'config.codesign\'');
    }
  }

  /**
   * Maybe creates an app-update.yml, compatible with electron-updater
   */
  async createAppUpdateYml(options: MakerOptions, outPath: string) {
    if (!this.config.updater) return;

    const name = options.appName;
    const url = this.config.updater.url;
    const channel = this.config.updater.channel || 'latest';
    const updaterCacheDirName = this.config.updater.updaterCacheDirName || `${name.toLowerCase()}-updater`;
    const ymlContents = `provider: generic
url: '${url}'
channel: ${channel}
updaterCacheDirName: ${updaterCacheDirName}\n`;

    log(`Writing app-update.yml to ${outPath}`, ymlContents);
    await fs.writeFile(path.resolve(outPath, 'app-update.yml'), ymlContents, 'utf8');
  }

  async createChannelYml(options: MakerOptions, outPath: string, installerPath: string) {
    if (!this.config.updater) return;

    const channel = this.config.updater.channel || 'latest';
    const installerHash = await getFileHash(installerPath);
    const installerSize = getFileSize(installerPath);
    const installerVersion = getVersion(installerPath);
    const installerName = path.basename(installerPath);
    const channelFilePath = path.resolve(outPath, `${channel}.yml`);

    const ymlContents = `version: ${installerVersion}
files:
  - url: ${installerName}
    sha512: ${installerHash}
    size: ${installerSize}
path: ${installerName}
sha512: ${installerHash}
releaseDate: '${new Date().toISOString()}'\n`;

    log(`Writing ${channel}.yml to ${outPath}`, ymlContents);
    await fs.writeFile(channelFilePath, ymlContents, 'utf8');

    return channelFilePath;
  }

  async make(options: MakerOptions): Promise<string[]> {
    // Copy everything to a temporary location
    const { makeDir, targetArch } = options;
    const outPath = path.resolve(makeDir, `nsis/${targetArch}`);
    const tmpPath = path.resolve(makeDir, `nsis/${targetArch}-tmp`);
    const result: Array<string> = [];
    let installerPath = '';

    log(`Emptying directories: ${tmpPath}, ${outPath}`);
    await fs.emptyDir(tmpPath);
    await fs.emptyDir(outPath);
    log(`Copying contents of ${options.dir} to ${tmpPath}`);
    await fs.copy(options.dir, tmpPath);

    // Codesign
    await this.codesign(options, tmpPath);

    // Updater: Create the app-update.yml that goes _into_ the
    // application package
    await this.createAppUpdateYml(options, tmpPath);

    // Actually make the NSIS
    log(`Calling app-builder-lib's buildForge() with ${tmpPath}`);
    const output = await buildForge({ dir: tmpPath }, { win: [`nsis:${options.targetArch}`] });

    // Move the output to the actual output folder, app-builder-lib might get it wrong
    log('Received output files', output);
    for (const file of output) {
      const filePath = path.resolve(outPath, path.basename(file));
      result.push(filePath);

      if (path.extname(file) === '.exe') {
        installerPath = filePath;
      }

      await fs.move(file, filePath);
    }

    // We need to create an installer to maybe create an updater channel file -
    // if we did not make one yet, error out
    if (!installerPath) {
      throw new Error('Could not find the installer, did we create one?');
    }

    // Updater: Create the channel file that goes _next to_ the installer
    const channelFile = await this.createChannelYml(options, outPath, installerPath);
    if (channelFile) result.push(channelFile);

    // Cleanup
    await fs.remove(tmpPath);
    await fs.remove(path.resolve(makeDir, 'nsis/make'));

    return result;
  }
}
