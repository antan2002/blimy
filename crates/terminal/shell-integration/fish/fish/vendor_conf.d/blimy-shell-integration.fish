# Blimy shell integration for fish: emits OSC 133 prompt and command marks
# plus OSC 7 working directory reports so the terminal can track commands.
if status is-interactive; and set -q BLIMY_SHELL_INTEGRATION; and not set -q BLIMY_SHELL_INTEGRATION_LOADED
    set -g BLIMY_SHELL_INTEGRATION_LOADED 1

    function __BLIMY_osc
        printf '\e]%s\a' $argv[1]
    end

    function __BLIMY_precmd --on-event fish_prompt
        set -l exit_code $status
        if set -q __BLIMY_command_running
            __BLIMY_osc "133;D;$exit_code"
            set -e __BLIMY_command_running
        end
        __BLIMY_osc "7;file://$hostname$PWD"
        __BLIMY_osc "133;A"
    end

    function __BLIMY_preexec --on-event fish_preexec
        set -g __BLIMY_command_running 1
        __BLIMY_osc "133;C"
    end

    if functions -q fish_prompt; and not functions -q __BLIMY_user_fish_prompt
        functions -c fish_prompt __BLIMY_user_fish_prompt
        function fish_prompt
            __BLIMY_user_fish_prompt
            __BLIMY_osc "133;B"
        end
    end
end
