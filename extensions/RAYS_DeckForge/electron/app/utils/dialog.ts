import { shell } from "electron";
import { dialog } from "electron";
import path from "path";

export async function showFileDownloadedDialog(filePath: string): Promise<boolean> {
  try {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Open File', 'Open Folder', 'Cancel'],
      defaultId: 0,
      title: 'File Downloaded',
      message: 'What would you like to do?'
    });

    // Open file/folder in background without awaiting to prevent blocking
    if (response === 0) {
      shell.openPath(filePath).catch(err => 
        console.error('Error opening file:', err)
      );
    } else if (response === 1) {
      shell.openPath(path.dirname(filePath)).catch(err => 
        console.error('Error opening folder:', err)
      );
    }

    return true;
  } catch (error: any) {
    console.error('Error handling downloaded file:', error);
    return false;
  }
}