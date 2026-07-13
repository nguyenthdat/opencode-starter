#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["json5"]
# ///
"""Manage harness teams in OpenCode configuration.

Usage:
  ./scripts/harness-opencode.py link <team>              Link one team
  ./scripts/harness-opencode.py unlink <team>            Unlink one team
  ./scripts/harness-opencode.py link <team> --dry-run    Preview
  ./scripts/harness-opencode.py unlink <team> --dry-run  Preview
  ./scripts/harness-opencode.py link <team> --force      Link, replacing conflicts
  ./scripts/harness-opencode.py unlink <team> --force    Force unlink
  ./scripts/harness-opencode.py link --all               Link all teams
  ./scripts/harness-opencode.py unlink --all             Unlink all teams
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Any, NoReturn

# ── helpers ──────────────────────────────────────────────────────────────────


def die(msg: str) -> NoReturn:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str) -> None:
    print(f"WARN:  {msg}", file=sys.stderr)


# ── JSONC support ────────────────────────────────────────────────────────────

import json5  # noqa: E402


def load_jsonc(path: Path) -> dict[str, Any]:
    """Load a JSONC file, returning an empty dict if the file is missing."""
    if not path.is_file():
        return {}
    raw = path.read_text(encoding="utf-8")
    try:
        result = json5.loads(raw)
        return result if isinstance(result, dict) else {}
    except ValueError as exc:
        die(f"Failed to parse {path}: {exc}")


def save_jsonc(path: Path, data: dict[str, Any]) -> None:
    """Write JSONC with 2-space indent, quoted keys, and trailing commas."""
    text = json5.dumps(
        data,
        indent=2,
        ensure_ascii=False,
        trailing_commas=True,
        quote_keys=True,
    )
    path.write_text(text + "\n", encoding="utf-8")


# ── path helpers ─────────────────────────────────────────────────────────────


def is_symlink(path: Path) -> bool:
    return path.is_symlink()


def resolve_symlink_target(link: Path) -> Path | None:
    """Resolve a symlink's real target, handling relative targets."""
    if not link.is_symlink():
        return None
    target = os.readlink(str(link))
    if os.path.isabs(target):
        return Path(target).resolve()
    return (link.parent / target).resolve()


def is_symlink_to(link: Path, expected: Path) -> bool:
    """Check if *link* is a symlink pointing to *expected* (canonical comparison)."""
    if not link.is_symlink():
        return False
    actual = resolve_symlink_target(link)
    if actual is None:
        return False
    return actual == expected.resolve()


def relpath_for_symlink(src: Path, dst: Path) -> str:
    """Compute a relative path from *dst*'s parent directory to *src*."""
    dst_parent = dst.parent
    return os.path.relpath(str(src.resolve()), str(dst_parent.resolve()))


def ensure_dir(path: Path, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] would ensure dir: {_shorten(path)}")
    else:
        path.mkdir(parents=True, exist_ok=True)


def remove_if_empty(path: Path, dry_run: bool) -> None:
    """Remove *path* if it is a directory and empty."""
    if not path.is_dir():
        return
    try:
        if not any(path.iterdir()):
            if dry_run:
                print(f"  [dry-run] would remove empty dir: {_shorten(path)}")
            else:
                path.rmdir()
                print(f"  RMDIR  {_shorten(path)} (empty)")
    except OSError:
        pass


