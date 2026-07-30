import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { getUserConfig } from "../utils";
import { nextjsDir } from "../utils/constants";

export function setupApiHandlers() {
  // Handler for can-change-keys API
  ipcMain.handle("api:can-change-keys", async () => {
    const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";
    return { canChange: canChangeKeys };
  });

  // Handler for has-required-key API
  ipcMain.handle("api:has-required-key", async () => {
    const userConfigPath = process.env.USER_CONFIG_PATH;

    let keyFromFile = "";
    if (userConfigPath && fs.existsSync(userConfigPath)) {
      try {
        const raw = fs.readFileSync(userConfigPath, "utf-8");
        const cfg = JSON.parse(raw || "{}");
        keyFromFile = cfg?.OPENAI_API_KEY || "";
      } catch {
        // Silent error handling
      }
    }

    const keyFromEnv = process.env.OPENAI_API_KEY || "";
    const hasKey = Boolean((keyFromFile || keyFromEnv).trim());

    return { hasKey };
  });

  // Reads persisted user config so runtime toggles from the settings page
  // are picked up immediately without requiring an app restart.
  ipcMain.handle("api:telemetry-status", async () => {
    const cfg = getUserConfig();
    const fromConfig = cfg.DISABLE_ANONYMOUS_TRACKING;
    const fromEnv = process.env.DISABLE_ANONYMOUS_TRACKING;
    const raw = fromConfig ?? fromEnv ?? "";
    const isDisabled = raw === "true" || raw === "True";
    return { telemetryEnabled: !isDisabled };
  });

  // Handler for save-layout API
  ipcMain.handle("api:save-layout", async (event, { layout_name, components }) => {
    try {
      if (!layout_name || !components || !Array.isArray(components)) {
        throw new Error("Invalid request body. Expected layout_name and components array.");
      }

      // Define the layouts directory path
      const layoutsDir = path.join(process.cwd(), "app_data", "layouts", layout_name);

      // Create the directory if it doesn't exist
      if (!fs.existsSync(layoutsDir)) {
        fs.mkdirSync(layoutsDir, { recursive: true });
      }

      // Save each component as a separate file
      const savedFiles = [];

      for (const component of components) {
        const { slide_number, component_code, component_name } = component;

        if (!component_code || !component_name) {
          console.warn(
            `Skipping component for slide ${slide_number}: missing code or name`
          );
          continue;
        }

        const fileName = `${component_name}.tsx`;
        const filePath = path.join(layoutsDir, fileName);
        const cleanComponentCode = component_code
          .replace(/```tsx/g, "")
          .replace(/```/g, "");

        fs.writeFileSync(filePath, cleanComponentCode, "utf8");
        savedFiles.push({
          slide_number,
          component_name,
          file_path: filePath,
          file_name: fileName,
        });
      }

      return {
        success: true,
        layout_name,
        path: layoutsDir,
        saved_files: savedFiles.length,
        components: savedFiles,
      };
    } catch (error) {
      console.error("Error saving layout:", error);
      throw new Error("Failed to save layout components");
    }
  });

  // Handler for templates API (static list)
  ipcMain.handle("api:templates", async () => {
    try {
      const templatesPath = path.join(nextjsDir, "presentation-templates");

      if (!fs.existsSync(templatesPath)) {
        return [];
      }

      const items = fs.readdirSync(templatesPath, { withFileTypes: true });
      const templateDirectories = items
        .filter(item => item.isDirectory())
        .map(dir => dir.name);

      const allLayouts: Array<{ templateName: string; templateID: string; files: string[]; settings: any }> = [];

      // Scan each template directory for layout files and settings
      for (const templateName of templateDirectories) {
        try {
          const templatePath = path.join(templatesPath, templateName);
          const templateFiles = fs.readdirSync(templatePath);

          // Filter for .tsx files and exclude any non-layout files
          const layoutFiles = templateFiles.filter(file =>
            file.endsWith('.tsx') &&
            !file.startsWith('.') &&
            !file.includes('.test.') &&
            !file.includes('.spec.') &&
            file !== 'settings.json'
          );

          // Read settings.json if it exists
          let settings: any = null;
          const settingsPath = path.join(templatePath, 'settings.json');
          try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(settingsContent);
          } catch (settingsError) {
            console.warn(`No settings.json found for template ${templateName} or invalid JSON`);
            // Provide default settings if settings.json is missing or invalid
            settings = {
              description: `${templateName} presentation layouts`,
              ordered: false,
              default: false
            };
          }

          if (layoutFiles.length > 0) {
            allLayouts.push({
              templateName: templateName,
              templateID: templateName,
              files: layoutFiles,
              settings: settings
            });
          }
        } catch (error) {
          console.error(`Error reading template directory ${templateName}:`, error);
          // Continue with other templates even if one fails
        }
      }

      return allLayouts;
    } catch (error) {
      console.error("Error reading templates:", error);
      return [];
    }
  });
}