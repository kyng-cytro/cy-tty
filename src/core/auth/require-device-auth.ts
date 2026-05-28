import * as LocalAuthentication from "expo-local-authentication";

export async function requireDeviceAuth(reason: string): Promise<boolean> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hardware || !enrolled) {
    return true;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
  });
  return result.success;
}
