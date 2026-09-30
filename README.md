<div align="center">
  <img src="public/logo.png" alt="Blimy" width="120">
  <h1>Blimy</h1>
  <p>A lightweight, cross-platform code editor, built with <a href="https://tauri.app/" title="Tauri">Tauri</a> (Rust and React) with Git support, AI agents, vim keybindings.</p>
  <img src="public/screenshot.png" alt="Blimy Screenshot" width="800">
</div>

## Features

- AI agents
- Git integration
- Syntax highlighting
- LSP support
- Vim keybindings
- Integrated terminal
- Database viewers
- Collaboration
- Enterprise policy controls (managed mode + extension allowlist)

## Installation

### Quick install

macOS and Linux:

```bash
curl -fsSL https://Blimy.dev/install.sh | sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://Blimy.dev/install.ps1 | iex"
```

The install scripts detect your operating system and architecture, download the latest stable
release, and verify its SHA256 checksum when one is available. You can review the
[macOS and Linux script](https://Blimy.dev/install.sh) or
[Windows script](https://Blimy.dev/install.ps1) before running it.

To install the latest preview release on macOS or Linux:

```bash
curl -fsSL https://Blimy.dev/install.sh | sh -s -- --preview
```

### Package managers

Homebrew on macOS:

```bash
brew install --cask Blimy
```

WinGet on Windows:

```powershell
winget install --id=Blimydev.Blimy -e
```

Scoop on Windows:

```powershell
scoop bucket add Blimy https://github.com/Blimydev/scoop-Blimy
scoop install Blimy
```

### Manual download

Prebuilt packages for macOS, Windows, and Linux are available on the
[GitHub Releases page](https://github.com/antan2002/blimy/releases). Linux releases include native
`.deb` and `.rpm` packages as well as a portable `.tar.gz` bundle.

See the [installation guide](https://Blimy.dev/docs/installation) for detailed platform steps,
install locations, and uninstall instructions.

## Development

To build Blimy from source, install [Node.js 24](https://nodejs.org),
[Bun 1.3.14](https://bun.sh), and [Rust](https://rustup.rs), then run:

```bash
git clone https://github.com/antan2002/blimy.git
cd Blimy
bun setup
bun dev
```

`bun setup` installs the project dependencies and checks the native requirements for your
platform. See the [contributing guide](CONTRIBUTING.md) for validation commands and contribution
guidelines.

## Documentation

See the [documentation](https://Blimy.dev/docs).

## Contributing

Contributions are welcome! See the [contributing guide](CONTRIBUTING.md) and [Contributor License and Feedback Agreement](CONTRIBUTOR_LICENSE_AND_FEEDBACK_AGREEMENT.md).

## Support

- [Issues](https://github.com/antan2002/blimy/issues)
- [Discussions](https://github.com/antan2002/blimy/discussions)
- [Discord](https://discord.gg/DD8F38wFMv)

## License

[AGPL-3.0](LICENSE)
