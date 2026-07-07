#!/usr/bin/env fish
# harness-opencode.fish — Symlink harness teams and skills into OpenCode config.
#
# Usage:
#   ./scripts/harness-opencode.fish link <team>              # link one team
#   ./scripts/harness-opencode.fish unlink <team>            # unlink one team
#   ./scripts/harness-opencode.fish link <team> --dry-run    # preview
#   ./scripts/harness-opencode.fish unlink <team> --dry-run  # preview
#   ./scripts/harness-opencode.fish link <team> --force      # overwrite conflicts
#   ./scripts/harness-opencode.fish unlink <team> --force    # force unlink (only symlinks)
#   ./scripts/harness-opencode.fish link --all               # link all teams
#   ./scripts/harness-opencode.fish unlink --all             # unlink all teams

set -g SCRIPT_DIR (dirname (status filename))
set -g PROJECT_ROOT (realpath "$SCRIPT_DIR/..")

# ── helpers ────────────────────────────────────────────────────────────────

function _usage
    echo "Usage:"
    echo "  harness-opencode.fish link <team>              Link a harness team into OpenCode"
    echo "  harness-opencode.fish unlink <team>            Unlink a harness team from OpenCode"
    echo "  harness-opencode.fish link <team> --dry-run    Preview link actions"
    echo "  harness-opencode.fish unlink <team> --dry-run  Preview unlink actions"
    echo "  harness-opencode.fish link <team> --force      Link, replacing conflicts"
    echo "  harness-opencode.fish unlink <team> --force    Unlink, force-remove matching symlinks"
    echo "  harness-opencode.fish link --all               Link every valid harness team"
    echo "  harness-opencode.fish unlink --all             Unlink every valid harness team"
    exit 1
end

function _die
    echo "ERROR: $argv" >&2
    exit 1
end

function _warn
    echo "WARN:  $argv" >&2
end

function _abs_dirname
    # Like `dirname` but ensures the result is absolute (relative to PROJECT_ROOT).
    set -l p "$argv[1]"
    if string match -q '/*' "$p"
        echo (dirname "$p")
    else
        echo (realpath (dirname "$p"))
    end
end

function _relpath_py
    # Compute a relative path from $argv[1] (from_abs_dir) to $argv[2] (to_abs_path).
    # Both args must be absolute paths. Uses python3. Handles non-existent from_dir.
    set -l from "$argv[1]"
    set -l to "$argv[2]"
    python3 -c "
import os, sys
f = '$from'
t = '$to'
# If the from dir doesn't exist, walk up until we find an existing ancestor
while f and not os.path.isdir(f):
    f = os.path.dirname(f) or '/'
print(os.path.relpath(t, f))
"
end

function _resolve_link_target
    # Return a relative symlink target for $argv[1] (the destination)-> $argv[2] (the source).
    set -l dst "$argv[1]"
    set -l src "$argv[2]"
    # Get the absolute directory that will contain the symlink
    set -l dst_dir (dirname "$dst")
    # Ensure source is absolute
    set -l src_abs (realpath "$src")
    _relpath_py "$dst_dir" "$src_abs"
end

function _is_symlink
    test -L "$argv[1]"
end

function _realpath_link
    # Resolve a symlink's target *relative to the symlink's directory*.
    # macOS readlink has no -f; we must join manually.
    # Handle absolute targets (starts with /) directly.
    set -l link "$argv[1]"
    set -l target (readlink "$link")
    if string match -q '/*' "$target"
        realpath "$target"
    else
        set -l dir (dirname "$link")
        realpath "$dir/$target"
    end
end

function _is_symlink_to
    # Check if $path is a symlink pointing to $target (canonical comparison).
    _is_symlink "$argv[1]"; or return 1
    set -l actual (_realpath_link "$argv[1]")
    set -l expected (realpath "$argv[2]")
    test "$actual" = "$expected"
end

