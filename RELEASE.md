# Release Process for PaperAgents Plugin

This document explains how to create releases for the PaperAgents Obsidian plugin, including support for BRAT (Beta Reviewers Auto-update Tester).

## Quick Start

### Create a Production Release

1. Update the version in `manifest.json` (and optionally `minAppVersion`):
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   # or
   npm version minor  # 1.0.0 -> 1.1.0
   # or
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. Commit the version changes:
   ```bash
   git add .
   git commit -m "Bump version to X.Y.Z"
   git push
   ```

3. Create the release:
   ```bash
   npm run release
   ```

### Create a Beta Release

1. Manually update version in `manifest.json` to include beta suffix:
   ```json
   {
     "version": "1.0.1-beta.1"
   }
   ```

2. Sync version files:
   ```bash
   npm run version
   git add .
   git commit -m "Prepare beta release 1.0.1-beta.1"
   git push
   ```

3. Create the beta release:
   ```bash
   npm run release:beta
   ```

## How It Works

### The Automated Release Workflow

When you run `npm run release`, the following happens:

1. **Script Execution** (`create-release.mjs`):
   - Reads version from `manifest.json`
   - Builds the plugin (`npm run build`)
   - Creates a git tag matching the version
   - Pushes the tag to GitHub

2. **GitHub Actions** (`.github/workflows/release.yml`):
   - Triggered by the tag push
   - Checks out the code
   - Installs dependencies
   - Builds the plugin
   - Creates a GitHub release with:
     - Automatically generated release notes (from git commits)
     - Attached assets: `main.js`, `manifest.json`, `styles.css`
   - Marks releases with "beta" or "rc" in the tag as prereleases
   - For beta releases: cleans up old betas (keeps only the last 10)

### BRAT Plugin Support

[BRAT](https://tfthacker.com/BRAT) is a plugin that allows users to test beta versions of Obsidian plugins.

- **For Plugin Developers**: Create beta releases using `npm run release:beta`
- **For Plugin Users**: Add this repository URL to BRAT to get beta updates
- **Auto-cleanup**: Old beta releases (beyond the 10 most recent) are automatically deleted

## Manual Release (Without Automation)

If you prefer to create releases manually:

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Create and push a tag:
   ```bash
   git tag -a 1.0.1 -m "Release 1.0.1"
   git push origin 1.0.1
   ```

3. The GitHub Action will automatically create the release with assets.

## Release Management

### View Releases
- GitHub Releases: https://github.com/merlinbecker/PaperAgents/releases
- GitHub Actions: https://github.com/merlinbecker/PaperAgents/actions

### Delete a Release
Using GitHub CLI:
```bash
gh release delete <tag-name> --yes
git tag -d <tag-name>
git push origin :refs/tags/<tag-name>
```

### Beta Release Cleanup
- **Automatic**: The workflow keeps only the last 10 beta releases
- **Manual**: Delete specific beta releases using the GitHub UI or `gh release delete`

## Troubleshooting

### Build Fails
```bash
npm ci          # Clean install dependencies
npm run build   # Test build locally
```

### Tag Already Exists
```bash
git tag -d <tag-name>           # Delete local tag
git push origin :refs/tags/<tag-name>  # Delete remote tag
npm run release                 # Try again
```

### Workflow Doesn't Trigger
- Ensure you pushed the tag: `git push origin <tag-name>`
- Check GitHub Actions tab for errors
- Verify workflow file syntax at https://github.com/merlinbecker/PaperAgents/actions

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., `1.0.0`)
- **MAJOR.MINOR.PATCH-beta.N** for beta releases (e.g., `1.0.1-beta.1`)

Examples:
- `1.0.0` → `1.0.1` - Bug fixes (patch)
- `1.0.0` → `1.1.0` - New features (minor)
- `1.0.0` → `2.0.0` - Breaking changes (major)
- `1.0.1-beta.1` - Beta version for testing

## Assets Included in Releases

Every release includes:
- `main.js` - The bundled plugin code
- `manifest.json` - Plugin metadata
- `styles.css` - Plugin styles

These are the files required by Obsidian and BRAT to install the plugin.
