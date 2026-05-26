import fs from "fs";
import { DefaultRuntimeHostAdapter } from "../adapters/runtime-host-adapter";

export class AndroidSdkService {
  constructor(private readonly adapter = new DefaultRuntimeHostAdapter()) {}

  getStatus() {
    const hostOs = this.adapter.getHostOs();
    const paths = this.adapter.resolveToolPaths();

    const exists = {
      sdkRoot: !!paths.sdkRoot && fs.existsSync(paths.sdkRoot),
      adb: !!paths.adbPath && fs.existsSync(paths.adbPath),
      emulator: !!paths.emulatorPath && fs.existsSync(paths.emulatorPath),
      aapt: !!paths.aaptPath && fs.existsSync(paths.aaptPath),
      sdkmanager: !!paths.sdkmanagerPath && fs.existsSync(paths.sdkmanagerPath),
      avdmanager: !!paths.avdmanagerPath && fs.existsSync(paths.avdmanagerPath)
    };

    return {
      hostOs,
      env: {
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || null,
        ANDROID_HOME: process.env.ANDROID_HOME || null
      },
      paths,
      exists,
      ready: Object.values(exists).every(Boolean)
    };
  }
}