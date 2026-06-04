import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { ONBOARDING_KEY } from "./onboarding";

SplashScreen.preventAutoHideAsync();

export default function GateScreen() {
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (val) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
      SplashScreen.hideAsync();
    });
  }, []);

  return null;
}
