import { ipcMain } from 'electron';
import { settingsStore } from '../services/settings-store';

const THEME_KEY = 'theme';

export function setupThemeHandlers() {
  ipcMain.handle('get-theme', async () => {
    try {
      const theme = settingsStore.get(THEME_KEY);
    
      return { theme };
    } catch (error) {
      console.error('Error retrieving theme:', error);
      throw error;
    }
  });

  ipcMain.handle('set-theme', async (_, themeData: any) => {
    try {
      if (!themeData) {
        throw new Error('Theme data is required');
      }

    
      settingsStore.set(THEME_KEY, themeData);
      return { success: true };
    } catch (error) {
      console.error('Error saving theme:', error);
      throw error;
    }
  });
} 