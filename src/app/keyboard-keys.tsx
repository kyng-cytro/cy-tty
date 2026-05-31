import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Stack } from "expo-router";
import { StyleSheet, TouchableOpacity } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Button, Divider, Switch, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEFAULT_KEYS, type KeyEntry } from "@/core/keyboard/keyboard-settings";
import { useKeyboardSettings } from "@/core/keyboard/keyboard-settings-context";

export default function KeyboardKeysScreen() {
  const theme = useTheme();
  const { keys, updateKeys } = useKeyboardSettings();

  function renderItem({ item, drag, isActive }: RenderItemParams<KeyEntry>) {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          activeOpacity={0.7}
          style={[
            styles.row,
            {
              backgroundColor: isActive
                ? theme.colors.surfaceVariant
                : theme.colors.surface,
            },
            !item.enabled && styles.rowDisabled,
          ]}
        >
          <MaterialCommunityIcons
            name="drag-horizontal-variant"
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={styles.dragHandle}
          />
          <Text
            variant="bodyMedium"
            style={[styles.label, { color: theme.colors.onSurface }]}
          >
            {item.id}
          </Text>
          <Switch
            value={item.enabled}
            onValueChange={(enabled) =>
              updateKeys(
                keys.map((k) => (k.id === item.id ? { ...k, enabled } : k)),
              )
            }
          />
        </TouchableOpacity>
        {!isActive && <Divider />}
      </ScaleDecorator>
    );
  }

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen
        options={{
          title: "Keyboard Keys",
          headerRight: () => (
            <Button
              onPress={() => updateKeys(DEFAULT_KEYS)}
              textColor={theme.colors.primary}
            >
              Reset
            </Button>
          ),
        }}
      />
      <Text
        variant="bodySmall"
        style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
      >
        Long-press a row to drag and reorder. Toggle to show or hide a key.
      </Text>
      <DraggableFlatList
        data={keys}
        renderItem={renderItem}
        containerStyle={styles.list}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => updateKeys(data)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDisabled: { opacity: 0.45 },
  dragHandle: { marginRight: 12 },
  label: { flex: 1 },
});
