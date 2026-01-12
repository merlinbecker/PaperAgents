#!/usr/bin/env node

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { createInterface } from "readline";

/**
 * Create a GitHub release for the Obsidian plugin
 * Usage: npm run release [tag] [--beta]
 * Examples:
 *   npm run release           # Creates release with version from manifest.json
 *   npm run release 1.0.1     # Creates release with custom tag
 *   npm run release:beta      # Creates beta release
 */

// Use absolute paths for commands to avoid PATH manipulation vulnerabilities
const GIT_PATH = "/usr/bin/git";
const NPM_PATH = "/usr/local/bin/npm";

/**
 * Verify that a command exists at the expected path
 */
function verifyCommand(path, name) {
	try {
		const result = spawnSync(path, ["--version"], {
			encoding: "utf8",
			shell: false,
		});
		if (result.status !== 0) {
			console.error(`Warning: ${name} not found at ${path}`);
			return false;
		}
		return true;
	} catch (error) {
		console.error(`Warning: ${name} not accessible at ${path}:`, error.message);
		return false;
	}
}

function main() {
	const args = process.argv.slice(2);
	let tag = args[0];
	const isBeta = args.includes("--beta");

	// Show help if requested
	if (args.includes("--help") || args.includes("-h")) {
		console.log(`
Usage: npm run release [tag] [--beta]

Examples:
  npm run release           # Creates release with version from manifest.json
  npm run release 1.0.1     # Creates release with custom tag
  npm run release:beta      # Creates beta release with version from manifest.json

Options:
  --beta    Create a beta/prerelease
  --help    Show this help message
		`);
		process.exit(0);
	}

	// Read manifest to get version info
	const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
	const version = manifest.version;
	const name = manifest.name;

	// If no tag specified, use version from manifest
	if (!tag) {
		tag = version;
		if (isBeta) {
			tag += "-beta";
		}
	}

	console.log(`Creating release for ${name} version ${version} with tag ${tag}`);

	// Check if git is clean
	try {
		const result = spawnSync(GIT_PATH, ["status", "--porcelain"], {
			encoding: "utf8",
			shell: false,
		});
		const status = result.stdout.trim();
		if (status) {
			console.warn(
				"Warning: You have uncommitted changes. Consider committing them first."
			);
			console.warn(status);
			const readline = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			readline.question(
				"Do you want to continue? (y/n): ",
				(answer) => {
					readline.close();
					if (answer.toLowerCase() !== "y") {
						console.log("Release cancelled.");
						process.exit(0);
					}
					createRelease(tag, version, name, isBeta);
				}
			);
			return;
		}
	} catch (error) {
		console.error("Error checking git status:", error.message);
	}

	createRelease(tag, version, name, isBeta);
}

function createRelease(tag, version, name, isBeta) {
	// Verify commands are available
	if (!verifyCommand(GIT_PATH, "git")) {
		console.error("Git is required but not found at expected path.");
		process.exit(1);
	}
	if (!verifyCommand(NPM_PATH, "npm")) {
		console.error("npm is required but not found at expected path.");
		process.exit(1);
	}

	// Build the plugin
	console.log("Building plugin...");
	const buildResult = spawnSync(NPM_PATH, ["run", "build"], {
		stdio: "inherit",
		shell: false,
	});
	if (buildResult.status !== 0) {
		console.error("Build failed");
		process.exit(1);
	}

	// Create and push tag
	console.log(`Creating tag ${tag}...`);
	const tagResult = spawnSync(
		GIT_PATH,
		["tag", "-a", tag, "-m", `Release ${version}`],
		{
			stdio: "inherit",
			shell: false,
		}
	);
	if (tagResult.status !== 0) {
		console.error("Failed to create tag:", tagResult.error?.message);
		console.log(
			"If the tag already exists, delete it first with: git tag -d " +
				tag
		);
		process.exit(1);
	}

	console.log(`Pushing tag ${tag}...`);
	const pushResult = spawnSync(GIT_PATH, ["push", "origin", tag], {
		stdio: "inherit",
		shell: false,
	});
	if (pushResult.status !== 0) {
		console.error("Failed to push tag:", pushResult.error?.message);
		process.exit(1);
	}

	console.log("\n✅ Release process initiated!");
	console.log(`Tag ${tag} has been pushed.`);
	console.log(
		"GitHub Actions will now build and create the release automatically."
	);
	console.log(
		"\nCheck the progress at: https://github.com/merlinbecker/PaperAgents/actions"
	);
}

main();
