# Harness Component Registry

`teams/*.jsonc` is the runtime inventory consumed by `plugins/harness-teams.ts`. Agent prompts remain the source of workflow behavior; manifests contain only component identity, state, model assignment, and dependency hints.

## Runtime Mapping

| Manifest component | OpenCode config mutation |
|---|---|
| Team `enabled: false` | Disable every component in that team |
| Agent | Set `config.agent[id].disable` and optionally override `model` |
| Skill | Append an exact allow/deny to global and per-agent skill permissions; block disabled IDs in `skills_load` |
| MCP | Set `config.mcp[id].enabled` |
| Instruction | Add or remove the exact path from `config.instructions` |

Instruction paths in `opencode.jsonc` are explicit so the plugin can remove one team instruction without expanding and rebuilding a shared wildcard. Components use stable runtime IDs rather than source paths, which allows the physical files to remain namespaced under `agents/<team-id>/` and `skills/<skill-id>/`.

## Toggle A Team Or Component

Set the team gate to disable everything in one operation:

```jsonc
{
  "id": "senior-rust-developer",
  "enabled": false,
  // ...
}
```

Keep the team enabled and change one component for a targeted toggle:

```jsonc
{
  "components": {
    "agents": [
      { "id": "senior-rust-developer/performance-engineer", "enabled": false, "required": false },
    ],
  },
}
```

The effective state is `team.enabled && component.enabled`. OpenCode loads config and plugins once, so quit and restart OpenCode after changing a manifest.

## Plugin Rules

- Validate every manifest against `team.schema.json` before mutating config.
- Reject duplicate team and component IDs.
- Apply the team gate first, then the component state; manifest state is authoritative for registered components.
- Warn when an enabled team has a disabled component marked `required: true`.
- Apply an agent model only when the component explicitly declares `model`.
- Reject local instruction wildcards that could re-include a disabled team instruction.
- When disabling skills through permission rules, append exact denies after broad allows because OpenCode uses the last matching rule.
- Keep workflow prose out of manifests; the entry agent owns orchestration.
