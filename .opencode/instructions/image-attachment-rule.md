# Image/File Attachment Rule

When the user attaches, pastes, or references an image/file, treat it as an accessible local file.

Before answering:
1. Identify the local attachment path provided by OpenCode, `--file`, or the user message.
2. If the path points to an image, screenshot, PDF, Office file, or binary document, use xberg first.
3. Analyze the extracted OCR/text/layout/metadata from xberg.
4. Only say the file cannot be analyzed if:
   - no local path is available,
   - the file does not exist,
   - or xberg fails.

Never say “I cannot view images” when a local file path or OpenCode attachment path exists.

If the user attaches images, or similar, immediately use xberg on the attached file path.
