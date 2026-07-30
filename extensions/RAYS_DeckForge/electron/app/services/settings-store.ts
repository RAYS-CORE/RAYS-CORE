import path from 'path';
import fs from 'fs';
import { userDataDir } from '../utils/constants';


class SettingsStore {
  private settingsPath: string;
  private settings: { [key: string]: any };

  constructor() {
    this.settingsPath = path.join(userDataDir, 'settings.json');
    this.settings = {};
    this.loadSettings();
  }

  private loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data);

      } else {
        this.settings = {};
        this.saveSettings();

      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = {};
    }
  }

  private saveSettings() {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));

    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  get(key: string, defaultValue: any = null): any {
    const value = this.settings[key];

    return value || defaultValue;
  }

  set(key: string, value: any): void {

    this.settings[key] = value;
    this.saveSettings();
  }

  // Helper method to check if settings exist
  has(key: string): boolean {
    return key in this.settings;
  }

  // Helper method to delete a setting
  delete(key: string): void {
    delete this.settings[key];
    this.saveSettings();
  }
}

// Export a singleton instance
export const settingsStore = new SettingsStore(); 