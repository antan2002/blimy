# Blimy shell integration for zsh: emits OSC 133 prompt and command marks
# plus OSC 7 working directory reports so the terminal can track commands.
if [[ -n "${BLIMY_SHELL_INTEGRATION_LOADED-}" || -z "${BLIMY_SHELL_INTEGRATION-}" ]]; then
  return
fi
BLIMY_SHELL_INTEGRATION_LOADED=1

__BLIMY_osc() {
  builtin printf '\e]%s\a' "$1"
}

__BLIMY_report_cwd() {
  __BLIMY_osc "7;file://${HOST:-localhost}${PWD}"
}

__BLIMY_precmd() {
  local exit_code=$?
  if [[ -n "${__BLIMY_command_running-}" ]]; then
    __BLIMY_osc "133;D;${exit_code}"
    __BLIMY_command_running=""
  fi
  __BLIMY_report_cwd
  __BLIMY_osc "133;A"
}

__BLIMY_preexec() {
  __BLIMY_command_running=1
  __BLIMY_osc "133;C"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __BLIMY_precmd
add-zsh-hook preexec __BLIMY_preexec

if [[ "$PS1" != *'133;B'* ]]; then
  PS1="${PS1}"$'%{\e]133;B\a%}'
fi
