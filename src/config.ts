import { SignOptions } from 'electron-windows-sign';

export type CodesignOptions = Omit<SignOptions, 'appDirectory'>

export interface MakerNSISConfig {
  codesign?: CodesignOptions,
  updater?: {
    url: string,
    channel?: string,
    updaterCacheDirName?: string,
    publisherName?: string
  }
}
