import { ipcMain } from 'electron';
import { settingsStore } from '../services/settings-store';

const FOOTER_KEY = 'footer';

export function setupFooterHandlers() {
  ipcMain.handle('get-footer', async () => {
    try {
      const properties = settingsStore.get(FOOTER_KEY);
    
      return { properties };
    } catch (error) {
      console.error('Error retrieving footer properties:', error);
      throw error;
    }
  });

  ipcMain.handle('set-footer', async (_, properties: any) => {
    try {
      if (!properties) {
        throw new Error('Properties are required');
      }

      
      settingsStore.set(FOOTER_KEY, properties);
      return { success: true };
    } catch (error) {
      console.error('Error saving footer properties:', error);
      throw error;
    }
  });
} 