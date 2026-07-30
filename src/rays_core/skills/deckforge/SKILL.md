---
name: deckforge
description: AI-powered presentation generation and editing tool
version: 1.0.0
---

# DeckForge Skill

Use this skill whenever the user asks to create, modify, or generate a PowerPoint presentation (PPT/PPTX).

## Available Tools (via RAYS_MCP)

The `RAYS_MCP` server provides tools to generate and manage presentations:

### 1. Generate presentation
Generates a complete presentation from a topic.
**Arguments:**
- `topic`: The subject of the presentation.
- `n_slides`: (int, optional) Number of slides (default 5).
- `template`: (string, optional) Visual template to use ('general', 'modern', 'standard', 'swift').
- `tone`: (string, optional) Tone of the presentation ('default', 'professional', 'casual', 'academic').
- `export_as`: (string, optional) Format ('pptx').
- `language`: (string, optional) Language of the presentation.
- `verbosity`: (string, optional) 'standard', 'detailed', or 'concise'.
- `instructions`: (string, optional) Additional specific instructions.

**Returns:** A dictionary containing `presentation_id`, `file`, and an `edit_url`.

### 2. List templates
Lists all available builtin and custom templates for presentation generation.

### 3. List presentations
Lists all previously generated presentations.

## Presentation Generation Workflow

1. **Understand Requirements:** Identify the topic, tone, number of slides, and any specific instructions from the user.
2. **Open DeckForge Workspace:** Call `open_deckforge` (a custom IDE command or tool if available) so the user can see the UI.
3. **Generate Presentation:** Use the `Generate presentation` tool with the gathered parameters. The system will automatically use the RAYS Studio diffusion models to generate rich, contextual images for the presentation slides if empty spaces exist.
4. **Deliver Result:** Once generated, provide the user with the presentation ID and the `edit_url` so they can preview and customize their slides. Mention that the `.pptx` file was generated locally!

## Image Generation Integration
DeckForge is natively integrated with RAYS Studio. When generating presentations, DeckForge automatically requests diffusion images from the local `rays_studio` server. Ensure that a diffusion model is loaded in RAYS Studio before generation if the user wants AI-generated images on their slides!
