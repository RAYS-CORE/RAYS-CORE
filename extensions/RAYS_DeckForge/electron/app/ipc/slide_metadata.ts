import { BrowserWindow, ipcMain } from "electron";
import fs from 'fs';
import path from 'path';
import { tempDir } from "../utils/constants";


interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FontStyles {
  name: string;
  size: number;
  bold: boolean;
  weight: number;
  color: string;
}

interface TextElement {
  position: Position;
  paragraphs: {
    alignment: number;
    text: string;
    font: FontStyles;
  }[];
}

interface PictureElement {
  position: Position;
  picture: {
    is_network: boolean;
    path: string;
  };
  shape: string | null;
  object_fit: {
    fit: string | null;
    focus: number[];
  };
  overlay: string | null;
  border_radius: number[];
}

interface BoxElement {
  position: Position;
  type: number;
  fill: {
    color: string;
  };
  border_radius: number;
  stroke: {
    color: string;
    thickness: number;
  };
  shadow: {
    radius: number;
    color: string;
    offset: number;
    opacity: number;
    angle: number;
  };
}

interface LineElement {
  position: Position;
  lineType: number;
  thickness: string;
  color: string;
}

interface GraphElement {
  position: Position;
  picture: {
    is_network: boolean;
    path: string;
  };
  border_radius: number[];
}

type SlideElement = TextElement | PictureElement | BoxElement | LineElement | GraphElement;