def _shorten(path: Path) -> str:
    """Return a short display path relative to project root."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


# ── team discovery ───────────────────────────────────────────────────────────


def list_teams(harness_dir: Path) -> list[str]:
    """Find all directories under harness/ that contain both teams/ and skills/."""
    if not harness_dir.is_dir():
        return []
    teams: list[str] = []
    for d in sorted(harness_dir.iterdir()):
        if d.is_dir() and (d / "teams").is_dir() and (d / "skills").is_dir():
            teams.append(d.name)
    return teams


def validate_team(harness_dir: Path, team: str) -> Path:
    """Validate a team exists and has a teams/ subdirectory."""
    team_dir = harness_dir / team
    if not team_dir.is_dir():
        die(f"harness/{team} does not exist")
    if not (team_dir / "teams").is_dir():
        die(f"harness/{team}/teams does not exist")
    return team_dir


# ── counters ─────────────────────────────────────────────────────────────────


class Counters:
    def __init__(self) -> None:
        self.linked = 0
        self.unlinked = 0
        self.skipped = 0
        self.warnings = 0
        self.errors = 0

    def reset(self) -> None:
        self.__init__()

    def print_summary(self) -> None:
        print()
        print("────────── Summary ──────────")
        print(f"  linked:   {self.linked}")
        print(f"  unlinked: {self.unlinked}")
        print(f"  skipped:  {self.skipped}")
        print(f"  warnings: {self.warnings}")
        print(f"  errors:   {self.errors}")
        print("──────────────────────────────")


# ── link ─────────────────────────────────────────────────────────────────────


def link_agents(
    team_dir: Path,
    team: str,
    agents_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src_dir = team_dir / "teams"
    dst_dir = agents_root / team

    if not dry_run:
        dst_dir.mkdir(parents=True, exist_ok=True)

    for src_file in sorted(src_dir.glob("*.md")):
        dst = dst_dir / src_file.name

        if is_symlink_to(dst, src_file):
            print(f"  SKIP   agents/{team}/{src_file.name} (already linked)")
            c.skipped += 1
            continue

        if dst.exists() or dst.is_symlink():
            if force:
                if dry_run:
                    print(f"  [dry-run] would replace: agents/{team}/{src_file.name}")
                    c.linked += 1
                else:
                    print(
                        f"  FORCE  agents/{team}/{src_file.name} (replacing existing)"
                    )
                    dst.unlink(missing_ok=True)
                    try:
                        shutil.rmtree(str(dst))
                    except OSError:
                        pass
                    rel_target = relpath_for_symlink(src_file, dst)
                    dst.symlink_to(rel_target)
                    c.linked += 1
            else:
                warn(f"agents/{team}/{src_file.name} exists (use --force to replace)")
                c.warnings += 1
                c.skipped += 1
            continue

        if dry_run:
            print(f"  [dry-run] would link: agents/{team}/{src_file.name}")
            c.linked += 1
        else:
            rel_target = relpath_for_symlink(src_file, dst)
            dst.symlink_to(rel_target)
            print(f"  LINK   agents/{team}/{src_file.name}")
            c.linked += 1


def link_skills(
    team_dir: Path,
    team: str,
    skills_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src_dir = team_dir / "skills"
    if not dry_run:
        skills_root.mkdir(parents=True, exist_ok=True)

    for src_item in sorted(src_dir.iterdir()):
        sname = src_item.name
        dst = skills_root / sname

        if is_symlink_to(dst, src_item):
            print(f"  SKIP   skills/{sname} (already linked)")
            c.skipped += 1
            continue

        if dst.exists() or dst.is_symlink():
            if force:
                can_replace = False
                if dst.is_symlink():
                    can_replace = True
                elif dst.is_dir():
                    try:
                        can_replace = not any(dst.iterdir())
                    except OSError:
                        can_replace = False

                if can_replace:
                    if dry_run:
                        print(f"  [dry-run] would replace: skills/{sname}")
                        c.linked += 1
                    else:
                        print(f"  FORCE  skills/{sname} (replacing existing)")
                        dst.unlink(missing_ok=True)
                        try:
                            shutil.rmtree(str(dst))
                        except OSError:
                            pass
                        rel_target = relpath_for_symlink(src_item, dst)
                        dst.symlink_to(rel_target)
                        c.linked += 1
                else:
                    warn(f"skills/{sname} is non-empty directory, skipping")
                    c.warnings += 1
                    c.skipped += 1
            else:
                warn(f"skills/{sname} exists (use --force to replace)")
                c.warnings += 1
                c.skipped += 1
            continue

        if dry_run:
            print(f"  [dry-run] would link: skills/{sname}")
            c.linked += 1
        else:
            rel_target = relpath_for_symlink(src_item, dst)
            dst.symlink_to(rel_target)
            print(f"  LINK   skills/{sname}")
            c.linked += 1


def link_instruction(
    team_dir: Path,
    team: str,
    instructions_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src = team_dir / f"{team}.md"
    if not src.is_file():
        return

    dst = instructions_root / f"{team}.md"

    if is_symlink_to(dst, src):
        print(f"  SKIP   instructions/{team}.md (already linked)")
        c.skipped += 1
        return

    if dst.exists() or dst.is_symlink():
        if force:
            if dry_run:
                print(f"  [dry-run] would replace: instructions/{team}.md")
                c.linked += 1
            else:
                print(f"  FORCE  instructions/{team}.md (replacing existing)")
                dst.unlink(missing_ok=True)
                try:
                    shutil.rmtree(str(dst))
                except OSError:
                    pass
                rel_target = relpath_for_symlink(src, dst)
                dst.symlink_to(rel_target)
                c.linked += 1
        else:
            warn(f"instructions/{team}.md exists (use --force to replace)")
            c.warnings += 1
            c.skipped += 1
        return

    if dry_run:
        print(f"  [dry-run] would link: instructions/{team}.md")
        c.linked += 1
    else:
        rel_target = relpath_for_symlink(src, dst)
        dst.symlink_to(rel_target)
        print(f"  LINK   instructions/{team}.md")
        c.linked += 1


# ── MCP merge / unmerge ──────────────────────────────────────────────────────


def find_team_mcp_file(team_dir: Path) -> Path | None:
    """Find the MCP config file for a team (mcp.json or mcp.jsonc)."""
    for name in ("mcp.json", "mcp.jsonc"):
        p = team_dir / name
        if p.is_file():
            return p
    return None


def find_target_opencode_config(opencode_root: Path) -> Path:
    """Return the config file within the .opencode repository root."""
    return opencode_root / "opencode.jsonc"


def merge_mcp(
    team: str,
    team_dir: Path,
    target_config: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    """Merge a team's MCP definitions into the target OpenCode config."""
    mcp_file = find_team_mcp_file(team_dir)
    if mcp_file is None:
        return

    team_mcp = load_jsonc(mcp_file)
    if not team_mcp:
        return

    config = load_jsonc(target_config)
    existing_mcp: dict[str, Any] = config.setdefault("mcp", {})

    added = 0
    for server_name, server_def in team_mcp.items():
        if server_name in existing_mcp:
            if force:
                if dry_run:
                    print(f"  [dry-run] would overwrite MCP server: {server_name}")
                else:
                    print(f"  FORCE  MCP server: {server_name} (overwriting existing)")
                existing_mcp[server_name] = server_def
                added += 1
            else:
                warn(
                    f"MCP server '{server_name}' already exists (use --force to replace)"
                )
                c.warnings += 1
                c.skipped += 1
        else:
            if dry_run:
                print(f"  [dry-run] would add MCP server: {server_name}")
            else:
                print(f"  MCP    add server: {server_name}")
            existing_mcp[server_name] = server_def
            added += 1
            c.linked += 1

    if added > 0 and not dry_run:
        save_jsonc(target_config, config)


