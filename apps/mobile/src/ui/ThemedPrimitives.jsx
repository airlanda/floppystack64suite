import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import RetroIcon from "./RetroIcon";

const RETRO_FONT = Platform.select({
  ios: "commodore",
  android: "commodore",
  default: "monospace",
});

export function ThemedCard({ theme, style, children }) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ThemedButton({
  theme,
  label,
  onPress,
  disabled = false,
  variant = "solid",
  icon,
  iconSize = 14,
  style,
  textStyle,
}) {
  const ghost = variant === "ghost";
  const danger = variant === "danger";
  const active = variant === "active";

  const bg = danger
    ? theme.danger
    : active
      ? theme.accent
      : ghost
        ? "transparent"
        : theme.panelAlt;
  const border = danger ? theme.danger : theme.accent;
  const txt = ghost ? theme.muted : theme.text;

  return (
    <Pressable
      style={[
        styles.button,
        style,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, { color: txt }, textStyle]}>{label}</Text>
      {icon ? (
        <View style={styles.buttonIconWrap}>
          <RetroIcon name={icon} size={iconSize} color={txt} accent={theme.muted} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function ThemedInput({ theme, style, multiline = false, ...rest }) {
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      placeholderTextColor="#8f9fb8"
      style={[
        styles.input,
        style,
        {
          borderColor: theme.accent,
          backgroundColor: theme.panelAlt,
          color: theme.text,
        },
        multiline ? styles.inputMultiline : null,
      ]}
    />
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: RETRO_FONT,
  },
  buttonIconWrap: {
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: RETRO_FONT,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  errorText: {
    marginTop: 4,
    color: "#ff9c9c",
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
});
