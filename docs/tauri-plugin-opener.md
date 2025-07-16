Opener
GitHub
npm
crates.io
API Reference
This plugin allows you to open files and URLs in a specified, or the default, application. It also supports “revealing” files in the system’s file explorer.

Supported Platforms
This plugin requires a Rust version of at least 1.77.2

Platform	Level	Notes
windows	
linux	
macos	
android	
Only allows to open URLs via open

ios	
Only allows to open URLs via open

Setup
Install the opener plugin to get started.

Automatic
Manual
Use your project’s package manager to add the dependency:

npm
yarn
pnpm
deno
bun
cargo
npm run tauri add opener

Usage
The opener plugin is available in both JavaScript and Rust.

JavaScript
Rust
import { openPath } from '@tauri-apps/plugin-opener';
// when using `"withGlobalTauri": true`, you may use
// const { openPath } = window.__TAURI__.opener;

// opens a file using the default program:
await openPath('/path/to/file');
// opens a file using `vlc` command on Windows:
await openPath('C:/path/to/file', 'vlc');

Permissions
By default all potentially dangerous plugin commands and scopes are blocked and cannot be accessed. You must modify the permissions in your capabilities configuration to enable these.

See the Capabilities Overview for more information and the step by step guide to use plugin permissions.

Below are two example scope configurations. Both path and url use the glob pattern syntax to define allowed file paths and URLs.

First, an example on how to add permissions to specific paths for the openPath() function:

src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "opener:allow-open-path",
      "allow": [
        {
          "path": "/path/to/file"
        },
        {
          "path": "$APPDATA/file"
        }
      ]
    }
  ]
}

Lastly, an example on how to add permissions for the exact https://tauri.app URL and all URLs on a custom protocol (must be known to the OS) for the openUrl() function:

src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        {
          "url": "https://tauri.app"
        },
        {
          "url": "custom:*"
        }
    }
  ]
}

Default Permission
This permission set allows opening mailto:, tel:, https:// and http:// urls using their default application as well as reveal file in directories using default file explorer

This default permission set includes the following:
allow-open-url
allow-reveal-item-in-dir
allow-default-urls
Permission Table
Identifier	Description
opener:allow-default-urls

This enables opening mailto:, tel:, https:// and http:// urls using their default application.

opener:allow-open-path

Enables the open_path command without any pre-configured scope.

opener:deny-open-path

Denies the open_path command without any pre-configured scope.

opener:allow-open-url

Enables the open_url command without any pre-configured scope.

opener:deny-open-url

Denies the open_url command without any pre-configured scope.

opener:allow-reveal-item-in-dir

Enables the reveal_item_in_dir command without any pre-configured scope.

opener:deny-reveal-item-in-dir

Denies the reveal_item_in_dir command without any pre-configured scope.