def unmerge_mcp(
    team: str, team_dir: Path, target_config: Path, dry_run: bool, c: Counters
) -> None:
    """Remove a team's MCP definitions from the target OpenCode config."""
    mcp_file = find_team_mcp_file(team_dir)
    if mcp_file is None:
        return

    team_mcp = load_jsonc(mcp_file)
    if not team_mcp:
        return

    config = load_jsonc(target_config)
    existing_mcp: dict[str, Any] = config.get("mcp", {})

    removed = 0
    for server_name in team_mcp:
        if server_name in existing_mcp:
            if dry_run:
                print(f"  [dry-run] would remove MCP server: {server_name}")
            else:
                print(f"  MCP    remove server: {server_name}")
            del existing_mcp[server_name]
            removed += 1
            c.unlinked += 1

    if removed > 0 and not dry_run:
        save_jsonc(target_config, config)


# ── unlink ───────────────────────────────────────────────────────────────────


def unlink_agents(
    team_dir: Path,
    team: str,
    agents_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src_dir = team_dir / "teams"
    dst_dir = agents_root / team

    if not dst_dir.is_dir():
        print(f"  (no agents dir to unlink: .opencode/agents/{team})")
        return

    for dst_item in sorted(dst_dir.iterdir()):
        src = src_dir / dst_item.name

        if not dst_item.is_symlink():
            warn(f"agents/{team}/{dst_item.name} is not a symlink — skipping")
            c.warnings += 1
            c.skipped += 1
            continue

        actual = resolve_symlink_target(dst_item)
        if actual is None or actual != src.resolve():
            warn(
                f"agents/{team}/{dst_item.name} does not point to harness/{team} — skipping"
            )
            c.warnings += 1
            c.skipped += 1
            continue

        if dry_run:
            print(f"  [dry-run] would remove: agents/{team}/{dst_item.name}")
            c.unlinked += 1
        else:
            print(f"  UNLINK agents/{team}/{dst_item.name}")
            dst_item.unlink()
            c.unlinked += 1

    remove_if_empty(dst_dir, dry_run)


def unlink_skills(
    team_dir: Path,
    team: str,
    skills_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src_dir = team_dir / "skills"
    if not skills_root.is_dir():
        return

    for dst_item in sorted(skills_root.iterdir()):
        src = src_dir / dst_item.name

        if not dst_item.is_symlink():
            continue

        actual = resolve_symlink_target(dst_item)
        if actual is None or actual != src.resolve():
            continue

        if dry_run:
            print(f"  [dry-run] would remove: skills/{dst_item.name}")
            c.unlinked += 1
        else:
            print(f"  UNLINK skills/{dst_item.name}")
            dst_item.unlink()
            c.unlinked += 1


def unlink_instruction(
    team_dir: Path,
    team: str,
    instructions_root: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    src = team_dir / f"{team}.md"
    dst = instructions_root / f"{team}.md"

    if not (dst.is_symlink() and dst.exists()):
        return

    actual = resolve_symlink_target(dst)
    if actual is None or actual != src.resolve():
        return

    if dry_run:
        print(f"  [dry-run] would remove: instructions/{team}.md")
        c.unlinked += 1
    else:
        print(f"  UNLINK instructions/{team}.md")
        dst.unlink()
        c.unlinked += 1


# ── top-level commands ───────────────────────────────────────────────────────


def do_link(
    team: str,
    team_dir: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    print(f"── Linking harness/{team} ──")
    link_agents(team_dir, team, AGENTS_ROOT, force, dry_run, c)
    link_skills(team_dir, team, SKILLS_ROOT, force, dry_run, c)
    link_instruction(team_dir, team, INSTRUCTIONS_ROOT, force, dry_run, c)
    if TARGET_CONFIG is not None:
        merge_mcp(team, team_dir, TARGET_CONFIG, force, dry_run, c)


def do_unlink(
    team: str,
    team_dir: Path,
    force: bool,
    dry_run: bool,
    c: Counters,
) -> None:
    print(f"── Unlinking harness/{team} ──")
    unlink_agents(team_dir, team, AGENTS_ROOT, force, dry_run, c)
    unlink_skills(team_dir, team, SKILLS_ROOT, force, dry_run, c)
    unlink_instruction(team_dir, team, INSTRUCTIONS_ROOT, force, dry_run, c)
    if TARGET_CONFIG is not None:
        unmerge_mcp(team, team_dir, TARGET_CONFIG, dry_run, c)


# ── main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manage harness teams in OpenCode configuration.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s link my-team              Link a single harness team
  %(prog)s unlink my-team            Unlink a single harness team
  %(prog)s link my-team --dry-run    Preview link actions
  %(prog)s link --all                Link every valid harness team
  %(prog)s unlink --all              Unlink every valid harness team
  %(prog)s link my-team --force      Link, replacing conflicts
""",
    )
    parser.add_argument(
        "command",
        choices=["link", "unlink"],
        help="Action to perform",
    )
    parser.add_argument(
        "team",
        nargs="?",
        help="Team name (required unless --all)",
    )
    parser.add_argument(
        "--all",
        "-a",
        action="store_true",
        help="Operate on all valid harness teams",
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Overwrite conflicts instead of skipping",
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Preview actions without making changes",
    )
    parser.add_argument(
        "--root",
        help=".opencode repository root (default: auto-detect from script location)",
    )

    args = parser.parse_args()

    if not args.all and not args.team:
        die("Specify a team name, or use --all")

    # --- project root ---
    if args.root:
        root = Path(args.root).resolve()
    else:
        root = Path(__file__).resolve().parent.parent

    if not root.is_dir():
        die(f"Project root not found: {root}")

    os.chdir(str(root))

    global \
        PROJECT_ROOT, \
        AGENTS_ROOT, \
        SKILLS_ROOT, \
        INSTRUCTIONS_ROOT, \
        TARGET_CONFIG, \
        HARNESS_DIR
    PROJECT_ROOT = root
    HARNESS_DIR = root / "harness"
    AGENTS_ROOT = root / "agents"
    SKILLS_ROOT = root / "skills"
    INSTRUCTIONS_ROOT = root / "instructions"

    target_cfg = find_target_opencode_config(root)
    TARGET_CONFIG = target_cfg

    # --- resolve teams ---
    if args.all:
        teams = list_teams(HARNESS_DIR)
        if not teams:
            die(
                "No valid harness teams found (need harness/<team>/teams/ and harness/<team>/skills/)"
            )
        print(f"Teams found: {', '.join(teams)}")
    else:
        assert args.team
        teams = [args.team]

    # --- display header ---
    label = args.command
    if args.dry_run:
        label += " (dry-run)"
    print(f"Command:  {label}")
    if args.all:
        print("Teams:    all")
    else:
        print(f"Team:     {args.team}")
    print()

    c = Counters()

    for team in teams:
        team_dir = validate_team(HARNESS_DIR, team)
        if args.command == "link":
            do_link(team, team_dir, args.force, args.dry_run, c)
        else:
            do_unlink(team, team_dir, args.force, args.dry_run, c)
        print()

    c.print_summary()

    if c.errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
