<div align="center">
  <img src="public/logo.png" alt="blimy" width="120">
  <h1>blimy</h1>
  <p>A lightweight, cross-platform code editor, built with <a href="https://tauri.app/" title="Tauri">Tauri</a> (Rust and React) with Git support, AI agents, vim keybindings.</p>
  <p><em>*Originally forked from and inspired by Athas.*</em></p>
  <img src="public/screenshot.png" alt="blimy screenshot" width="800">
  <br><br>
  <div>
    <img src="extensions/official/claude-code/icon.svg" width="48" alt="Claude"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/gemini-cli/icon.svg" width="48" alt="Gemini"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/github-copilot/icon.svg" width="48" alt="GitHub Copilot"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/antigravity/icon.svg" width="48" alt="Google Antigravity"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/kimi-cli/icon.svg" width="48" alt="Kimi"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/opencode/icon.svg" width="48" alt="OpenCode"> &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="extensions/official/qwen-code/icon.svg" width="48" alt="Qwen">
  </div>
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
curl -fsSL https://blimy.dev/install.sh | sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://blimy.dev/install.ps1 | iex"
```

The install scripts detect your operating system and architecture, download the latest stable
release, and verify its SHA256 checksum when one is available. You can review the
[macOS and Linux script](https://blimy.dev/install.sh) or
[Windows script](https://blimy.dev/install.ps1) before running it.

To install the latest preview release on macOS or Linux:

```bash
curl -fsSL https://blimy.dev/install.sh | sh -s -- --preview
```

### Package managers

Homebrew on macOS:

```bash
brew install --cask blimy
```

WinGet on Windows:

```powershell
winget install --id=blimydev.Blimy -e
```

Scoop on Windows:

```powershell
scoop bucket add blimy https://github.com/blimydev/scoop-blimy
scoop install blimy
```

### Manual download

Prebuilt packages for macOS, Windows, and Linux are available on the
[GitHub Releases page](https://github.com/blimydev/blimy/releases). Linux releases include native
`.deb` and `.rpm` packages as well as a portable `.tar.gz` bundle.

See the [installation guide](https://blimy.dev/docs/installation) for detailed platform steps,
install locations, and uninstall instructions.

## Development

To build Blimy from source, install [Node.js 24](https://nodejs.org),
[Bun 1.3.14](https://bun.sh), and [Rust](https://rustup.rs), then run:

```bash
git clone https://github.com/blimydev/blimy.git
cd blimy
bun setup
bun dev
```

`bun setup` installs the project dependencies and checks the native requirements for your
platform. See the [contributing guide](CONTRIBUTING.md) for validation commands and contribution
guidelines.

## Documentation

See the [documentation](https://blimy.dev/docs).

## Contributing

Contributions are welcome! See the [contributing guide](CONTRIBUTING.md) and [Contributor License and Feedback Agreement](CONTRIBUTOR_LICENSE_AND_FEEDBACK_AGREEMENT.md).

## Support

- [Issues](https://github.com/blimydev/blimy/issues)
- [Discussions](https://github.com/blimydev/blimy/discussions)
- [Discord](https://discord.gg/DD8F38wFMv)

## License

[AGPL-3.0](LICENSE)
