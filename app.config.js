const IS_DEV = process.env.APP_VARIANT !== "production";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: IS_DEV ? "Cy TTY (Dev)" : "Cy TTY",
  slug: "cy-tty",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "cytty",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IS_DEV ? "com.cytro.cytty.dev" : "com.cytro.cytty",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#141d41",
      foregroundImage: "./assets/images/android-icon-foreground.png",
    },
    predictiveBackGestureEnabled: false,
    package: IS_DEV ? "com.cytro.cytty.dev" : "com.cytro.cytty",
  },
  plugins: [
    "expo-router",
    "expo-screen-orientation",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#141d41",
        android: {
          image: "./assets/images/splash-icon.png",
          imageWidth: 280,
        },
        ios: {
          image: "./assets/images/splash-icon.png",
          imageWidth: 280,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "8a15f3ba-dfe0-46cc-8eb1-ff676fc178b1",
    },
  },
  owner: "cytro",
};

export default config;