function _list_teams
    # Find all dirs under harness/ that contain both teams/ and skills/
    set -l harness_dir "$PROJECT_ROOT/harness"
    test -d "$harness_dir"; or return
    for d in "$harness_dir"/*/
        set -l name (basename "$d")
        test -d "$d/teams" -a -d "$d/skills"; and echo "$name"
    end
end

function _validate_team
    set -l team $argv[1]
    set -l team_dir "$PROJECT_ROOT/harness/$team"
    test -d "$team_dir"; or _die "harness/$team does not exist"
    test -d "$team_dir/teams"; or _die "harness/$team/teams does not exist"
end

# ── counters ────────────────────────────────────────────────────────────────

set -g _linked 0
set -g _unlinked 0
set -g _skipped 0
set -g _warnings 0
set -g _errors 0

function _reset_counters
    set -g _linked 0
    set -g _unlinked 0
    set -g _skipped 0
    set -g _warnings 0
    set -g _errors 0
end

function _print_summary
    echo ""
    echo "────────── Summary ──────────"
    echo "  linked:   $_linked"
    echo "  unlinked: $_unlinked"
    echo "  skipped:  $_skipped"
    echo "  warnings: $_warnings"
    echo "  errors:   $_errors"
    echo "──────────────────────────────"
end

# ── link ────────────────────────────────────────────────────────────────────

function _link_team_agents
    # Symlink harness/<team>/teams/*.md -> .opencode/agents/<team>/*.md
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    set -l src_dir "$PROJECT_ROOT/harness/$team/teams"
    set -l dst_dir "$PROJECT_ROOT/.opencode/agents/$team"

    if test "$dry_run" = true
        echo "[dry-run] would create dir: .opencode/agents/$team"
    else
        mkdir -p "$dst_dir"
    end

    for src_file in "$src_dir"/*.md
        test -f "$src_file"; or continue
        set -l fname (basename "$src_file")
        set -l dst "$dst_dir/$fname"
        set -l rel_target (_resolve_link_target "$dst" "$src_file")

        # Already a correct symlink → skip
        if _is_symlink_to "$dst" "$src_file"
            echo "  SKIP   agents/$team/$fname (already linked)"
            set -g _skipped (math $_skipped + 1)
            continue
        end

        # Destination exists but is wrong
        if test -e "$dst" -o -L "$dst"
            if test "$force" = true
                if test "$dry_run" = true
                    echo "  [dry-run] would replace: agents/$team/$fname"
                    set -g _linked (math $_linked + 1)
                else
                    echo "  FORCE  agents/$team/$fname (replacing existing)"
                    rm -rf "$dst"
                    ln -s "$rel_target" "$dst"
                    set -g _linked (math $_linked + 1)
                end
            else
                _warn "agents/$team/$fname exists (use --force to replace)"
                set -g _warnings (math $_warnings + 1)
                set -g _skipped (math $_skipped + 1)
            end
            continue
        end

        # Fresh symlink
        if test "$dry_run" = true
            echo "  [dry-run] would link: agents/$team/$fname"
            set -g _linked (math $_linked + 1)
        else
            echo "  LINK   agents/$team/$fname"
            ln -s "$rel_target" "$dst"
            set -g _linked (math $_linked + 1)
        end
    end
end

function _link_team_skills
    # Symlink harness/<team>/skills/<skill>/ -> .opencode/skills/<skill>
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    set -l src_dir "$PROJECT_ROOT/harness/$team/skills"
    set -l dst_dir "$PROJECT_ROOT/.opencode/skills"

    if test "$dry_run" = true
        echo "[dry-run] would ensure dir: .opencode/skills"
    else
        mkdir -p "$dst_dir"
    end

    for src_item in "$src_dir"/*
        test -e "$src_item"; or continue
        set -l sname (basename "$src_item")
        set -l dst "$dst_dir/$sname"
        set -l rel_target (_resolve_link_target "$dst" "$src_item")

        # Already a correct symlink → skip
        if _is_symlink_to "$dst" "$src_item"
            echo "  SKIP   skills/$sname (already linked)"
            set -g _skipped (math $_skipped + 1)
            continue
        end

        # Destination exists but is wrong
        if test -e "$dst" -o -L "$dst"
            if test "$force" = true
                set -l can_replace false
                if _is_symlink "$dst"
                    set can_replace true
                else if test -d "$dst"
                    set -l contents (ls -A "$dst" 2>/dev/null)
                    test -z "$contents"; and set can_replace true
                end
                if test "$can_replace" = true
                    if test "$dry_run" = true
                        echo "  [dry-run] would replace: skills/$sname"
                        set -g _linked (math $_linked + 1)
                    else
                        echo "  FORCE  skills/$sname (replacing existing)"
                        rm -rf "$dst"
                        ln -s "$rel_target" "$dst"
                        set -g _linked (math $_linked + 1)
                    end
                else
                    _warn "skills/$sname is non-empty directory, skipping"
                    set -g _warnings (math $_warnings + 1)
                    set -g _skipped (math $_skipped + 1)
                end
            else
                _warn "skills/$sname exists (use --force to replace)"
                set -g _warnings (math $_warnings + 1)
                set -g _skipped (math $_skipped + 1)
            end
            continue
        end

        # Fresh symlink
        if test "$dry_run" = true
            echo "  [dry-run] would link: skills/$sname"
            set -g _linked (math $_linked + 1)
        else
            echo "  LINK   skills/$sname"
            ln -s "$rel_target" "$dst"
            set -g _linked (math $_linked + 1)
        end
    end
end

function _link_team
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    _validate_team "$team"
    echo "── Linking harness/$team ──"
    _link_team_agents "$team" "$force" "$dry_run"
    _link_team_skills "$team" "$force" "$dry_run"
end

# ── unlink ──────────────────────────────────────────────────────────────────

function _unlink_team_agents
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    set -l src_dir "$PROJECT_ROOT/harness/$team/teams"
    set -l dst_dir "$PROJECT_ROOT/.opencode/agents/$team"

    if not test -d "$dst_dir"
        echo "  (no agents dir to unlink: .opencode/agents/$team)"
        return
    end

    for dst_item in "$dst_dir"/*
        test -e "$dst_item" -o -L "$dst_item"; or continue
        set -l dname (basename "$dst_item")
        set -l src "$src_dir/$dname"

        if not _is_symlink "$dst_item"
            _warn "agents/$team/$dname is not a symlink — skipping"
            set -g _warnings (math $_warnings + 1)
            set -g _skipped (math $_skipped + 1)
            continue
        end

        set -l link_target (_realpath_link "$dst_item" 2>/dev/null)
        set -l expected_src (realpath "$src" 2>/dev/null)

        # Skip if target or expected can't be resolved, or they don't match
        if test -z "$link_target" -o -z "$expected_src" -o "$link_target" != "$expected_src"
            _warn "agents/$team/$dname does not point to harness/$team — skipping"
            set -g _warnings (math $_warnings + 1)
            set -g _skipped (math $_skipped + 1)
            continue
        end

        if test "$dry_run" = true
            echo "  [dry-run] would remove: agents/$team/$dname"
            set -g _unlinked (math $_unlinked + 1)
        else
            echo "  UNLINK agents/$team/$dname"
            rm "$dst_item"
            set -g _unlinked (math $_unlinked + 1)
        end
    end

    if test -d "$dst_dir"
        set -l remaining (ls -A "$dst_dir" 2>/dev/null)
        if test -z "$remaining"
            if test "$dry_run" = true
                echo "  [dry-run] would remove empty dir: .opencode/agents/$team"
            else
                echo "  RMDIR  .opencode/agents/$team (empty)"
                rmdir "$dst_dir"
            end
        end
    end
end

function _unlink_team_skills
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    set -l src_dir "$PROJECT_ROOT/harness/$team/skills"
    set -l dst_dir "$PROJECT_ROOT/.opencode/skills"

    if not test -d "$dst_dir"
        return
    end

    for dst_item in "$dst_dir"/*
        test -e "$dst_item" -o -L "$dst_item"; or continue
        set -l sname (basename "$dst_item")
        set -l src "$src_dir/$sname"

        if not _is_symlink "$dst_item"
            continue
        end

        set -l link_target (_realpath_link "$dst_item" 2>/dev/null)
        set -l expected_src (realpath "$src" 2>/dev/null)

        if test -z "$link_target" -o -z "$expected_src" -o "$link_target" != "$expected_src"
            continue
        end

        if test "$dry_run" = true
            echo "  [dry-run] would remove: skills/$sname"
            set -g _unlinked (math $_unlinked + 1)
        else
            echo "  UNLINK skills/$sname"
            rm "$dst_item"
            set -g _unlinked (math $_unlinked + 1)
        end
    end
end

function _unlink_team
    set -l team $argv[1]
    set -l force $argv[2]
    set -l dry_run $argv[3]
    _validate_team "$team"
    echo "── Unlinking harness/$team ──"
    _unlink_team_agents "$team" "$force" "$dry_run"
    _unlink_team_skills "$team" "$force" "$dry_run"
end

# ── main dispatch ───────────────────────────────────────────────────────────

function _main
    set -l cmd ""
    set -l team ""
    set -l all false
    set -l force false
    set -l dry_run false

    for arg in $argv
        switch $arg
            case link unlink
                set cmd $arg
            case --all -a
                set all true
            case --force -f
                set force true
            case --dry-run -n
                set dry_run true
            case --help -h
                _usage
            case '-*'
                _die "Unknown flag: $arg"
            case '*'
                if test -z "$team"
                    set team $arg
                else
                    _die "Unexpected argument: $arg"
                end
        end
    end

    test -n "$cmd"; or _usage

    set -l teams
    if test "$all" = true
        set teams (_list_teams)
        if test -z "$teams"
            _die "No valid harness teams found (need harness/<team>/teams/ and harness/<team>/skills/)"
        end
        echo "Teams found: "(string join ", " $teams)
    else
        test -n "$team"; or _die "Specify a team name, or use --all"
        set teams "$team"
    end

    cd "$PROJECT_ROOT" 2>/dev/null; or _die "Cannot enter project root: $PROJECT_ROOT"

    set -l cmd_label
    if test "$cmd" = link
        set cmd_label "link"
    else
        set cmd_label "unlink"
    end
    if test "$dry_run" = true
        set cmd_label "$cmd_label (dry-run)"
    end

    _reset_counters

    echo "Command:  $cmd_label"
    if test "$all" = true
        echo "Teams:    all"
    else
        echo "Team:     $team"
    end
    echo ""

    for t in $teams
        if test "$cmd" = link
            _link_team "$t" "$force" "$dry_run"
        else
            _unlink_team "$t" "$force" "$dry_run"
        end
        echo ""
    end

    _print_summary

    if test $_errors -gt 0
        exit 1
    end
end

_main $argv
