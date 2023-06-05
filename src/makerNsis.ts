import MakerBase, { MakerOptions } from '@electron-forge/maker-base';
import { sign } from 'electron-windows-sign';
import { buildForge } from 'app-builder-lib';
import fs from 'fs-extra';
import path from 'path';
import debug from 'debug';
import { getChannelYml, getAppUpdateYml } from 'electron-updater-yaml';

import { MakerNSISConfig } from './config';

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

    const ymlContents = await getAppUpdateYml({
      url: this.config.updater.url,
      name: options.appName,
      channel: this.config.updater.channel,
      updaterCacheDirName: this.config.updater.updaterCacheDirName
    });

    log(`Writing app-update.yml to ${outPath}`, ymlContents);
    await fs.writeFile(path.resolve(outPath, 'app-update.yml'), ymlContents, 'utf8');
  }

  async createChannelYml(options: MakerOptions, installerPath: string) {
    if (!this.config.updater) return;

    const channel = this.config.updater.channel || 'latest';
    const version = options.packageJSON.version;
    const channelFilePath = path.resolve(installerPath, `${channel}.yml`);

    const ymlContents = await getChannelYml({
      installerPath,
      version,
      platform: 'win32'
    });

    log(`Writing ${channel}.yml to ${installerPath}`, ymlContents);
    await fs.writeFile(channelFilePath, ymlContents, 'utf8');
    return channelFilePath;
  }

  async make(options: MakerOptions): Promise<string[]> {
    // Copy everything to a temporary location
    const { makeDir, targetArch } = options;
    const outPath = path.resolve(makeDir, `nsis/${targetArch}`);
    const tmpPath = path.resolve(makeDir, `nsis/${targetArch}-tmp`);
    const result: Array<string> = [];

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

      await fs.move(file, filePath);
    }

    // Updater: Create the channel file that goes _next to_ the installer
    const channelFile = await this.createChannelYml(options, outPath);
    if (channelFile) result.push(channelFile);

    // Cleanup
    await fs.remove(tmpPath);
    await fs.remove(path.resolve(makeDir, 'nsis/make'));

    return result;
  }
}
