# Harness Component Registry

`teams/*.jsonc` is a declarative inventory for future OpenCode component toggles. Agent prompts remain the source of workflow behavior; manifests contain only component identity, default state, model assignment, and dependency hints.

## Future Plugin Mapping

| Manifest component | OpenCode config mutation |
|---|---|
| Team `enabled: false` | Disable every component in that team |
| Agent | Set `config.agent[id].disable` and optionally override `model` |
| Skill | Deny or hide the exact skill ID through the skill loader/permission layer |
| MCP | Set `config.mcp[id].enabled` |
| Instruction | Add or remove the exact path from `config.instructions` |

Instruction paths in `opencode.jsonc` are explicit so a plugin can remove one team instruction without expanding and rebuilding a shared wildcard. Components use stable runtime IDs rather than source paths, which allows the physical files to remain namespaced under `agents/<team-id>/` and `skills/<skill-id>/`.

## Plugin Rules

- Validate every manifest against `team.schema.json` before mutating config.
- Reject duplicate team and component IDs.
- Apply team state first, then component state, then user overrides.
- Warn when an enabled team has a disabled component marked `required: true`.
- Never silently change an agent model. Use the component `model` only as an explicit default or override.
- Reject or normalize local instruction wildcards that could re-include a disabled team instruction.
- When disabling skills through permission rules, append exact denies after broad allows because OpenCode uses the last matching rule.
- Keep workflow prose out of manifests; the entry agent owns orchestration.
