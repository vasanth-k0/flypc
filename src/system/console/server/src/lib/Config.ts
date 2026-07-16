import fs from 'fs';
import path from 'path';

interface appConfig {
  appName: string;
  port: number;
  author: string;
}

class Config {
  public static singleInstance: Config;
  private configPath: string;
  private configData: appConfig;
  private configFile: string = 'app.json';
  private defaultConfig: appConfig = {
      appName: 'flypc',
      port: 3000,
      author: 'Vasanth.K'
    };

  private constructor() {
    this.configPath = path.resolve(process.cwd(), this.configFile);
    this.configData = this.getConfig();
  }

  /**
   * Singleton
   * @returns singleInstance
   */
  public static instance(): Config {
    if (!Config.singleInstance) {
      Config.singleInstance = new Config();
    }
    return Config.singleInstance;
  }

  private getConfig(): appConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading config file:', error);
    }
    /**
     * Fallback to default
     */
    return this.defaultConfig
  }

  private putConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.configData, null, 2), 'utf8');
    } catch (error) {
      console.error('Error writing config file:', error);
    }
  }

  public get<K extends keyof appConfig>(key: K): appConfig[K] {
    return this.configData[key];
  }

  public set<K extends keyof appConfig>(key: K, value: appConfig[K]): void {
    this.configData[key] = value;
    this.putConfig();
  }

  public getAll(): appConfig {
    return { ...this.configData };
  }
}

export default Config.instance();
