# Image Path Resolution

When the user attaches or pastes an image/file and only a filename is visible:

1. Do not ask the user for the path immediately.
2. First try to resolve the file path by checking:
   - the path explicitly written in the user prompt,
   - OpenCode attachment metadata,
   - current working directory,
   - `/tmp`,
   - common OpenCode temp/cache directories.
3. If a matching readable file is found, use that full path with xberg.
4. Ask the user for the path only after path resolution fails.

Never ask for a full path when the prompt already contains an absolute path.
