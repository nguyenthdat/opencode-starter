import type {
  TuiDialogSelectOption,
  TuiPlugin,
  TuiPluginApi,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui";
import { resolve } from "node:path";

import {
  listHarnessTeams,
  setHarnessToggle,
  type HarnessComponentKind,
  type HarnessTeamsPluginOptions,
  type HarnessToggleRequest,
  type TeamComponent,
  type TeamManifest,
} from "./index.ts";

const COMPONENT_TITLES: Record<HarnessComponentKind, string> = {
  agents: "Agents",
  skills: "Skills",
  mcps: "MCPs",
  instructions: "Instructions",
};

type ToggleChoice =
  | { type: "back" }
  | { type: "team" }
  | {
      type: "component";
      componentKind: HarnessComponentKind;
      component: TeamComponent;
    };

interface TuiState {
  api: TuiPluginApi;
  options: HarnessTeamsPluginOptions;
  updating: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function componentFooter(team: TeamManifest, component: TeamComponent): string {
  if (!component.enabled) return component.required ? "disabled, required" : "disabled";
  if (!team.enabled) return component.required ? "enabled, team off, required" : "enabled, team off";
  return component.required ? "enabled, required" : "enabled";
}

function activeSessionBusy(api: TuiPluginApi): boolean {
  const current = api.route.current;
  if (current.name !== "session" || !("params" in current) || !current.params) return false;
  const sessionID = current.params.sessionID;
  if (typeof sessionID !== "string") return false;
  const status = api.state.session.status(sessionID);
  return status?.type === "busy" || status?.type === "retry";
}

async function showTeams(state: TuiState): Promise<void> {
  try {
    const teams = await listHarnessTeams(state.options);
    if (teams.length === 0) {
      state.api.ui.toast({ variant: "warning", message: "No harness team manifests found." });
      return;
    }

    state.api.ui.dialog.replace(() =>
      state.api.ui.DialogSelect<string>({
        title: "Harness Teams",
        placeholder: "Select a team",
        options: teams.map((team) => ({
          title: team.id,
          value: team.id,
          description: team.description,
          footer: team.enabled ? "enabled" : "disabled",
        })),
        onSelect(option) {
          const team = teams.find((item) => item.id === option.value);
          if (team) showTeam(state, team);
        },
      }),
    );
  } catch (error) {
    state.api.ui.toast({ variant: "error", message: errorMessage(error) });
  }
}

function showTeam(state: TuiState, team: TeamManifest): void {
  const options: TuiDialogSelectOption<ToggleChoice>[] = [
    {
      title: "Back to teams",
      value: { type: "back" },
      category: "Navigation",
    },
    {
      title: "Team enabled",
      value: { type: "team" },
      description: "Master switch for every component",
      footer: team.enabled ? "enabled" : "disabled",
      category: "Team",
    },
  ];

  for (const componentKind of Object.keys(COMPONENT_TITLES) as HarnessComponentKind[]) {
    for (const component of team.components[componentKind]) {
      options.push({
        title: component.id,
        value: { type: "component", componentKind, component },
        description: component.model ? `model: ${component.model}` : undefined,
        footer: componentFooter(team, component),
        category: COMPONENT_TITLES[componentKind],
      });
    }
  }

  state.api.ui.dialog.replace(() =>
    state.api.ui.DialogSelect<ToggleChoice>({
      title: team.id,
      placeholder: "Select a switch",
      options,
      onSelect(option) {
        if (option.value.type === "back") {
          void showTeams(state);
          return;
        }
        confirmToggle(state, team, option.value);
      },
    }),
  );
}

function confirmToggle(
  state: TuiState,
  team: TeamManifest,
  choice: Exclude<ToggleChoice, { type: "back" }>,
): void {
  const enabled = choice.type === "team" ? team.enabled : choice.component.enabled;
  const label = choice.type === "team" ? team.id : choice.component.id;
  const next = enabled ? "disabled" : "enabled";
  const busyWarning = activeSessionBusy(state.api)
    ? "\n\nThe current session is active and may be interrupted."
    : "";

  state.api.ui.dialog.replace(() =>
    state.api.ui.DialogConfirm({
      title: `Set ${next}?`,
      message: `${label} will be ${next}. OpenCode will reload the current instance; sessions are preserved.${busyWarning}`,
      onConfirm() {
        void applyToggle(state, team, choice, !enabled);
      },
      onCancel() {
        showTeam(state, team);
      },
    }),
  );
}

async function applyToggle(
  state: TuiState,
  team: TeamManifest,
  choice: Exclude<ToggleChoice, { type: "back" }>,
  enabled: boolean,
): Promise<void> {
  if (state.updating) return;
  state.updating = true;

  const request: HarnessToggleRequest =
    choice.type === "team"
      ? { teamID: team.id, enabled }
      : {
          teamID: team.id,
          componentKind: choice.componentKind,
          componentID: choice.component.id,
          enabled,
        };
  const label = choice.type === "team" ? team.id : choice.component.id;
  let saved = false;

  try {
    await setHarnessToggle(state.options, request);
    saved = true;
    state.api.ui.dialog.clear();
    state.api.ui.toast({
      variant: "success",
      message: `${label} ${enabled ? "enabled" : "disabled"}. Reloading harness...`,
    });
    await state.api.client.instance.dispose();
  } catch (error) {
    state.api.ui.toast({
      variant: "error",
      message: saved
        ? `Manifest saved, but instance reload failed: ${errorMessage(error)}`
        : errorMessage(error),
    });
  } finally {
    state.updating = false;
  }
}

export function createHarnessTeamsTuiPlugin(
  options: HarnessTeamsPluginOptions,
): TuiPluginModule {
  const normalizedOptions = { ...options, root: resolve(options.root) };
  const tui: TuiPlugin = async (api) => {
    const state: TuiState = { api, options: normalizedOptions, updating: false };
    api.keymap.registerLayer({
      commands: [
        {
          name: "harness.open",
          title: "Harness Teams",
          desc: "Enable or disable harness teams and components",
          category: "Harness",
          namespace: "palette",
          slashName: "harness",
          run() {
            return showTeams(state);
          },
        },
      ],
      bindings: [],
    });
  };

  return {
    id: "harness-teams",
    tui,
  };
}

export default createHarnessTeamsTuiPlugin({
  root: resolve(import.meta.dir, "../../.."),
});
