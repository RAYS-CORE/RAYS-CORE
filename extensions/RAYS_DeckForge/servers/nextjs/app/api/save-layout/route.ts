import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const { layout_name, components } = await request.json();

    if (!layout_name || !components || !Array.isArray(components)) {
      return NextResponse.json(
        {
          error:
            "Invalid request body. Expected layout_name and components array.",
        },
        { status: 400 }
      );
    }

    // Define the layouts directory path
    const layoutsDir = join(process.cwd(), "app_data", "layouts", layout_name);

    // Create the directory if it doesn't exist
    if (!existsSync(layoutsDir)) {
      await mkdir(layoutsDir, { recursive: true });
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
      const filePath = join(layoutsDir, fileName);
      const cleanComponentCode = component_code
        .replace(/```tsx/g, "")
        .replace(/```/g, "");

      await writeFile(filePath, cleanComponentCode, "utf8");
      savedFiles.push({
        slide_number,
        component_name,
        file_path: filePath,
        file_name: fileName,
      });
    }

    return NextResponse.json({
      success: true,
      layout_name,
      path: layoutsDir,
      saved_files: savedFiles.length,
      components: savedFiles,
    });
  } catch (error) {
    console.error("Error saving layout:", error);
    return NextResponse.json(
      { error: "Failed to save layout components" },
      { status: 500 }
    );
  }
}
