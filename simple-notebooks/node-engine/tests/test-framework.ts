import chalk from "chalk";

export let it = async (name: string, fn: () => void) => {
  try {
    await fn();
    console.log(chalk.green.bold`✓`, chalk.green(name));
  } catch (error) {
    console.log(chalk.red.bold`✗`, chalk.red(name));
    console.log(chalk.red(error.stack));
  }
};

export let assert = (condition: boolean, message?: string) => {
  if (!condition) {
    throw new Error(message);
  }
};
