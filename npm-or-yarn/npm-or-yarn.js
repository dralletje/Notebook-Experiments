#!/usr/bin/env node

import { execSync } from "child_process";
import { readdir } from "fs/promises";
import { resolve } from "path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

const {
  _: [command, ...args],
  $0: _,
  ...options
} = await yargs(hideBin(process.argv)).parserConfiguration({
  "camel-case-expansion": false,
}).argv;

// Check for closest package.json in parent directories using readdir
let closest_package_json = async (cwd) => {
  let files = await readdir(cwd);
  if (files.includes("package.json")) {
    return cwd;
  } else {
    if (cwd === "/") {
      return null;
    } else {
      return await closest_package_json(resolve(cwd + "/.."));
    }
  }
};

let top_level_package_json = async (cwd) => {
  let path_segments = cwd.split("/");

  let current_path = "";
  for (let path_segment of path_segments) {
    current_path += "/" + path_segment;
    let files = await readdir(current_path);
    if (files.includes("package.json")) {
      return current_path;
    }
  }
  return null;
};

let workspace_path = await top_level_package_json(process.cwd());
if (workspace_path == null) {
  // prettier-ignore
  console.error("Could not find a package.json in parent directories");
  process.exit(1);
}
let current_directory_files = await readdir(workspace_path);

let has_yarn_lock = current_directory_files.includes("yarn.lock");
let has_package_lock = current_directory_files.includes("package-lock.json");

if (has_yarn_lock && has_package_lock) {
  // prettier-ignore
  console.error("Both yarn.lock and package-lock.json found. Please remove one of them." );
  process.exit(1);
}

if (!has_yarn_lock && !has_package_lock) {
  // prettier-ignore
  console.error("No package manager lock file found. Please add either yarn.lock or package-lock.json.");
  process.exit(1);
}

let assimilate_into = (cmd) => {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (error) {
    process.exit(error.status);
  }
};

if (has_package_lock) {
  console.error(chalk.green.bold(`Using npm as package manager`));
  assimilate_into(`npm ${process.argv.join(" ")}`);
} else {
  console.error(chalk.green.bold(`Using yarn as package manager`));
}

// From here we are in yarn territory
if (command === "install") {
  let packages = args;
  let {
    "save-dev": save_dev,
    "save-exact": save_exact,
    ...rest_of_options
  } = options;
  if (Object.keys(rest_of_options).length > 0) {
    // prettier-ignore
    console.error("Unknown options:", Object.keys(rest_of_options));
    process.exit(1);
  }

  let yarn_options = "";
  if (save_dev) {
    yarn_options += " --dev";
  }
  if (save_exact) {
    yarn_options += " --exact";
  }
  assimilate_into(`yarn add ${packages.join(" ")} ${yarn_options}`);
} else if (command === "uninstall") {
  let packages = args;
  let { ...rest_of_options } = options;
  if (Object.keys(rest_of_options).length > 0) {
    // prettier-ignore
    console.error("Unknown options:", Object.keys(rest_of_options));
    process.exit(1);
  }
  assimilate_into(`yarn remove ${packages.join(" ")}`);
} else if (command === "run") {
  let [script_to_run] = args;
  if (Object.keys(options).length > 0) {
    // prettier-ignore
    console.error("Unknown options:", Object.keys(options));
    process.exit(1);
  }
  assimilate_into(`yarn run ${script_to_run}`);
} else if (command === "start") {
  if (Object.keys(options).length > 0) {
    // prettier-ignore
    console.error("Unknown options:", Object.keys(options));
    process.exit(1);
  }
  assimilate_into(`yarn start`);
} else {
  console.error("Unknown command");
  process.exit(1);
}
