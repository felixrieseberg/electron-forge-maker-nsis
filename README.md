# electron-forge-maker-nsis [![npm][npm_img]][npm_url]

An `electron-forge` maker for NSIS that supports `electron-forge` v6 and can be used as a
replacement for `electron-builder`. Supports code-signing and basic updates with `electron-updater`.

This maker takes two configuration objects: `codesigning` for codesigning and `updater` for `electron-updater` support. Both of them are optional, the feature in question will simply be turned off if not provided.

- `codesigning` is passed directly to [@electron/windows-sign](https://github.com/electron/windows-sign) and supports all its options (except for `appDirectory`, which is provided directly by this maker).
- `updater`
  - `url`: URL to the location of yml files.
  - `updaterCacheDirName`: Name of the local cache. By default `${name}-updater`.
  - `channel`: Name of the update channel. By default `latest`.
  - `publisherName`: Used to verify the code signature. 

```ts
// forge.config.js with minimal configuration
makers: [
    {
      name: "@felixrieseberg/electron-forge-maker-nsis",
      config: {},
    }
  ]
```

```ts
  // forge.config.js with example configuration
  makers: [
    {
      name: "@felixrieseberg/electron-forge-maker-nsis",
      config: {
        codesigning: {
          certificateFile?: string;
          certificatePassword?: string;
        },
        updater: {
					url: "https://s3-us-west-2.amazonaws.com/my-bucket",
					updaterCacheDirName: "my-updater",
          channel: "latest",
          publisherName: "My Company, Inc."
				}
      },
    }
  ]
```

## Updating

This tool supports ["generic" updates][https://www.electron.build/configuration/publish.html#publishers] with `electron-updater`. 

# License
MIT. Please see LICENSE for details.

[electron]: https://github.com/electron/electron
[npm_img]: https://img.shields.io/npm/v/@felixrieseberg/electron-forge-maker-nsis.svg
[npm_url]: https://npmjs.org/package/@felixrieseberg/electron-forge-maker-nsis
