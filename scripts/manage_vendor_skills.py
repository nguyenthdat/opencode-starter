#!/usr/bin/env -S uv run
"""Manage OpenCode vendor skills -- discover, link, unlink, and validate.

Vendor repos live under .opencode/vendor/<vendor-name>/.
A valid skill is a directory containing a SKILL.md file.
Active skills are symlinked into .opencode/skills/.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class Skill:
    name: str
    vendor: str
    source_dir: Path
    link_name: str  # canonical link name in skills/ (may be namespaced)


@dataclass
class LinkStatus:
    skill: Skill
    linked: bool
    target: Optional[Path] = None
    valid: bool = True
    problem: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run(cmd: List[str], cwd: Path | None = None) -> Tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except FileNotFoundError:
        return 127, "", f"command not found: {cmd[0]}"


def init_submodules(repo_root: Path) -> None:
    """Sync and init all git submodules."""
    print("🔧 Syncing submodules ...")
    rc, out, err = run(["git", "submodule", "sync", "--recursive"], cwd=repo_root)
    if rc != 0:
        print(f"  ⚠️  submodule sync warning: {err}")
    rc, out, err = run(
        ["git", "submodule", "update", "--init", "--recursive"], cwd=repo_root
    )
    if rc != 0:
        print(f"  ⚠️  submodule update warning: {err}")
    else:
        print("  ✓ submodules initialized")


def is_skill_dir(path: Path) -> bool:
    """Return True if path is a directory containing SKILL.md."""
    return path.is_dir() and (path / "SKILL.md").is_file()


def discover_skills(vendors_root: Path) -> List[Skill]:
    """Recursively discover all vendor skills under *vendors_root*.

    Each subdirectory of vendors_root is treated as a vendor.
    """
    skills: List[Skill] = []
    seen_dirs: set[Path] = set()

    if not vendors_root.is_dir():
        return skills

    for vendor_dir_path in sorted(vendors_root.iterdir()):
        if not vendor_dir_path.is_dir():
            continue
        vendor_name = vendor_dir_path.name

        for sk_md in sorted(vendor_dir_path.rglob("SKILL.md")):
            skill_dir = sk_md.parent.resolve()
            if skill_dir in seen_dirs:
                continue
            seen_dirs.add(skill_dir)

            skill_name = skill_dir.name

            rel = skill_dir.relative_to(vendor_dir_path)
            parts = [p for p in rel.parts if p not in ("skills", "plugins", "plugin")]
            if len(parts) > 1:
                scope = "-".join(parts[:-1])
                namespaced = f"{scope}-{skill_name}"
            else:
                namespaced = skill_name

            skills.append(
                Skill(
                    name=skill_name,
                    vendor=vendor_name,
                    source_dir=skill_dir,
                    link_name=namespaced,
                )
            )

    return skills


def resolve_skills(
    skills: List[Skill],
    skill_name: str | None = None,
    vendor_name: str | None = None,
) -> List[Skill]:
    """Filter and deduplicate skills, returning the list to operate on."""
    result = skills

    if vendor_name:
        result = [s for s in result if s.vendor == vendor_name]
        if not result:
            print(f"❌ No skills found for vendor '{vendor_name}'")
            sys.exit(1)

    if skill_name:
        result = [s for s in result if s.name == skill_name]
        if not result:
            print(f"❌ No skill named '{skill_name}' found")
            sys.exit(1)

    return result


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------


def detect_duplicates(
    skills: List[Skill],
) -> Tuple[Dict[str, List[Skill]], Dict[str, List[Skill]]]:
    """Return (duplicate_simple_names, duplicate_namespaced_names)."""
    by_name: Dict[str, List[Skill]] = defaultdict(list)
    by_ns: Dict[str, List[Skill]] = defaultdict(list)
    for s in skills:
        by_name[s.name].append(s)
        by_ns[s.link_name].append(s)

    dup_names = {k: v for k, v in by_name.items() if len(v) > 1}
    dup_ns = {k: v for k, v in by_ns.items() if len(v) > 1}
    return dup_names, dup_ns


# ---------------------------------------------------------------------------
# Symlink operations
# ---------------------------------------------------------------------------


def skills_dir(repo_root: Path) -> Path:
    return repo_root / "skills"


def vendor_dir(repo_root: Path) -> Path:
    return repo_root / "vendor"


def link_skill(
    skill: Skill,
    repo_root: Path,
    link_name: str,
    *,
    dry_run: bool = False,
    force: bool = False,
) -> bool:
    """Create a symlink from .opencode/skills/<link_name> -> skill.source_dir.

    Returns True on success (or dry-run success).
    """
    target = skills_dir(repo_root) / link_name

    if target.exists(follow_symlinks=False):
        if target.is_symlink():
            current_target = os.readlink(str(target))
            current_target_path = Path(current_target)
            if not current_target_path.is_absolute():
                current_target_path = (target.parent / current_target_path).resolve()
            if current_target_path == skill.source_dir:
                print(f"  ✓ already linked: {link_name}")
                return True
            if force:
                if dry_run:
                    print(f"  [dry-run] would replace symlink: {link_name}")
                    return True
                target.unlink()
                print(f"  🔄 replaced link: {link_name} -> {skill.source_dir}")
            else:
                print(
                    f"  ⚠️  {link_name} already linked to {current_target_path}; "
                    "use --force to replace"
                )
                return False
        else:
            print(f"  ⚠️  {link_name} exists and is not a symlink; skipping")
            return False

    if dry_run:
        print(f"  [dry-run] would link: {link_name} -> {skill.source_dir}")
        return True

    target.symlink_to(skill.source_dir, target_is_directory=True)
    print(f"  ✓ linked: {link_name}")
    return True


def unlink_skill(
    link_name: str,
    repo_root: Path,
    *,
    dry_run: bool = False,
) -> bool:
    """Remove symlink .opencode/skills/<link_name> if it exists."""
    target = skills_dir(repo_root) / link_name

    if not target.exists(follow_symlinks=False):
        print(f"  - not linked: {link_name}")
        return True

    if not target.is_symlink():
        print(f"  ⚠️  {link_name} is not a symlink; skipping")
        return False

    if not _target_in_vendor(target, vendor_dir(repo_root).resolve()):
        dest_raw = os.readlink(str(target))
        print(f"  ⚠️  {link_name} does not point into vendor/ ({dest_raw}); skipping")
        return False

    if dry_run:
        print(f"  [dry-run] would unlink: {link_name}")
        return True

    target.unlink()
    print(f"  ✗ unlinked: {link_name}")
    return True


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_init(args: argparse.Namespace, repo_root: Path) -> None:
    init_submodules(repo_root)


def cmd_list(args: argparse.Namespace, repo_root: Path) -> None:
    vend = vendor_dir(repo_root)
    if not vend.is_dir():
        print("❌ No .opencode/vendor/ directory found")
        return

    all_skills = discover_skills(vend)
    dup_names, _ = detect_duplicates(all_skills)

    if args.vendor:
        all_skills = [s for s in all_skills if s.vendor == args.vendor]
    if args.skill:
        all_skills = [s for s in all_skills if s.name == args.skill]

    if not all_skills:
        print("No skills discovered.")
        return

    skills_path = skills_dir(repo_root)

    print(f"\n{'SKILL':<40} {'VENDOR':<25} {'LINKED':<8} {'LINK NAME':<40}")
    print("-" * 115)

    for s in sorted(all_skills, key=lambda x: (x.vendor, x.link_name)):
        linked = False
        link_name = s.name
        link_target = skills_path / link_name
        if link_target.is_symlink():
            linked = True
        elif link_target.exists(follow_symlinks=False):
            # Check for namespaced link
            ns_target = skills_path / s.link_name
            if ns_target.is_symlink():
                linked = True
                link_name = s.link_name

        dup_tag = " ⚡DUP" if s.name in dup_names else ""

        print(
            f"{s.name:<40} {s.vendor:<25} "
            f"{'✓' if linked else '-':<8} {link_name:<40}"
            f"{dup_tag}"
        )

    if dup_names:
        print(f"\n⚠️  {len(dup_names)} duplicate skill name(s) detected:")
        for name, dups in dup_names.items():
            vendors = ", ".join(f"{d.vendor}:{d.link_name}" for d in dups)
            print(f"   • {name} → vendors: {vendors}")


def cmd_link(args: argparse.Namespace, repo_root: Path) -> None:
    init_submodules(repo_root)
    vend = vendor_dir(repo_root)
    all_skills = discover_skills(vend)

    candidates = resolve_skills(
        all_skills, skill_name=args.skill, vendor_name=args.vendor
    )

    if len(candidates) > 1 and not args.vendor:
        print(f"⚠️  Multiple skills named '{args.skill}':")
        for c in candidates:
            print(f"   • vendor={c.vendor}  namespaced={c.link_name}")
        print("Use --vendor <name> to disambiguate, or link by namespaced name.")
        return

    dup_names, _ = detect_duplicates(all_skills)
    for s in candidates:
        link_name = s.link_name if s.name in dup_names else s.name
        link_skill(s, repo_root, link_name, dry_run=args.dry_run, force=args.force)


def cmd_unlink(args: argparse.Namespace, repo_root: Path) -> None:
    vend = vendor_dir(repo_root)
    all_skills = discover_skills(vend) if vend.is_dir() else []

    candidates = resolve_skills(
        all_skills, skill_name=args.skill, vendor_name=args.vendor
    )

    dup_names, _ = detect_duplicates(all_skills)

    for s in candidates:
        # Try both simple and namespaced link names
        for link_name in (s.name, s.link_name):
            target = skills_dir(repo_root) / link_name
            if target.is_symlink():
                unlink_skill(link_name, repo_root, dry_run=args.dry_run)
                break
        else:
            print(f"  - not linked: {s.name}")


def _unlink_all_vendor_skills(repo_root: Path, dry_run: bool) -> int:
    """Unlink all vendor symlinks. Returns count of removed symlinks."""
    skills_path = skills_dir(repo_root)
    vend = vendor_dir(repo_root).resolve()
    unlinked = 0
    for entry in sorted(skills_path.iterdir()):
        if not entry.is_symlink():
            continue
        if not _target_in_vendor(entry, vend):
            continue
        if unlink_skill(entry.name, repo_root, dry_run=dry_run):
            unlinked += 1
    return unlinked


def cmd_link_vendor(args: argparse.Namespace, repo_root: Path) -> None:
    init_submodules(repo_root)
    vend = vendor_dir(repo_root)
    all_skills = discover_skills(vend)

    vendor_filter = getattr(args, "vendor", None) or getattr(args, "vendor_name", None)
    if vendor_filter:
        all_skills = [s for s in all_skills if s.vendor == vendor_filter]
        if not all_skills:
            print(f"❌ No skills found for vendor '{vendor_filter}'")
            return

    if getattr(args, "unlink", False):
        _unlink_all_vendor_skills(repo_root, dry_run=args.dry_run)

    dup_names, _ = detect_duplicates(all_skills)
    linked = 0
    for s in all_skills:
        link_name = s.link_name if s.name in dup_names else s.name
        if link_skill(s, repo_root, link_name, dry_run=args.dry_run, force=args.force):
            linked += 1
    print(f"\nLinked {linked}/{len(all_skills)} skills.")


def cmd_unlink_vendor(args: argparse.Namespace, repo_root: Path) -> None:
    vend = vendor_dir(repo_root)
    all_skills = discover_skills(vend) if vend.is_dir() else []

    vendor_filter = getattr(args, "vendor", None) or getattr(args, "vendor_name", None)
    if vendor_filter:
        all_skills = [s for s in all_skills if s.vendor == vendor_filter]
        if not all_skills:
            print(f"❌ No skills found for vendor '{vendor_filter}'")
            return

    dup_names, _ = detect_duplicates(all_skills)
    unlinked = 0
    for s in all_skills:
        for link_name in (s.name, s.link_name):
            target = skills_dir(repo_root) / link_name
            if target.is_symlink():
                if unlink_skill(link_name, repo_root, dry_run=args.dry_run):
                    unlinked += 1
                break
    print(f"\nUnlinked {unlinked} symlinks.")


def cmd_link_all(args: argparse.Namespace, repo_root: Path) -> None:
    init_submodules(repo_root)
    vend = vendor_dir(repo_root)
    all_skills = discover_skills(vend)

    if getattr(args, "unlink", False):
        _unlink_all_vendor_skills(repo_root, dry_run=args.dry_run)

    dup_names, _ = detect_duplicates(all_skills)
    linked = 0
    for s in all_skills:
        link_name = s.link_name if s.name in dup_names else s.name
        if link_skill(s, repo_root, link_name, dry_run=args.dry_run, force=args.force):
            linked += 1
    print(f"\nLinked {linked}/{len(all_skills)} skills.")


def _target_in_vendor(link: Path, vend: Path) -> bool:
    """Check whether a symlink resolves into the vendor directory."""
    dest_raw = os.readlink(str(link))
    dest = Path(dest_raw)
    if not dest.is_absolute():
        dest = link.parent / dest
    try:
        real_dest = os.path.realpath(str(dest))
        real_vend = os.path.realpath(str(vend))
    except OSError:
        return False
    # Case-insensitive comparison (macOS default fs is case-insensitive)
    return real_dest.lower().startswith(real_vend.lower())


def cmd_unlink_all(args: argparse.Namespace, repo_root: Path) -> None:
    skills_path = skills_dir(repo_root)
    vend = vendor_dir(repo_root).resolve()
    unlinked = 0

    for entry in sorted(skills_path.iterdir()):
        if not entry.is_symlink():
            continue
        if not _target_in_vendor(entry, vend):
            continue
        if unlink_skill(entry.name, repo_root, dry_run=args.dry_run):
            unlinked += 1

    if unlinked == 0:
        print("No vendor symlinks to remove.")
    else:
        print(f"\nUnlinked {unlinked} symlinks.")


def cmd_doctor(args: argparse.Namespace, repo_root: Path) -> None:
    print("🔍 Running vendor skills doctor check ...\n")
    issues = 0

    # 1. Submodule status
    print("── Submodules ──")
    rc, out, err = run(["git", "submodule", "status"], cwd=repo_root)
    if rc == 0 and out:
        for line in out.splitlines():
            stripped = line.strip()
            if stripped.startswith("-"):
                print(f"  ⚠️  not initialized: {stripped[1:].strip()}")
                issues += 1
            elif stripped.startswith("+"):
                print(f"  ⚠️  diverged/outdated: {stripped[1:].strip()}")
                issues += 1
            else:
                print(f"  ✓ {stripped}")
    elif not out:
        print("  ✓ no submodules (or error checking)")
    print()

    # 2. Skills discovery
    print("── Discovered skills ──")
    vend = vendor_dir(repo_root)
    if not vend.is_dir():
        print("  ❌ .opencode/vendor/ directory missing")
        return

    all_skills = discover_skills(vend)
    if not all_skills:
        print("  ⚠️  No skills discovered")
    else:
        print(f"  ✓ {len(all_skills)} skill(s) discovered")
    print()

    # 3. Duplicate names
    dup_names, dup_ns = detect_duplicates(all_skills)
    if dup_names:
        print(f"── Duplicate skill names ({len(dup_names)}) ──")
        for name, dups in dup_names.items():
            vendor_list = ", ".join(d.vendor for d in dups)
            print(f"  ⚠️  '{name}' appears in: {vendor_list}")
        print()
    else:
        print("── Duplicate skill names ──")
        print("  ✓ No duplicates\n")

    # 4. Symlink validation
    print("── Symlinks in .opencode/skills/ ──")
    skills_path = skills_dir(repo_root)
    sk_issues = 0
    for entry in sorted(skills_path.iterdir()):
        if entry.is_symlink():
            target = Path(os.readlink(str(entry)))
            if not target.is_absolute():
                target = (entry.parent / target).resolve()
            if target.exists() and target.is_dir() and (target / "SKILL.md").is_file():
                print(f"  ✓ {entry.name}")
            else:
                print(f"  ❌ broken: {entry.name} -> {target}")
                sk_issues += 1
                issues += 1
        elif entry.is_dir():
            # Real directory (not vendor-managed) -- fine
            pass
        else:
            print(f"  ⚠️  unexpected: {entry.name} (type={entry.name})")
    if sk_issues == 0:
        print("  ✓ All symlinks valid")
    print()

    # 5. Summary
    if issues:
        print(f"❌ Doctor found {issues} issue(s)")
    else:
        print("✓ All checks passed")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


SHARED_ARGS: Dict[str, dict] = {
    "dry_run": {
        "args": ("--dry-run",),
        "kwargs": {
            "action": "store_true",
            "help": "Preview changes without making them",
        },
    },
    "force": {
        "args": ("--force",),
        "kwargs": {"action": "store_true", "help": "Overwrite existing symlinks"},
    },
    "vendor": {
        "args": ("--vendor",),
        "kwargs": {
            "type": str,
            "default": None,
            "help": "Limit operation to a specific vendor",
        },
    },
    "unlink": {
        "args": ("--unlink",),
        "kwargs": {
            "action": "store_true",
            "help": "Unlink all vendor symlinks before linking",
        },
    },
}


def _add_shared(subp: argparse.ArgumentParser, *names: str) -> None:
    for name in names:
        spec = SHARED_ARGS[name]
        subp.add_argument(*spec["args"], **spec["kwargs"])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="manage_vendor_skills",
        description="Manage OpenCode vendor skills",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Path to the .opencode repository root (default: script location)",
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # init
    sub.add_parser("init", help="Initialize and update git submodules")

    # list
    p_list = sub.add_parser("list", help="List discovered vendor skills")
    p_list.add_argument("skill", nargs="?", help="Filter by skill name")
    _add_shared(p_list, "vendor")

    # link
    p_link = sub.add_parser("link", help="Symlink a skill into .opencode/skills/")
    p_link.add_argument("skill", help="Skill name to link")
    _add_shared(p_link, "vendor", "dry_run", "force")

    # unlink
    p_unlink = sub.add_parser("unlink", help="Remove a skill symlink")
    p_unlink.add_argument("skill", help="Skill name to unlink")
    _add_shared(p_unlink, "vendor", "dry_run")

    # link-vendor
    p_lv = sub.add_parser("link-vendor", help="Link all skills from a vendor")
    p_lv.add_argument("vendor_name", help="Vendor name")
    _add_shared(p_lv, "dry_run", "force", "unlink")

    # unlink-vendor
    p_uv = sub.add_parser("unlink-vendor", help="Unlink all skills from a vendor")
    p_uv.add_argument("vendor_name", help="Vendor name")
    _add_shared(p_uv, "dry_run")

    # link-all
    p_la = sub.add_parser("link-all", help="Link all discovered vendor skills")
    _add_shared(p_la, "dry_run", "force", "unlink")

    # unlink-all
    p_ua = sub.add_parser("unlink-all", help="Unlink all vendor-linked skills")
    _add_shared(p_ua, "dry_run")

    # doctor
    sub.add_parser("doctor", help="Validate skill setup")

    return parser


def find_repo_root() -> Path:
    """Return the .opencode repository root containing this script."""
    return Path(__file__).resolve().parent.parent


def _resolve_repo_root(candidate: Path) -> Path:
    """Resolve the repo root to its canonical real path."""
    return Path(os.path.realpath(str(candidate)))


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    repo_root = args.repo_root or find_repo_root()
    repo_root = _resolve_repo_root(repo_root)

    if not (repo_root / "opencode.jsonc").is_file():
        print(f"❌ {repo_root} is not a .opencode repository root")
        sys.exit(1)

    commands = {
        "init": cmd_init,
        "list": cmd_list,
        "link": cmd_link,
        "unlink": cmd_unlink,
        "link-vendor": cmd_link_vendor,
        "unlink-vendor": cmd_unlink_vendor,
        "link-all": cmd_link_all,
        "unlink-all": cmd_unlink_all,
        "doctor": cmd_doctor,
    }

    fn = commands.get(args.command)
    if fn:
        fn(args, repo_root)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
