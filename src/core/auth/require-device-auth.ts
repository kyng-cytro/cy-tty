import * as LocalAuthentication from "expo-local-authentication";

/**
 * Prompts the user for biometric or device-credential authentication.
 * Returns true if authenticated, false if cancelled or unavailable.
 */
export async function requireDeviceAuth(reason: string): Promise<boolean> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hardware || !enrolled) {
    // Device has no biometrics / PIN set up — fall through without blocking.
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  return result.success;
}
