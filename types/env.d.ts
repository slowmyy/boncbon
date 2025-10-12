declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_RUNWARE_API_KEY: string;
      EXPO_PUBLIC_RUNWARE_API_URL: string;
      EXPO_PUBLIC_COMET_API_KEY: string;
    }
  }
}

// Ensure this file is treated as a module
export {};