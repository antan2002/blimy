# blimy shell integration for bash. Loaded through --init-file, so it first
# runs the files an interactive shell would have read on its own, then emits
# OSC 133 prompt and command marks plus OSC 7 working directory reports.
#
# blimy_SHELL_LOGIN is set when the shell would normally have been a login
# shell (Git Bash on Windows). A login shell reads the profile files and
# leaves ~/.bashrc to them, so mirror that instead of reading ~/.bashrc twice.
if [[ -n "${blimy_SHELL_LOGIN-}" ]]; then
  unset blimy_SHELL_LOGIN
  if [[ -r /etc/profile ]]; then
    source /etc/profile
  fi
  for __blimy_profile in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
    if [[ -r "$__blimy_profile" ]]; then
      source "$__blimy_profile"
      break
    fi
  done
  unset __blimy_profile
else
  if [[ -r /etc/bash.bashrc ]]; then
    source /etc/bash.bashrc
  fi
  if [[ -r "$HOME/.bashrc" ]]; then
    source "$HOME/.bashrc"
  fi
fi

if [[ -n "${blimy_SHELL_INTEGRATION_LOADED-}" || -z "${blimy_SHELL_INTEGRATION-}" ]]; then
  return 0 2>/dev/null
fi
blimy_SHELL_INTEGRATION_LOADED=1

__blimy_osc() {
  builtin printf '\e]%s\a' "$1"
}

__blimy_precmd() {
  local exit_code=$?
  if [[ -n "${__blimy_command_running-}" ]]; then
    __blimy_osc "133;D;${exit_code}"
    __blimy_command_running=""
  fi
  __blimy_osc "7;file://${HOSTNAME:-localhost}${PWD}"
  __blimy_osc "133;A"
}

__blimy_interactive_mode() {
  __blimy_interactive=1
}

__blimy_preexec() {
  if [[ -n "${COMP_LINE-}" || -z "${__blimy_interactive-}" || "$BASH_SUBSHELL" != "0" ]]; then
    return
  fi
  __blimy_interactive=""
  __blimy_command_running=1
  __blimy_osc "133;C"
}

if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
  PROMPT_COMMAND=(__blimy_precmd "${PROMPT_COMMAND[@]}" __blimy_interactive_mode)
else
  PROMPT_COMMAND="__blimy_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND};__blimy_interactive_mode"
fi
trap '__blimy_preexec' DEBUG

if [[ "$PS1" != *'133;B'* ]]; then
  PS1="${PS1}\[\e]133;B\a\]"
fi
