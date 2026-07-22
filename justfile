set shell := ["bash", "-euo", "pipefail", "-c"]

root := justfile_directory()
ansible_collections := root / ".cache/ansible/collections"
export ANSIBLE_COLLECTIONS_PATH := ansible_collections
export ANSIBLE_COLLECTIONS_SCAN_SYS_PATH := "false"

default:
    @just --list

[private]
ansible-deps:
    ansible-galaxy collection install -r "{{ root }}/scripts/requirements.yaml" -p "{{ ansible_collections }}"

# Install workstation dependencies on macOS.
bootstrap: ansible-deps
    ansible-playbook "{{ root }}/scripts/tools-setup.playbook.yaml"

# Install workstation dependencies on Debian/RedHat-family Linux.
bootstrap-linux: ansible-deps
    ansible-playbook --ask-become-pass "{{ root }}/scripts/tools-setup.playbook.yaml"

# Install the locked Bun dependencies.
install:
    bun install --frozen-lockfile

typecheck:
    bun run typecheck

# Run local source checks.
check: install
    just --fmt --check
    just typecheck

# Run the same source checks used by CI.
ci: check

ansible-check: ansible-deps
    ansible-playbook --syntax-check "{{ root }}/scripts/tools-setup.playbook.yaml"
    ansible-lint "{{ root }}/scripts/tools-setup.playbook.yaml"