export function setupSlideMetadataHandlers() {
  ipcMain.handle("get-slide-metadata", async (_, url: string, theme: string, customColors?: any) => {
    let win: BrowserWindow | null = null;

    try {
      win = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
          webSecurity: false,
          preload: path.join(__dirname, '../preloads/index.js'),
        },
        show: false,
      });

      await win.loadURL(url, { userAgent: 'electron' });


      await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const check = () => {
            const el = document.querySelector('[data-element-type="slide-container"]');
            if (el) return resolve(true);
            setTimeout(check, 200);
          };
          check();
        });
      `);
      const metadata = await win.webContents.executeJavaScript(
        `
 (() => {
          const rgbToHex = (color) => {
            if (!color || color === "transparent" || color === "none") return "000000";
            if (color.startsWith("#")) return color.replace("#", "");
            const matches = color.match(/\\d+/g);
            if (!matches) return "000000";
            const [r, g, b] = matches.map(x => parseInt(x));
            return [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
          };

          const slidesMetadata = [];
          const slideContainers = document.querySelectorAll('[data-element-type="slide-container"]');

          slideContainers.forEach((container) => {
            const containerEl = container;
            containerEl.style.width = "1280px";
            containerEl.style.height = "720px";
            containerEl.style.transform = "none";

            const containerRect = containerEl.getBoundingClientRect();
            const slideIndex = parseInt(containerEl.getAttribute("data-slide-index") || "0");
            const backgroundColor = rgbToHex(window.getComputedStyle(containerEl).backgroundColor);

            const elements = [];
            const slideElements = containerEl.querySelectorAll('[data-slide-element]:not([data-element-type="slide-container"])');

            slideElements.forEach((element) => {
              const el = element;
              const elementRect = el.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(el);

              const position = {
                left: Math.round(elementRect.left - containerRect.left),
                top: Math.round(elementRect.top - containerRect.top),
                width: Math.round(elementRect.width),
                height: Math.round(elementRect.height),
              };

              const elementType = el.getAttribute("data-element-type");
              if (!elementType) return;

              switch (elementType) {
                case "text":
                  elements.push({
                    position,
                    paragraphs: [{
                      alignment: el.getAttribute("data-is-align") === 'true' ? 2 : 1,
                      text: el.getAttribute("data-text-content") || el.textContent || "",
                      font: {
                        name: computedStyle.fontFamily.split('_')[2] || 'Inter',
                        size: parseInt(computedStyle.fontSize),
                        bold: parseInt(computedStyle.fontWeight) >= 500,
                        weight: parseInt(computedStyle.fontWeight),
                        color: rgbToHex(computedStyle.color),
                      },
                    }],
                  });
                  break;

                case "picture":
                  const imgEl = el.tagName.toLowerCase() === "img" ? el : el.querySelector("img");
                  if (imgEl) {
                    elements.push({
                      position,
                      picture: {
                        is_network: imgEl.src.startsWith("http"),
                        path: imgEl.src || imgEl.getAttribute("data-image-path") || "",
                      },
                      shape: imgEl.getAttribute('data-image-type'),
                      object_fit: {
                        fit: imgEl.getAttribute('data-object-fit'),
                        focus: [
                          parseFloat(imgEl.getAttribute('data-focial-point-x') || '0'),
                          parseFloat(imgEl.getAttribute('data-focial-point-y') || '0'),
                        ],
                      },
                      overlay: el.getAttribute("data-is-icon") ? "ffffff" : null,
                      border_radius: Array(4).fill(parseInt(computedStyle.borderRadius) || 0),
                    });
                  }
                  break;

                case "graph":
                  elements.push({
                    position,
                    picture: {
                      is_network: true,
                      path: \`__GRAPH_PLACEHOLDER__\${el.getAttribute("data-element-id")}\`,
                    },
                    border_radius: [0, 0, 0, 0],
                  });
                  break;

                case "slide-box":
                case "filledbox":
                  const boxShadow = computedStyle.boxShadow;
                  let shadowRadius = 0;
                  let shadowColor = "000000";
                  let shadowOffsetX = 0;
                  let shadowOffsetY = 0;
                  let shadowOpacity = 0;

                  if (boxShadow && boxShadow !== "none") {
                    const boxShadowRegex =
                      /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+),?\\s*([\\d.]+)?\\)?\\s+(-?\\d+)px\\s+(-?\\d+)px\\s+(-?\\d+)px/;
                    const match = boxShadow.match(boxShadowRegex);

                    if (match) {
                      const r = match[1];
                      const g = match[2];
                      const b = match[3];
                      const rgbStr = "rgb(" + r + ", " + g + ", " + b + ")";
                      shadowColor = rgbToHex(rgbStr);
                      shadowOpacity = match[4] ? parseFloat(match[4]) : 1;
                      shadowOffsetX = parseInt(match[5]);
                      shadowOffsetY = parseInt(match[6]);
                      shadowRadius = parseInt(match[7]);
                    }
                  }

                  elements.push({
                    position,
                    type:
                      computedStyle.borderRadius === "9999px" ||
                      computedStyle.borderRadius === "50%"
                        ? 9
                        : 5,
                    fill: {
                      color: rgbToHex(computedStyle.backgroundColor),
                    },
                    border_radius: parseInt(computedStyle.borderRadius) || 0,
                    stroke: {
                      color: rgbToHex(computedStyle.borderColor),
                      thickness: parseInt(computedStyle.borderWidth) || 0,
                    },
                    shadow: {
                      radius: shadowRadius,
                      color: shadowColor,
                      offset: Math.sqrt(
                        shadowOffsetX * shadowOffsetX +
                          shadowOffsetY * shadowOffsetY
                      ),
                      opacity: shadowOpacity,
                      angle: Math.round(
                        (Math.atan2(shadowOffsetY, shadowOffsetX) * 180) / Math.PI
                      ),
                    },
                  });
                  break;

                case "line":
                  elements.push({
                    position,
                    lineType: 1,
                    thickness: computedStyle.borderWidth || computedStyle.height,
                    color: rgbToHex(
                      computedStyle.borderColor || computedStyle.backgroundColor
                    ),
                  });
                  break;
              }
            });

            slidesMetadata.push({ slideIndex, backgroundColor, elements });
          });

          return slidesMetadata;
        })();
`
      )
      // ✅ Handle Graphs: capture each graph element as an image
      const graphIds: { id: string; bounds: Electron.Rectangle }[] = await win.webContents.executeJavaScript(`
        (() => {
          return Array.from(document.querySelectorAll('[data-element-type="graph"]')).map(el =>  el.getAttribute("data-element-id"));
        })();
      `);

      for (const id of graphIds) {
        try {
          // Scroll into view first
          await win.webContents.executeJavaScript(`
    document.querySelector('[data-element-id="${id}"]').scrollIntoView({ behavior: 'instant', block: 'center' });
 
    `);
          // Wait a bit for any animations/rendering to complete
          await new Promise((r) => setTimeout(r, 2000));

          const bounds: Electron.Rectangle = await win.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('[data-element-id="${id}"]');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })();
    `);

          const image = await win.webContents.capturePage(bounds);
          const buffer = image.toJPEG(100);


          if (buffer.length === 0) {
            console.error("Empty buffer! Graph not captured.");
            continue;
          }

          const filePath = path.join(tempDir, `chart-${id}-${Date.now()}.jpeg`);
          fs.writeFileSync(filePath, buffer);

          // Update metadata
          metadata.forEach((slide: any) => {
            slide.elements.forEach((element: any) => {
              if ("picture" in element && element.picture.path === `__GRAPH_PLACEHOLDER__${id}`) {
                element.picture.path = filePath;
              }
            });
          });
        } catch (err) {
          console.error(`Failed to capture or save chart-${id}:`, err);
        }
      }
      return metadata;
    } catch (error) {
      console.error("Error during page preparation:", error);
      throw error;
    } finally {
      // if (browser) await browser.close();
      if (win) win.close();
    }
  });
}
