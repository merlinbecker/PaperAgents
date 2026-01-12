# Obsidian Sample Plugin

This is a sample plugin for Obsidian (https://obsidian.md).

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This sample plugin demonstrates some of the basic functionality the plugin API can do.
- Adds a ribbon icon, which shows a Notice when clicked.
- Adds a command "Open modal (simple)" which opens a Modal.
- Adds a plugin setting tab to the settings page.
- Registers a global click event and output 'click' to the console.
- Registers a global interval which logs 'setInterval' to the console.

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

This plugin supports automated release creation via GitHub Actions and npm commands, making it compatible with BRAT (Beta Reviewers Auto-update Tester) for beta testing.

### Automated Release Process (Recommended)

#### For Production Releases:

1. **Update version numbers:**
   ```bash
   # Update minAppVersion in manifest.json if needed, then:
   npm version patch  # for bug fixes (1.0.0 -> 1.0.1)
   npm version minor  # for new features (1.0.0 -> 1.1.0)
   npm version major  # for breaking changes (1.0.0 -> 2.0.0)
   ```
   This updates `manifest.json`, `package.json`, and `versions.json` automatically.

2. **Commit and push changes:**
   ```bash
   git push
   ```

3. **Create and push a release:**
   ```bash
   npm run release
   ```
   This script will:
   - Build the plugin
   - Create a git tag matching the version in `manifest.json`
   - Push the tag to GitHub
   - Trigger GitHub Actions to create the release with assets

#### For Beta Releases (BRAT compatible):

1. **Update version to beta:**
   - Manually update version in `manifest.json` (e.g., `1.0.1-beta.1`)
   - Run `npm run version` to sync versions

2. **Create beta release:**
   ```bash
   npm run release:beta
   ```
   This creates a prerelease that:
   - Is marked as a beta/prerelease on GitHub
   - Can be installed via BRAT plugin
   - Will be automatically cleaned up (old betas beyond the last 10 are deleted)

#### How it works:

- Pushing a tag triggers the `.github/workflows/release.yml` workflow
- The workflow automatically:
  - Builds the plugin (`main.js`)
  - Creates a GitHub release
  - Uploads `manifest.json`, `main.js`, and `styles.css` as release assets
  - Generates release notes from git commits
  - Marks releases containing "beta" or "rc" as prereleases
  - Cleans up old beta releases (keeps only the last 10)

### Manual Release Process (Alternative)

If you prefer manual control:

1. Update `manifest.json` with your new version number and minimum Obsidian version
2. Update `versions.json` with the new version mapping
3. Build the plugin: `npm run build`
4. Create a git tag: `git tag -a 1.0.1 -m "Release 1.0.1"`
5. Push the tag: `git push origin 1.0.1`
6. The GitHub Action will handle the rest automatically

### BRAT Plugin Support

This plugin is configured to work with [BRAT (Beta Reviewers Auto-update Tester)](https://tfthacker.com/BRAT):

- Beta releases are automatically marked as prereleases
- Users can install beta versions via BRAT by providing the repository URL
- Old beta releases are automatically cleaned up to avoid clutter
- BRAT will automatically update users to the latest beta version

### Release Management

- **View releases:** Check https://github.com/merlinbecker/PaperAgents/releases
- **Monitor builds:** Check https://github.com/merlinbecker/PaperAgents/actions
- **Delete a release:** Use GitHub UI or `gh release delete <tag>`
- **Beta cleanup:** Automatic - keeps only the last 10 beta releases

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- This project already has eslint preconfigured, you can invoke a check by running`npm run lint`
- Together with a custom eslint [plugin](https://github.com/obsidianmd/eslint-plugin) for Obsidan specific code guidelines.
- A GitHub action is preconfigured to automatically lint every commit on all branches.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://docs.obsidian.md
