# blimy shell integration for zsh: emits OSC 133 prompt and command marks
# plus OSC 7 working directory reports so the terminal can track commands.
if [[ -n "${blimy_SHELL_INTEGRATION_LOADED-}" || -z "${blimy_SHELL_INTEGRATION-}" ]]; then
  return
fi
blimy_SHELL_INTEGRATION_LOADED=1

__blimy_osc() {
  builtin printf '\e]%s\a' "$1"
}

__blimy_report_cwd() {
  __blimy_osc "7;file://${HOST:-localhost}${PWD}"
}

__blimy_precmd() {
  local exit_code=$?
  if [[ -n "${__blimy_command_running-}" ]]; then
    __blimy_osc "133;D;${exit_code}"
    __blimy_command_running=""
  fi
  __blimy_report_cwd
  __blimy_osc "133;A"
}

__blimy_preexec() {
  __blimy_command_running=1
  __blimy_osc "133;C"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __blimy_precmd
add-zsh-hook preexec __blimy_preexec

if [[ "$PS1" != *'133;B'* ]]; then
  PS1="${PS1}"$'%{\e]133;B\a%}'
fi
