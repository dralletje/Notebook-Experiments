export let run_in_environment = (argument_names, code) =>
  new Function(...argument_names, code);
