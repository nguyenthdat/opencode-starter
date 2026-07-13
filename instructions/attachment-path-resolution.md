# Image/File Path Resolution

When an attachment exposes only a filename, resolve it before asking the user: check the prompt, attachment metadata, workspace, `/tmp`, and OpenCode temp/cache paths. Pass the first readable match to xberg. Ask for a path only after resolution fails, and never ask when an absolute path is already provided. Inspect suspicious files without executing them.
