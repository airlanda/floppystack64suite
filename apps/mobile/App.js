import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Slider from "@react-native-community/slider";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { NavigationContainer, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCachedDiskInventory,
  getCachedGameDetail,
  ensureGameBoxArtCached,
  getPendingSyncCount,
  getSetting,
  getSyncQueueStats,
  initLocalDb,
  pushPendingOps,
  queueMetadataEdit,
  queueTitleEdit,
  replaceDiskInventoryFromApi,
  removeDiskLocal,
  searchCachedGames,
  setSetting,
  updateGameRatingLocal,
  upsertSingleGameFromLookup,
  upsertGamesFromApi,
} from "./src/data/localDb";
import { FieldError, ThemedButton, ThemedCard, ThemedInput } from "./src/ui/ThemedPrimitives";
import {
  isValidApiBaseUrl,
  validateAddGamesForm,
} from "./src/data/validation";
import RetroIcon from "./src/ui/RetroIcon";
import FloppySvg from "./src/ui/FloppySvg";
import Drive1541Icon from "./src/ui/Drive1541Icon";
import { BOOTSTRAP_DATA } from "./src/data/bootstrapData";
import badgeGoldDisk from "./assets/badges/badge-gold-disk.png";
import badgeSilverPad from "./assets/badges/badge-silver-pad.png";
import badgeBronzeChip from "./assets/badges/badge-bronze-chip.png";
import badgeElite from "./assets/badges/badge-elite.png";
import badgePro from "./assets/badges/badge-pro.png";
import badgeRookie from "./assets/badges/badge-rookie.png";

const Stack = createNativeStackNavigator();
const API_BASE_URL_SETTING_KEY = "network.apiBaseUrl";
const THEME_KEY_SETTING = "ui.theme";
const LOCAL_ACTIVE_STORE_KEY = "data.activeStoreKey";
const RETRO_FONT = "commodore";
const STAR_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "sans-serif",
});
const THEMES = {
  c64dark: {
    id: "c64dark",
    label: "C64 Dark",
    bg: "#0b1220",
    panel: "#0f1b2b",
    panelAlt: "#0a1524",
    border: "#214666",
    accent: "#2f658f",
    text: "#e8f6ff",
    muted: "#9ec0d8",
    title: "#c8f8ff",
    danger: "#8a2a34",
  },
  mono: {
    id: "mono",
    label: "Mono",
    bg: "#121212",
    panel: "#1b1b1b",
    panelAlt: "#161616",
    border: "#3a3a3a",
    accent: "#5a5a5a",
    text: "#f0f0f0",
    muted: "#bcbcbc",
    title: "#ffffff",
    danger: "#6a2f34",
  },
  amber: {
    id: "amber",
    label: "Amber",
    bg: "#140f06",
    panel: "#22160a",
    panelAlt: "#1a1007",
    border: "#8f5b21",
    accent: "#ffb454",
    text: "#ffe7c2",
    muted: "#e2bf89",
    title: "#ffb454",
    danger: "#7f3a2b",
  },
};

const AUTH_TOKEN_KEY = "auth.token";
const AUTH_USER_KEY = "auth.user";
const GAMIFY_STATE_KEY = "play.gamificationState";
const PLAY_MODES = [
  { id: "random", label: "Quick Play" },
  { id: "unplayed", label: "Unplayed Hunt" },
  { id: "three-in-60", label: "3 in 60" },
];
const RANK_LEGEND = [
  "Arcade Commander (#1)",
  "Joystick Ace (#2)",
  "Pixel Raider (#3)",
  "High-Score Hunter (50+ wins)",
  "Turbo Champion (70%+ win rate)",
  "Cartridge Captain (50%+ win rate)",
  "Disk Runner (30%+ win rate)",
  "Ready Player (everyone else)",
];
const BADGE_LEGEND = [
  { tone: "gold", label: "Gold Disk", description: "#1 in standings" },
  { tone: "silver", label: "Silver Pad", description: "#2 in standings" },
  { tone: "bronze", label: "Bronze Chip", description: "#3 in standings" },
  { tone: "elite", label: "Elite", description: "25+ wins" },
  { tone: "pro", label: "Pro", description: "10+ wins" },
  { tone: "rookie", label: "Rookie", description: "Getting started" },
];

function makeGamesSearchPath(query, limit = 200) {
  const trimmed = String(query || "").trim();
  const params = new URLSearchParams();
  if (trimmed) params.set("q", trimmed);
  params.set("limit", String(limit));
  return `/api/games/search?${params.toString()}`;
}

function getDefaultApiBaseUrl() {
  if (Platform.OS === "android") return "http://10.0.2.2:5000";
  return "http://localhost:5000";
}

function getConfiguredApiBaseUrl(rawValue) {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const override = String(rawValue || "").trim();
  const base = override || (fromEnv && fromEnv.trim() ? fromEnv.trim() : getDefaultApiBaseUrl());
  return base.replace(/\/+$/, "");
}

function getThemeByKey(themeKey) {
  const key = String(themeKey || "").trim().toLowerCase();
  return THEMES[key] || THEMES.c64dark;
}

function withAlpha(hex, alpha) {
  const text = String(hex || "").trim();
  if (!/^#([0-9a-f]{6})$/i.test(text)) return text;
  const normalized = text.slice(1);
  const value = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return `#${normalized}${value.toString(16).padStart(2, "0")}`;
}

function getBrandTokens(theme) {
  const id = String(theme?.id || "").toLowerCase();
  if (id === "amber") {
    return {
      text: "#f0dcc1",
      outline: "#d17a2f",
      line1: "rgba(255,180,84,0.80)",
      line2: "rgba(255,180,84,0.45)",
      line3: "rgba(255,180,84,0.25)",
    };
  }
  if (id === "mono") {
    return {
      text: "#ffffff",
      outline: "#8a8a8a",
      line1: "rgba(255,255,255,0.85)",
      line2: "rgba(255,255,255,0.55)",
      line3: "rgba(255,255,255,0.30)",
    };
  }
  return {
    text: "#dff4ff",
    outline: "#8ec8ff",
    line1: "rgba(142,200,255,0.88)",
    line2: "rgba(145,214,255,0.56)",
    line3: "rgba(145,214,255,0.28)",
  };
}

function resolveImageUri(uri, apiBaseUrl) {
  const text = String(uri || "").trim();
  if (!text) return "";
  if (/^(https?:|file:|data:)/i.test(text)) return text;
  if (text.startsWith("/")) return `${String(apiBaseUrl || "").replace(/\/+$/, "")}${text}`;
  return text;
}

async function getJsonSetting(key, fallback) {
  const raw = await getSetting(key, "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function setJsonSetting(key, value) {
  await setSetting(key, JSON.stringify(value || {}));
}

function resolveAuthHeaders(token, extra = {}) {
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJsonWithBase(apiBaseUrl, path, options = {}) {
  const response = await fetch(`${String(apiBaseUrl || "").replace(/\/+$/, "")}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function defaultGamificationState() {
  return {
    activeChallenge: null,
    recentSelections: [],
    playSessions: [],
    preferences: {
      defaultMode: "random",
      threeInSixtyMinutesPerTarget: 20,
    },
    stats: {
      totalPlayed: 0,
      totalWins: 0,
    },
  };
}

function sanitizeGamificationState(input) {
  const base = defaultGamificationState();
  const next = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...next,
    recentSelections: Array.isArray(next.recentSelections) ? next.recentSelections : [],
    playSessions: Array.isArray(next.playSessions) ? next.playSessions : [],
    preferences: {
      ...base.preferences,
      ...(next.preferences || {}),
    },
    stats: {
      ...base.stats,
      ...(next.stats || {}),
    },
  };
}

function buildChallengeCandidates(disks) {
  const list = [];
  (Array.isArray(disks) ? disks : []).forEach((disk) => {
    ["sideA", "sideB"].forEach((sideKey) => {
      const sideItems = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];
      sideItems.forEach((entry, index) => {
        const gameName = String(entry?.gameName || "").trim();
        if (!gameName) return;
        list.push({
          datasetKey: String(disk?.datasetKey || "default"),
          diskId: Number(disk?.diskId),
          gameKey: String(entry?.key || ""),
          side: sideKey,
          sideLabel: sideKey === "sideA" ? "Side A" : "Side B",
          gameIndex: Number(index || 0),
          gameName,
        });
      });
    });
  });
  return list;
}

function challengeTargetKey(target) {
  return `${target?.datasetKey || "default"}|${target?.diskId}|${target?.side}|${target?.gameIndex}|${target?.gameName || ""}`;
}

function pickStandingBadge(entry, index) {
  if (index === 0) return { label: "Gold Disk", tone: "gold" };
  if (index === 1) return { label: "Silver Pad", tone: "silver" };
  if (index === 2) return { label: "Bronze Chip", tone: "bronze" };
  if (Number(entry?.totalWins || 0) >= 25) return { label: "Elite", tone: "elite" };
  if (Number(entry?.totalWins || 0) >= 10) return { label: "Pro", tone: "pro" };
  return { label: "Rookie", tone: "rookie" };
}

function getBadgeImageSource(tone) {
  if (tone === "gold") return badgeGoldDisk;
  if (tone === "silver") return badgeSilverPad;
  if (tone === "bronze") return badgeBronzeChip;
  if (tone === "elite") return badgeElite;
  if (tone === "pro") return badgePro;
  return badgeRookie;
}

function pickStandingTitle(entry, index) {
  if (index === 0) return "Arcade Commander";
  if (index === 1) return "Joystick Ace";
  if (index === 2) return "Pixel Raider";
  if (Number(entry?.totalWins || 0) >= 50) return "High-Score Hunter";
  if (Number(entry?.winRate || 0) >= 0.7) return "Turbo Champion";
  if (Number(entry?.winRate || 0) >= 0.5) return "Cartridge Captain";
  if (Number(entry?.winRate || 0) >= 0.3) return "Disk Runner";
  return "Ready Player";
}

function RatingSlider({ value = 0, onChange, theme }) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <View style={styles.ratingSliderWrap}>
      <Slider
        minimumValue={0}
        maximumValue={5}
        step={0.5}
        value={clamped}
        onValueChange={(next) => onChange?.(Number(next) || 0)}
        minimumTrackTintColor={theme.title}
        maximumTrackTintColor={theme.border}
        thumbTintColor={theme.title}
        style={styles.ratingSliderNative}
      />
    </View>
  );
}

function getBootstrapStores() {
  return Array.isArray(BOOTSTRAP_DATA?.stores) ? BOOTSTRAP_DATA.stores : [];
}

function getBootstrapStoreById(storeId) {
  const key = String(storeId || "").trim().toLowerCase();
  const stores = getBootstrapStores();
  return (
    stores.find((store) => String(store?.id || "").trim().toLowerCase() === key) ||
    stores.find((store) => String(store?.id || "") === String(BOOTSTRAP_DATA?.defaultStoreKey || "orig")) ||
    stores[0] ||
    null
  );
}

async function seedBootstrapStoreLocal(storeId) {
  const store = getBootstrapStoreById(storeId);
  if (!store || !Array.isArray(store.data)) return [];
  await replaceDiskInventoryFromApi(store.data);
  await setSetting(LOCAL_ACTIVE_STORE_KEY, String(store.id || BOOTSTRAP_DATA?.defaultStoreKey || "orig"));
  return getCachedDiskInventory();
}

function FractionalStarRow({ value = 0, filledColor, emptyColor, size = 14, style }) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const star = "\u2605";
  const compact = size <= 14;
  const cellWidth = Math.max(Math.round(size * (compact ? 1.12 : 1.02)), 14);
  const lineHeight = Math.round(size * 1.32);

  return (
    <View style={[styles.ratingStarsRow, style]}>
      {Array.from({ length: 5 }).map((_, index) => {
        const fillRatio = Math.max(0, Math.min(1, clamped - index));
        const fillWidth = `${Math.min(100, fillRatio * (compact ? 109 : 106))}%`;
        return (
          <View key={`star-${index}`} style={[styles.ratingStarCell, { width: cellWidth, height: lineHeight + 2 }]}>
            <Text
              style={[
                styles.ratingStarGlyph,
                {
                  color: emptyColor,
                  fontSize: size,
                  lineHeight,
                },
              ]}
            >
              {star}
            </Text>
            <View style={[styles.ratingStarFillMask, { width: fillWidth }]}>
              <Text
                style={[
                  styles.ratingStarGlyph,
                  {
                    color: filledColor,
                    fontSize: size,
                    lineHeight,
                  },
                ]}
              >
                {star}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RatingStarsDisplay({ value = 0, theme, large = false, style }) {
  return (
    <FractionalStarRow
      value={value}
      filledColor={theme.title}
      emptyColor={theme.border}
      size={large ? 18 : 14}
      style={style}
    />
  );
}

function RatingStars({ rating = 0, color, mutedColor, size = 13 }) {
  return (
    <FractionalStarRow value={rating} filledColor={color} emptyColor={mutedColor} size={size} />
  );
}

function AppShell({
  children,
  theme,
  navigation,
  currentView = "home",
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  suggestions = [],
  onSelectSuggestion,
  showSearch = false,
  onPlayPress,
  hideTopBar = false,
}) {
  const insets = useSafeAreaInsets();
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const brand = getBrandTokens(theme);
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const navItems = [
    { key: "disks", label: "Disks", route: "DiskView", icon: "disk" },
    { key: "games", label: "Games", route: "Home", icon: "games" },
    { key: "play", label: "Play", route: "Play", icon: "play" },
    { key: "config", label: "Config", route: "Settings", icon: "config" },
    { key: "profile", label: "Profile", route: "Profile", icon: "profile" },
  ];

  useEffect(() => {
    const wave = (value, delayMs) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const animA = wave(pulseA, 0);
    const animB = wave(pulseB, 1100);
    animA.start();
    animB.start();
    return () => {
      animA.stop();
      animB.stop();
    };
  }, [pulseA, pulseB]);

  return (
    <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />

      {!hideTopBar ? (
        <View
          style={[
            styles.appTopBar,
            {
              paddingTop: insets.top + 4,
              borderColor: theme.border,
              backgroundColor: theme.panel,
            },
          ]}
        >
          <View style={styles.appTopBarRow}>
            <View style={styles.appTopBarBrandWrap}>
              <View style={styles.appTopBarBrandIcon}>
                <Drive1541Icon
                  width={34}
                  height={34}
                  caseColor={theme.panelAlt}
                  strokeColor={theme.border}
                  faceColor={theme.bg}
                  detailColor={theme.muted}
                  ledColor={brand.outline}
                  stripe1={brand.line1}
                  stripe2={brand.line2}
                  stripe3={brand.line3}
                />
              </View>
              <View style={styles.appTopBarBrandTextWrap}>
                <View style={styles.appTopBarBrandTextStack}>
                  <Text numberOfLines={1} style={[styles.appTopBarBrand, { color: brand.text }]}>FloppyStack</Text>
                </View>
                <View style={styles.appTopBarBrandLines}>
                  <View style={[styles.appTopBarBrandLine, { backgroundColor: brand.line1 }]} />
                  <View style={[styles.appTopBarBrandLine, { backgroundColor: brand.line2 }]} />
                  <View style={[styles.appTopBarBrandLine, { backgroundColor: brand.line3 }]} />
                </View>
              </View>
            </View>
            <View style={styles.appTopBarPlayWrap}>
              <Text style={[styles.appTopBarPlayLabel, { color: brand.text }]} numberOfLines={1}>Play!</Text>
              <Pressable
                style={[
                  styles.appTopBarPlayBtn,
                  { borderColor: theme.accent, backgroundColor: theme.accent },
                ]}
                onPress={onPlayPress || (() => navigation.navigate("Play"))}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.appTopBarPlayPulse,
                    {
                      borderColor: theme.accent,
                      transform: [{ scale: pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.92, 2.5] }) }],
                      opacity: pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }),
                    },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.appTopBarPlayPulse,
                    {
                      borderColor: theme.accent,
                      transform: [{ scale: pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.92, 2.5] }) }],
                      opacity: pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }),
                    },
                  ]}
                />
                <View style={styles.appTopBarPlayGlyph}>
                  <View style={[styles.appTopBarPlayGlyphLine, { backgroundColor: theme.panelAlt }]} />
                  <View style={[styles.appTopBarPlayGlyphLine, styles.appTopBarPlayGlyphLineMiddle, { backgroundColor: theme.panelAlt }]} />
                  <View style={[styles.appTopBarPlayGlyphLine, styles.appTopBarPlayGlyphLineBottom, { backgroundColor: theme.panelAlt }]} />
                </View>
              </Pressable>
            </View>
          </View>
          {showSearch ? (
            <View style={styles.topSearchRegion}>
              <View style={[styles.topSearchWrap, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}>
                <TextInput
                  value={searchValue}
                  onChangeText={(text) => {
                    setHideSuggestions(false);
                    onSearchChange?.(text);
                  }}
                  placeholder="Search games..."
                  placeholderTextColor={theme.muted}
                  style={[styles.topSearchInput, { color: theme.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={onSearchSubmit}
                />
                {searchValue ? (
                  <Pressable onPress={() => onSearchChange?.("")} style={styles.topSearchClear}>
                    <Text style={[styles.topSearchClearText, { color: theme.muted }]}>x</Text>
                  </Pressable>
                ) : null}
              </View>

              {Array.isArray(suggestions) && suggestions.length && !hideSuggestions ? (
                <View style={[styles.topSuggestMenu, { borderColor: theme.border, backgroundColor: theme.panel }]}>
                  {suggestions.slice(0, 6).map((name) => (
                    <Pressable
                      key={name}
                      style={[styles.topSuggestItem, { borderColor: theme.border }]}
                      onPress={() => {
                        setHideSuggestions(true);
                        onSelectSuggestion?.(name);
                      }}
                    >
                      <Text style={[styles.topSuggestText, { color: theme.text }]} numberOfLines={1}>
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.appContent,
          {
            paddingBottom: insets.bottom + 72,
          },
        ]}
      >
        {children}
      </View>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + 6,
            borderColor: theme.border,
            backgroundColor: theme.panel,
          },
        ]}
      >
        {navItems.map((item) => {
          const active = item.key === currentView;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.bottomBarBtn,
                active && {
                  borderColor: theme.accent,
                  backgroundColor: theme.panelAlt,
                },
              ]}
              onPress={() => navigation.navigate(item.route)}
            >
              <RetroIcon
                name={item.icon}
                size={26}
                color={active ? theme.title : theme.muted}
                accent={theme.accent}
              />
              <Text style={[styles.bottomBarBtnLabel, { color: active ? theme.text : theme.muted }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({ navigation, theme }) {
  const isFocused = useIsFocused();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [editingKey, setEditingKey] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(getConfiguredApiBaseUrl(""));

  const loadCachedGames = async (q) => {
    const cached = await searchCachedGames(q, 200);
    setResults(cached);
  };

  const refreshPendingCount = async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initLocalDb();
        const savedApiBase = await getSetting(API_BASE_URL_SETTING_KEY, "");
        if (!cancelled) {
          setApiBaseUrl(getConfiguredApiBaseUrl(savedApiBase));
          setDbReady(true);
          await refreshPendingCount();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to initialize local database");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dbReady || !isFocused) return undefined;
    let cancelled = false;
    (async () => {
      const savedApiBase = await getSetting(API_BASE_URL_SETTING_KEY, "");
      if (!cancelled) {
        setApiBaseUrl(getConfiguredApiBaseUrl(savedApiBase));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbReady, isFocused]);

  useEffect(() => {
    if (!dbReady) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cached = await searchCachedGames(query, 200);
        if (!cancelled) setResults(cached);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load cached data");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbReady, query]);

  useEffect(() => {
    if (!dbReady) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const net = await NetInfo.fetch();
        const maybeOffline = net.isConnected === false || net.isInternetReachable === false;
        if (maybeOffline) {
          setOfflineMode(true);
          return;
        }

        const response = await fetch(`${apiBaseUrl}${makeGamesSearchPath(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const list = Array.isArray(payload?.results) ? payload.results : [];
        await upsertGamesFromApi(list);
        await loadCachedGames(query);
        setLastSyncAt(new Date().toLocaleTimeString());
        setOfflineMode(false);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setOfflineMode(true);
        setError(err?.message || "Network sync failed, showing cached data");
        try {
          await loadCachedGames(query);
        } catch {
          // keep previous list
        }
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [apiBaseUrl, dbReady, query]);

  const onSyncNow = async () => {
    if (!dbReady || loading) return;
    setLoading(true);
    setError("");
    try {
      const net = await NetInfo.fetch();
      const maybeOffline = net.isConnected === false || net.isInternetReachable === false;
      if (maybeOffline) {
        setOfflineMode(true);
        setError("No internet connection");
        return;
      }

      const syncResult = await pushPendingOps(apiBaseUrl);
      await refreshPendingCount();
      await loadCachedGames(query);
      setLastSyncAt(new Date().toLocaleTimeString());
      setOfflineMode(false);
      if (syncResult.failed > 0) {
        setError(`Synced ${syncResult.pushed}, failed ${syncResult.failed}`);
      }
    } catch (err) {
      setOfflineMode(true);
      setError(err?.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  const beginEditTitle = (item) => {
    setEditingKey(String(item.key || ""));
    setEditingTitle(String(item.metadata?.canonicalTitle || ""));
  };

  const cancelEditTitle = () => {
    setEditingKey("");
    setEditingTitle("");
  };

  const saveTitleEdit = async (item) => {
    if (!editingKey || !editingTitle.trim()) return;
    try {
      await queueTitleEdit({
        gameKey: String(item.key),
        gameName: item.gameName,
        canonicalTitle: editingTitle.trim(),
      });
      await loadCachedGames(query);
      await refreshPendingCount();
      cancelEditTitle();
    } catch (err) {
      setError(err?.message || "Failed to queue local edit");
    }
  };

  const renderItem = ({ item }) => {
    const location = Array.isArray(item.locations) && item.locations[0] ? item.locations[0] : null;
    const subtitle = location
      ? `Disk ${location.diskId}${location.sideLabel || ""}`
      : "No disk location";
    const isEditing = editingKey && String(editingKey) === String(item.key);

    return (
      <View style={[styles.row, { backgroundColor: theme.panel, borderColor: theme.border }]}>
        {!isEditing ? (
          <>
            <Pressable onPress={() => navigation.navigate("GameDetail", { gameKey: item.key, sourceView: "games" })}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>
                {item.gameName || "Untitled"}
              </Text>
            </Pressable>
            <Text numberOfLines={1} style={[styles.rowSub, { color: theme.muted }]}>
              {subtitle}
            </Text>
            <View style={styles.rowActions}>
          <Pressable style={[styles.rowBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]} onPress={() => beginEditTitle(item)}>
                <Text style={[styles.rowBtnText, { color: theme.text }]}>Edit title</Text>
              </Pressable>
              {location?.diskId != null ? (
                <Pressable
                  style={[styles.rowBtnGhost, { borderColor: theme.border }]}
                  onPress={() => navigation.navigate("DiskView", { diskId: location.diskId, focusSingleDisk: true })}
                >
                  <Text style={[styles.rowBtnGhostText, { color: theme.muted }]}>Disk {location.diskId}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <ThemedInput
              theme={theme}
              value={editingTitle}
              onChangeText={setEditingTitle}
              style={styles.rowInput}
              placeholder="Canonical title"
            />
            <View style={styles.rowActions}>
              <ThemedButton theme={theme} label="Save local" onPress={() => saveTitleEdit(item)} icon="edit" />
              <ThemedButton theme={theme} variant="ghost" label="Cancel" onPress={cancelEditTitle} />
            </View>
          </>
        )}
      </View>
    );
  };

  const searchSuggestions = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const list = [];
    (results || []).forEach((item) => {
      const name = String(item?.gameName || "").trim();
      if (!name) return;
      const k = name.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      if (k.includes(q)) list.push(name);
    });
    return list.slice(0, 8);
  }, [query, results]);

  return (
    <AppShell
      theme={theme}
      navigation={navigation}
      currentView="games"
      onPlayPress={() => navigation.navigate("Play", { startToken: Date.now() })}
      showSearch
      searchValue={query}
      onSearchChange={setQuery}
      onSearchSubmit={() => {}}
      suggestions={searchSuggestions}
      onSelectSuggestion={(name) => setQuery(name)}
    >
      <View style={styles.wrap}>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {loading ? "Syncing..." : `Showing ${results.length} games`}
        </Text>
        <Text style={[styles.apiHint, { color: theme.muted }]}>API: {apiBaseUrl}</Text>
        <Text style={[styles.apiHint, { color: theme.muted }]}>Pending changes: {pendingCount}</Text>
        {offlineMode ? <Text style={[styles.offline, { color: "#f8d06f" }]}>Offline mode: showing cached data</Text> : null}
        {lastSyncAt ? <Text style={[styles.syncHint, { color: theme.muted }]}>Last sync: {lastSyncAt}</Text> : null}

        <View style={styles.topActions}>
          <ThemedButton
            theme={theme}
            label={loading ? "Syncing..." : "Sync now"}
            onPress={onSyncNow}
            disabled={loading || !dbReady}
            icon="fetch"
          />
          <ThemedButton theme={theme} variant="ghost" label="Disk View" onPress={() => navigation.navigate("DiskView")} />
          <ThemedButton theme={theme} variant="ghost" label="Settings" onPress={() => navigation.navigate("Settings")} />
        </View>

        {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>Error: {error}</Text> : null}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#5dd7ff" />
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item, idx) => String(item.key || item.gameName || idx)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </AppShell>
  );
}

function DiskViewScreen({ route, navigation, theme }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disks, setDisks] = useState([]);
  const [savingSideKey, setSavingSideKey] = useState("");
  const [editingSideKey, setEditingSideKey] = useState("");
  const [sideDraftTitles, setSideDraftTitles] = useState([]);
  const [sideEditError, setSideEditError] = useState("");
  const [pendingDeleteDiskKey, setPendingDeleteDiskKey] = useState("");
  const [deletingDiskKey, setDeletingDiskKey] = useState("");
  const [editingRatingKey, setEditingRatingKey] = useState("");
  const [ratingDraft, setRatingDraft] = useState(0);
  const [savingRatingKey, setSavingRatingKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(getConfiguredApiBaseUrl(""));
  const [currentDiskIndex, setCurrentDiskIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChallengeTarget, setActiveChallengeTarget] = useState(null);
  const viewport = useWindowDimensions();
  const isNarrow = viewport.width <= 430;
  const focusedDiskId =
    route?.params?.focusSingleDisk && route?.params?.diskId != null ? Number(route.params.diskId) : null;
  const isFocused = useIsFocused();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lastSwipeAtRef = useRef(0);

  const loadDisks = async () => {
    const cached = await getCachedDiskInventory();
    return focusedDiskId == null ? cached : cached.filter((disk) => disk.diskId === focusedDiskId);
  };

  const syncDiskInventory = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/items/disks`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    await replaceDiskInventoryFromApi(Array.isArray(payload) ? payload : []);
    return loadDisks();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        await initLocalDb();
        const savedApiBase = await getSetting(API_BASE_URL_SETTING_KEY, "");
        const nextApiBase = getConfiguredApiBaseUrl(savedApiBase);
        const localActiveStore = await getSetting(
          LOCAL_ACTIVE_STORE_KEY,
          String(BOOTSTRAP_DATA?.defaultStoreKey || "orig")
        );
        let next = await loadDisks();
        if (!next.length) {
          next = await seedBootstrapStoreLocal(localActiveStore);
          next = focusedDiskId == null ? next : next.filter((disk) => disk.diskId === focusedDiskId);
        }
        try {
          next = await syncDiskInventory(nextApiBase);
        } catch {
          // Keep cached data if remote disk sync is unavailable.
        }
        const gamify = sanitizeGamificationState(await getJsonSetting(GAMIFY_STATE_KEY, defaultGamificationState()));
        if (!cancelled) setDisks(next);
        if (!cancelled) setApiBaseUrl(nextApiBase);
        if (!cancelled) setActiveChallengeTarget(gamify?.activeChallenge?.target || null);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load disk inventory");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [focusedDiskId, isFocused]);

  const filteredDisks = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return disks;
    return (Array.isArray(disks) ? disks : []).filter((disk) => {
      const matchSide = (sideList) =>
        Array.isArray(sideList) &&
        sideList.some((entry) => String(entry?.gameName || "").toLowerCase().includes(q));
      return matchSide(disk?.sideA) || matchSide(disk?.sideB) || String(disk?.diskId || "").includes(q);
    });
  }, [disks, searchQuery]);

  const searchSuggestions = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return [];
    const names = [];
    const seen = new Set();
    (Array.isArray(disks) ? disks : []).forEach((disk) => {
      ["sideA", "sideB"].forEach((sideKey) => {
        const list = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];
        list.forEach((entry) => {
          const name = String(entry?.gameName || "").trim();
          const k = name.toLowerCase();
          if (!name || seen.has(k)) return;
          seen.add(k);
          if (k.includes(q)) names.push(name);
        });
      });
    });
    return names.sort((a, b) => a.localeCompare(b));
  }, [disks, searchQuery]);

  useEffect(() => {
    if (!Array.isArray(filteredDisks) || !filteredDisks.length) {
      if (currentDiskIndex !== 0) setCurrentDiskIndex(0);
      return;
    }
    if (currentDiskIndex >= filteredDisks.length) {
      setCurrentDiskIndex(filteredDisks.length - 1);
    }
  }, [filteredDisks, currentDiskIndex]);

  const goPreviousDisk = () => {
    if (!filteredDisks.length) return;
    setCurrentDiskIndex((prev) => (prev <= 0 ? filteredDisks.length - 1 : prev - 1));
  };

  const goNextDisk = () => {
    if (!filteredDisks.length) return;
    setCurrentDiskIndex((prev) => (prev >= filteredDisks.length - 1 ? 0 : prev + 1));
  };

  const stageHeight = useMemo(() => {
    const widthBased = Math.max(300, (viewport.width - 28) * (720 / 1000));
    const heightCap = Math.max(360, viewport.height * 0.76);
    return Math.min(widthBased, heightCap);
  }, [viewport.width, viewport.height]);

  const diskSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          const dx = Number(gestureState?.dx || 0);
          const dy = Number(gestureState?.dy || 0);
          return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const dx = Number(gestureState?.dx || 0);
          const dy = Number(gestureState?.dy || 0);
          const now = Date.now();
          if (now - lastSwipeAtRef.current < 220) return;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 32) {
            lastSwipeAtRef.current = now;
            if (dx > 0) goPreviousDisk();
            else goNextDisk();
          }
        },
      }),
    [filteredDisks.length]
  );

  useEffect(() => {
    if (!activeChallengeTarget) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeChallengeTarget, pulseAnim]);

  const startEditSide = (disk, sideKey) => {
    const list = sideKey === "sideB" ? disk.sideB : disk.sideA;
    setEditingSideKey(`${disk.diskId}:${sideKey}`);
    setSideDraftTitles((list || []).map((entry) => String(entry.gameName || "")));
    setNotice("");
    setError("");
    setSideEditError("");
  };

  const cancelEditSide = () => {
    setEditingSideKey("");
    setSideDraftTitles([]);
    setSideEditError("");
  };

  const updateSideDraftTitleAt = (index, value) => {
    setSideDraftTitles((prev) => prev.map((title, i) => (i === index ? value : title)));
  };

  const removeSideDraftTitleAt = (index) => {
    setSideDraftTitles((prev) => prev.filter((_title, i) => i !== index));
  };

  const saveEditSide = async (disk, sideKey) => {
    const editKey = `${disk.diskId}:${sideKey}`;
    if (savingSideKey || !disk?.datasetKey) return;
    setSavingSideKey(editKey);
    setError("");
    setNotice("");
    setSideEditError("");
    try {
      const titles = (Array.isArray(sideDraftTitles) ? sideDraftTitles : [])
        .map((title) => String(title || "").trim())
        .filter(Boolean);
      if (!titles.length) {
        setSideEditError("Add at least one title.");
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/items/titles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset: disk.datasetKey,
          diskId: disk.diskId,
          side: sideKey,
          titles,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextDisks = await syncDiskInventory(apiBaseUrl);
      setDisks(nextDisks);
      cancelEditSide();
      setNotice(`Saved ${sideKey === "sideB" ? "Side B" : "Side A"} titles for Disk ${disk.diskId}.`);
    } catch (err) {
      setError(err?.message || "Failed to save side titles");
    } finally {
      setSavingSideKey("");
    }
  };

  const normalizeRating = (value) => {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(5, Math.round(raw * 2) / 2));
  };

  const startEditRating = (entry) => {
    setEditingRatingKey(String(entry?.key || ""));
    setRatingDraft(normalizeRating(entry?.rating));
    setError("");
    setNotice("");
  };

  const cancelEditRating = () => {
    setEditingRatingKey("");
    setRatingDraft(0);
    setSavingRatingKey("");
  };

  const saveRating = async (entry) => {
    const gameKey = String(entry?.key || "");
    if (!gameKey) return;
    const nextRating = normalizeRating(ratingDraft);
    setSavingRatingKey(gameKey);
    setError("");
    setNotice("");
    try {
      await updateGameRatingLocal({ gameKey, rating: nextRating });
      setDisks((prev) =>
        (prev || []).map((disk) => ({
          ...disk,
          sideA: (disk.sideA || []).map((game) =>
            String(game?.key || "") === gameKey ? { ...game, rating: nextRating } : game
          ),
          sideB: (disk.sideB || []).map((game) =>
            String(game?.key || "") === gameKey ? { ...game, rating: nextRating } : game
          ),
        }))
      );
      const nextDisks = await loadDisks();
      setDisks(nextDisks);
      setNotice(`Saved rating ${nextRating.toFixed(1)} for ${entry?.gameName || "game"}.`);
      cancelEditRating();
    } catch (err) {
      setError(err?.message || "Failed to save rating");
    } finally {
      setSavingRatingKey("");
    }
  };

  const requestDeleteDisk = (disk) => {
    setPendingDeleteDiskKey(`${disk.diskId}:${disk.datasetKey || ""}`);
    setNotice("");
    setError("");
  };

  const cancelDeleteDisk = () => {
    setPendingDeleteDiskKey("");
    setDeletingDiskKey("");
  };

  const confirmDeleteDisk = async (disk) => {
    if (!disk?.datasetKey) return;
    const deleteKey = `${disk.diskId}:${disk.datasetKey || ""}`;
    setDeletingDiskKey(deleteKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/items/disks/${encodeURIComponent(disk.diskId)}?dataset=${encodeURIComponent(disk.datasetKey)}`,
        { method: "DELETE" }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      await removeDiskLocal({ diskId: disk.diskId, datasetKey: disk.datasetKey });
      const nextDisks = await syncDiskInventory(apiBaseUrl);
      setDisks(nextDisks);
      cancelDeleteDisk();
      setNotice(`Disk ${disk.diskId} deleted.`);
    } catch (err) {
      setError(err?.message || "Failed to delete disk");
    } finally {
      setDeletingDiskKey("");
    }
  };

  const renderSidePanel = (disk, label, list) => {
    const sideKey = label === "B" ? "sideB" : "sideA";
    const editKey = `${disk.diskId}:${sideKey}`;
    const isEditing = editingSideKey === editKey;
    const isSaving = savingSideKey === editKey;
    const sideHasChallenge =
      activeChallengeTarget &&
      Number(activeChallengeTarget?.diskId) === Number(disk?.diskId) &&
      String(activeChallengeTarget?.side || "") === sideKey;

    return (
      <View style={[styles.sideCol, label === "A" && styles.sideColFirst]}>
        <View
          style={[
            styles.sideTitleBadge,
            {
              borderColor: theme.accent,
              backgroundColor: withAlpha(theme.panel, 0.72),
            },
          ]}
        >
          <View
            style={[
              styles.sideTitleBadgeShadow,
              {
                backgroundColor: theme.panelAlt,
                borderColor: theme.accent,
              },
            ]}
          />
          <View style={styles.sideTitleRow}>
            <Animated.Text
              style={[
                styles.sideTitle,
                { color: theme.title },
                sideHasChallenge
                  ? {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.84, 1],
                      }),
                    }
                  : null,
              ]}
            >
              SIDE {label}
            </Animated.Text>
            {!isEditing && disk?.datasetKey ? (
              <Pressable
                style={[styles.sideEditIconBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                onPress={() => startEditSide(disk, sideKey)}
                accessibilityLabel={`Edit Side ${label}`}
              >
                <RetroIcon name="edit" size={24} color={theme.text} accent={theme.accent} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {!isEditing ? (
          <>
            <View style={styles.sideListWrap}>
              <View style={styles.sideListWrapContent}>
                {!list.length ? <Text style={[styles.sideEmpty, { color: theme.muted }]}>No titles</Text> : null}
                {list.map((entry) => {
                  const ratingEditOpen = editingRatingKey === String(entry?.key || "");
                  const ratingSaving = savingRatingKey === String(entry?.key || "");
                  const isChallengeEntry =
                    activeChallengeTarget &&
                    String(activeChallengeTarget?.gameKey || "") === String(entry?.key || "") &&
                    Number(activeChallengeTarget?.diskId) === Number(disk?.diskId) &&
                    String(activeChallengeTarget?.side || "") === sideKey;
                  return (
                    <Animated.View
                      key={`${entry.key}-${entry.slot || "x"}`}
                      style={[
                        styles.sideItemCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: withAlpha(theme.panel, 0.56),
                        },
                        isChallengeEntry
                          ? {
                              transform: [
                                {
                                  scale: pulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.01],
                                  }),
                                },
                              ],
                            }
                          : null,
                      ]}
                    >
                      {isChallengeEntry ? (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.challengeItemGlow,
                            {
                              borderColor: theme.title,
                              opacity: pulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.18, 0.34],
                              }),
                            },
                          ]}
                        />
                      ) : null}
                      <View style={[styles.sideItemRule, { backgroundColor: theme.border }]} />
                      <Pressable onPress={() => navigation.navigate("GameDetail", { gameKey: entry.key, sourceView: "disks" })}>
                        <Text style={[styles.sideItem, { color: theme.text }]}>{entry.gameName || "Untitled"}</Text>
                      </Pressable>
                      {!ratingEditOpen ? (
                      <Pressable onPress={() => startEditRating(entry)} style={styles.ratingTapRow}>
                        <RatingStarsDisplay value={entry?.rating} theme={theme} style={styles.sideRatingStars} />
                      </Pressable>
                      ) : (
                        <View style={styles.ratingEditorWrap}>
                          <View style={styles.ratingPreviewRow}>
                            <RatingStarsDisplay value={ratingDraft} theme={theme} large />
                            <Text style={[styles.ratingValue, { color: theme.title }]}>{ratingDraft.toFixed(1)} / 5</Text>
                          </View>
                          <RatingSlider value={ratingDraft} onChange={setRatingDraft} theme={theme} />
                          <View style={styles.ratingActionsRow}>
                            <Pressable
                              style={[styles.ratingSaveBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                              onPress={() => saveRating(entry)}
                              disabled={ratingSaving}
                            >
                              <Text style={[styles.ratingSaveText, { color: theme.text }]}>
                                {ratingSaving ? "..." : "Save"}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[styles.ratingCancelBtn, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}
                              onPress={cancelEditRating}
                              disabled={ratingSaving}
                            >
                              <Text style={[styles.ratingCancelText, { color: theme.muted }]}>Cancel</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sideEditList}>
              {(Array.isArray(sideDraftTitles) ? sideDraftTitles : []).map((title, index) => (
                <View key={`${editKey}-${index}`} style={styles.sideEditRow}>
                  <ThemedInput
                    theme={theme}
                    value={title}
                    onChangeText={(value) => updateSideDraftTitleAt(index, value)}
                    style={styles.sideEditInlineInput}
                    placeholder={`Game ${index + 1}`}
                  />
                  <Pressable
                    style={[styles.sideEditDeleteBtn, { borderColor: theme.danger, backgroundColor: theme.panelAlt }]}
                    onPress={() => removeSideDraftTitleAt(index)}
                    disabled={isSaving}
                  >
                    <RetroIcon name="deleteIcon" size={16} color={theme.danger} accent={theme.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
            <FieldError message={sideEditError} />
            <View style={styles.rowActions}>
              <ThemedButton
                theme={theme}
                label={isSaving ? "Saving..." : "Save"}
                onPress={() => saveEditSide(disk, sideKey)}
                disabled={isSaving}
                icon="edit"
              />
              <ThemedButton theme={theme} variant="ghost" label="Cancel" onPress={cancelEditSide} disabled={isSaving} />
            </View>
          </>
        )}
      </View>
    );
  };

  const currentDisk =
    Array.isArray(filteredDisks) && filteredDisks.length ? filteredDisks[currentDiskIndex] : null;
  const currentDiskHasChallenge =
    activeChallengeTarget &&
    Number(activeChallengeTarget?.diskId) === Number(currentDisk?.diskId);
  const diskLabelTop = Math.max(8, stageHeight * 0.04 - 6);
  const diskLabelTranslateX = -49;
  const stageTopAnchor = Math.max(8, stageHeight * 0.022);
  const currentDeleteKey = currentDisk
    ? `${currentDisk.diskId}:${currentDisk.datasetKey || ""}`
    : "";
  const canShowDelete = Boolean(currentDisk?.datasetKey);
  const showDeleteConfirm = pendingDeleteDiskKey === currentDeleteKey;

  return (
    <AppShell
      theme={theme}
      navigation={navigation}
      currentView="disks"
      onPlayPress={() => navigation.navigate("Play", { startToken: Date.now() })}
      showSearch
      searchValue={searchQuery}
      onSearchChange={(text) => {
        setSearchQuery(text);
        setCurrentDiskIndex(0);
      }}
      onSearchSubmit={() => {}}
      suggestions={searchSuggestions}
      onSelectSuggestion={(name) => {
        setSearchQuery(name);
        setCurrentDiskIndex(0);
      }}
    >
      <View style={styles.wrap} {...diskSwipeResponder.panHandlers}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#5dd7ff" />
          </View>
        ) : null}
        {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>Error: {error}</Text> : null}
        {notice ? <Text style={[styles.syncHint, { color: theme.muted }]}>{notice}</Text> : null}
        {!loading && !error && !filteredDisks.length ? (
          <Text style={[styles.sideEmpty, { color: theme.muted }]}>
            {disks.length ? "No matching disks for this search." : "No disks found in local cache yet."}
          </Text>
        ) : null}

        {currentDisk ? (
          <ScrollView
            style={styles.diskStageScroll}
            contentContainerStyle={styles.diskStageScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.diskStage,
                {
                  minHeight: stageHeight,
                },
              ]}
            >
              <FloppySvg
                style={[styles.diskSvgBackdrop, { height: stageHeight }]}
                caseColor={theme.panelAlt}
                caseStroke={theme.accent}
                diskColor={theme.id === "amber" ? theme.accent : theme.bg}
                detailColor={theme.border}
                slotColor={theme.border}
              />

              <Animated.View
                style={[
                  styles.diskLabelBadge,
                  {
                    borderColor: theme.accent,
                    backgroundColor: theme.panel,
                    top: diskLabelTop,
                  },
                  currentDiskHasChallenge
                    ? {
                        transform: [
                          { translateX: diskLabelTranslateX },
                          {
                            scale: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.018],
                            }),
                          },
                        ],
                      }
                    : {
                        transform: [{ translateX: diskLabelTranslateX }],
                      },
                ]}
              >
                {currentDiskHasChallenge ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.challengeLabelGlow,
                      {
                        borderColor: theme.title,
                        opacity: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.12, 0.28],
                        }),
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.diskLabelBadgeShadow,
                    {
                      backgroundColor: theme.panelAlt,
                      borderColor: theme.accent,
                    },
                  ]}
                />
                <Text style={[styles.diskLabelText, { color: theme.title }]}>{currentDisk.diskId}</Text>
              </Animated.View>

              <View style={[styles.diskStageTopOverlay, isNarrow && styles.diskStageTopOverlayNarrow, { top: stageTopAnchor }]}>
                <Text style={[styles.diskResultCountText, { color: theme.title }]}>{filteredDisks.length}</Text>
                {canShowDelete ? (
                  showDeleteConfirm ? (
                    <View style={styles.diskDeleteConfirmWrap}>
                      <Pressable
                        style={[styles.diskDeleteConfirmBtn, { borderColor: theme.danger, backgroundColor: theme.danger }]}
                        onPress={() => confirmDeleteDisk(currentDisk)}
                        disabled={deletingDiskKey === currentDeleteKey}
                      >
                        <Text style={[styles.diskDeleteConfirmText, { color: theme.text }]}>
                          {deletingDiskKey === currentDeleteKey ? "..." : "OK"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.diskDeleteConfirmBtn, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}
                        onPress={cancelDeleteDisk}
                      >
                        <Text style={[styles.diskDeleteConfirmText, { color: theme.muted }]}>X</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.diskDeleteBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                      onPress={() => requestDeleteDisk(currentDisk)}
                    >
                      <RetroIcon name="deleteIcon" size={18} color={theme.text} accent={theme.muted} />
                    </Pressable>
                  )
                ) : null}
              </View>

              <View
                style={[
                  styles.diskOverlayContent,
                  {
                    paddingTop: Math.max(44, stageHeight * 0.115),
                  },
                ]}
              >
                <View style={[styles.diskSides, isNarrow && styles.diskSidesNarrow]}>
                  {renderSidePanel(currentDisk, "A", currentDisk.sideA)}
                  {renderSidePanel(currentDisk, "B", currentDisk.sideB)}
                </View>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </AppShell>
  );
}

function GameDetailScreen({ route, navigation, theme }) {
  const PROVIDER_SETTING_KEY = "metadata.lookupProvider";
  const PROVIDER_OPTIONS = [
    { value: "thegamesdb", label: "TheGamesDB" },
    { value: "hybrid", label: "Hybrid" },
  ];
  const gameKey = route?.params?.gameKey ? String(route.params.gameKey) : "";
  const sourceView = route?.params?.sourceView === "disks" ? "disks" : "games";
  const [touchStart, setTouchStart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lookupProvider, setLookupProvider] = useState("thegamesdb");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(getConfiguredApiBaseUrl(""));
  const [draft, setDraft] = useState({
    canonicalTitle: "",
    description: "",
    year: "",
    players: "",
    genre: "",
    publisher: "",
    developer: "",
  });
  const isFocused = useIsFocused();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await initLocalDb();
        const savedApiBase = await getSetting(API_BASE_URL_SETTING_KEY, "");
        const effectiveApiBase = getConfiguredApiBaseUrl(savedApiBase);
        if (!cancelled) setApiBaseUrl(effectiveApiBase);
        const preferredProvider = await getSetting(PROVIDER_SETTING_KEY, "thegamesdb");
        if (!cancelled) {
          const validProvider = PROVIDER_OPTIONS.some((opt) => opt.value === preferredProvider);
          setLookupProvider(validProvider ? preferredProvider : "thegamesdb");
        }
        const detail = await getCachedGameDetail(gameKey);
        if (!detail) throw new Error("Game not found in local cache");
        await ensureGameBoxArtCached(gameKey, effectiveApiBase);
        const detailWithBox = (await getCachedGameDetail(gameKey)) || detail;
        if (cancelled) return;
        setRecord(detailWithBox);
        setDraft({
          canonicalTitle: detailWithBox.metadata?.canonicalTitle || "",
          description: detailWithBox.metadata?.description || "",
          year: detailWithBox.metadata?.year || "",
          players: detailWithBox.metadata?.players || "",
          genre: detailWithBox.metadata?.genre || "",
          publisher: detailWithBox.metadata?.publisher || "",
          developer: detailWithBox.metadata?.developer || "",
        });
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load game detail");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameKey, isFocused]);

  const onSelectProvider = async (value) => {
    const safeValue = PROVIDER_OPTIONS.some((opt) => opt.value === value) ? value : "thegamesdb";
    setLookupProvider(safeValue);
    setProviderMenuOpen(false);
    try {
      await setSetting(PROVIDER_SETTING_KEY, safeValue);
    } catch {
      // Non-blocking: keep UI selection even if persistence fails.
    }
  };

  const onSaveLocal = async () => {
    if (!record || saving) return;
    setSaving(true);
    setError("");
    try {
      await queueMetadataEdit({
        gameKey: record.key,
        gameName: record.gameName,
        metadata: draft,
      });
      const refreshed = await getCachedGameDetail(record.key);
      setRecord(refreshed);
    } catch (err) {
      setError(err?.message || "Failed to save local metadata");
    } finally {
      setSaving(false);
    }
  };

  const onFetchMetadata = async () => {
    if (!record?.gameName || fetching) return;
    setFetching(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/metadata/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: record.gameName,
          provider: lookupProvider,
          persist: true,
          downloadImages: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextMeta = payload?.stored || payload?.result || null;
      if (nextMeta) {
        await upsertSingleGameFromLookup({
          gameName: record.gameName,
          metadata: nextMeta,
        });
      }
      await ensureGameBoxArtCached(record.key, apiBaseUrl);

      const refreshed = await getCachedGameDetail(record.key);
      if (refreshed) {
        setRecord(refreshed);
        setDraft({
          canonicalTitle: refreshed.metadata?.canonicalTitle || "",
          description: refreshed.metadata?.description || "",
          year: refreshed.metadata?.year || "",
          players: refreshed.metadata?.players || "",
          genre: refreshed.metadata?.genre || "",
          publisher: refreshed.metadata?.publisher || "",
          developer: refreshed.metadata?.developer || "",
        });
      }
    } catch (err) {
      setError(err?.message || "Metadata fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const onPanelTouchStart = (e) => {
    const touch = e.nativeEvent?.touches?.[0];
    if (!touch) return;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const onPanelTouchEnd = (e) => {
    if (!touchStart) return;
    const touch = e.nativeEvent?.changedTouches?.[0];
    setTouchStart(null);
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = Math.abs(touch.clientY - touchStart.y);
    if (Math.abs(dx) > 64 && Math.abs(dx) > dy * 1.4) {
      navigation.goBack();
    }
  };

  return (
    <AppShell
      theme={theme}
      navigation={navigation}
      currentView={sourceView}
      onPlayPress={() => navigation.navigate("Play", { startToken: Date.now() })}
    >
      <View style={styles.wrap} onTouchStart={onPanelTouchStart} onTouchEnd={onPanelTouchEnd}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#5dd7ff" />
          </View>
        ) : null}
        {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>Error: {error}</Text> : null}

        {!loading && record ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <View style={[styles.gameMetaHeader, { borderColor: theme.border, backgroundColor: theme.panel }]}>
              <View style={styles.gameMetaAppbar}>
                <Pressable
                  style={[styles.gameMetaIconBtn, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}
                  onPress={() => navigation.goBack()}
                >
                  <RetroIcon name="close" size={22} color={theme.text} accent={theme.muted} />
                </Pressable>

                <Text style={[styles.gameMetaAppbarTitle, { color: theme.title }]}>Game Data</Text>

                <View style={styles.gameMetaAppbarActions}>
                  <Pressable
                    style={[styles.gameMetaIconBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                    onPress={onFetchMetadata}
                    disabled={fetching}
                  >
                    <RetroIcon name="fetch" size={22} color={theme.text} accent={theme.accent} />
                  </Pressable>
                  <Pressable
                    style={[styles.gameMetaIconBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                    onPress={onSaveLocal}
                    disabled={saving}
                  >
                    <RetroIcon name="edit" size={22} color={theme.text} accent={theme.accent} />
                  </Pressable>
                </View>
              </View>

              <Text style={[styles.detailTitle, { color: theme.text }]}>{record.gameName}</Text>
              <Text style={[styles.detailSub, { color: theme.muted }]}>
                {(record.locations || [])
                  .map((loc) => `Disk ${loc.diskId}${loc.sideLabel || ""}`)
                  .join(" | ") || "No disk location"}
              </Text>
            </View>

            {record?.metadata?.images?.boxFront ? (
              <Image
                source={{ uri: resolveImageUri(record.metadata.images.boxFront, apiBaseUrl) }}
                style={[styles.coverImage, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}
                resizeMode="contain"
              />
            ) : null}

            <View style={styles.providerRow}>
              <Text style={[styles.providerInlineLabel, { color: theme.muted }]}>Provider</Text>
              <View style={styles.providerSelectWrap}>
                <Pressable
                  style={[styles.providerSelectBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                  onPress={() => setProviderMenuOpen((v) => !v)}
                >
                  <Text style={[styles.providerSelectText, { color: theme.text }]}>
                    {PROVIDER_OPTIONS.find((opt) => opt.value === lookupProvider)?.label || "TheGamesDB"}
                  </Text>
                  <Text style={[styles.providerSelectArrow, { color: theme.muted }]}>{providerMenuOpen ? "^" : "v"}</Text>
                </Pressable>
                {providerMenuOpen ? (
                  <View style={[styles.providerMenu, { borderColor: theme.accent, backgroundColor: theme.panel }]}>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.providerMenuItem, lookupProvider === opt.value && styles.providerMenuItemActive]}
                        onPress={() => onSelectProvider(opt.value)}
                      >
                        <Text
                          style={[styles.providerMenuItemText, { color: theme.text }, lookupProvider === opt.value && styles.providerMenuItemTextActive]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <Pressable
                style={[styles.providerFetchBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
                onPress={onFetchMetadata}
                disabled={fetching}
              >
                <Text style={[styles.fetchBtnText, { color: theme.text }]}>{fetching ? "..." : "Fetch"}</Text>
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Metadata Title</Text>
            <TextInput
              value={draft.canonicalTitle}
              onChangeText={(v) => setField("canonicalTitle", v)}
              style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
              placeholder="Canonical title"
              placeholderTextColor="#8f9fb8"
            />

            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Description</Text>
            <TextInput
              value={draft.description}
              onChangeText={(v) => setField("description", v)}
              style={[styles.fieldInput, styles.fieldArea, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
              multiline
              textAlignVertical="top"
              placeholder="Description"
              placeholderTextColor="#8f9fb8"
            />

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>Year</Text>
                <TextInput
                  value={draft.year}
                  onChangeText={(v) => setField("year", v)}
                  style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
                  placeholder="Year"
                  placeholderTextColor="#8f9fb8"
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>Players</Text>
                <TextInput
                  value={draft.players}
                  onChangeText={(v) => setField("players", v)}
                  style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
                  placeholder="Players"
                  placeholderTextColor="#8f9fb8"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Genre</Text>
            <TextInput
              value={draft.genre}
              onChangeText={(v) => setField("genre", v)}
              style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
              placeholder="Genre"
              placeholderTextColor="#8f9fb8"
            />
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Publisher</Text>
            <TextInput
              value={draft.publisher}
              onChangeText={(v) => setField("publisher", v)}
              style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
              placeholder="Publisher"
              placeholderTextColor="#8f9fb8"
            />
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Developer</Text>
            <TextInput
              value={draft.developer}
              onChangeText={(v) => setField("developer", v)}
              style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
              placeholder="Developer"
              placeholderTextColor="#8f9fb8"
            />

            <Pressable style={[styles.syncBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]} onPress={onSaveLocal} disabled={saving}>
              <Text style={[styles.syncBtnText, { color: theme.text }]}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </AppShell>
  );
}

function PlayScreen({ route, navigation, theme, apiBaseUrl, authUser, authToken }) {
  const [activeSection, setActiveSection] = useState("player");
  const [state, setState] = useState(defaultGamificationState());
  const [selectedMode, setSelectedMode] = useState("random");
  const [standings, setStandings] = useState([]);
  const [targetMeta, setTargetMeta] = useState(null);
  const [error, setError] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const profileId = String(authUser?.username || authUser?.id || "guest");
  const target = state?.activeChallenge?.target || null;
  const startToken = route?.params?.startToken || 0;

  const persistState = async (nextState) => {
    const safe = sanitizeGamificationState(nextState);
    setState(safe);
    await setJsonSetting(GAMIFY_STATE_KEY, safe);
    if (!authToken) return;
    try {
      await requestJsonWithBase(apiBaseUrl, "/api/player/me/gamification", {
        method: "PUT",
        headers: resolveAuthHeaders(authToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({ state: safe }),
      });
    } catch {
      // keep local state
    }
  };

  const refreshStandings = async (nextState = state) => {
    if (authToken) {
      try {
        const payload = await requestJsonWithBase(apiBaseUrl, "/api/player/standings?limit=20", {
          headers: resolveAuthHeaders(authToken),
        });
        const rows = Array.isArray(payload?.standings) ? payload.standings : [];
        setStandings(rows.map((row) => ({
          profileId: row?.user?.username || row?.userId || "unknown",
          callsign: row?.user?.callsign || row?.user?.username || "UNK",
          displayName: row?.user?.displayName || row?.user?.username || "Unknown User",
          totalPlayed: Number(row?.totalPlayed || 0),
          totalWins: Number(row?.totalWins || 0),
          winRate: Number(row?.winRate || 0),
        })));
        return;
      } catch {
        // local fallback
      }
    }
    setStandings([{
      profileId,
      callsign: String(authUser?.callsign || authUser?.username || "GUEST"),
      displayName: String(authUser?.displayName || authUser?.username || "Guest"),
      totalPlayed: Number(nextState?.stats?.totalPlayed || 0),
      totalWins: Number(nextState?.stats?.totalWins || 0),
      winRate: Number(nextState?.stats?.totalPlayed || 0) > 0
        ? Number(nextState?.stats?.totalWins || 0) / Number(nextState?.stats?.totalPlayed || 1)
        : 0,
    }]);
  };

  const startRun = async (modeInput) => {
    try {
      setError("");
      const mode = PLAY_MODES.some((m) => m.id === modeInput) ? modeInput : "random";
      const disks = await getCachedDiskInventory();
      const candidates = buildChallengeCandidates(disks);
      const recent = Array.isArray(state?.recentSelections) ? state.recentSelections : [];
      const recentSet = new Set(recent.slice(0, 8));
      let pool = candidates.filter((candidate) => !recentSet.has(challengeTargetKey(candidate)));
      if (!pool.length) pool = candidates.slice();
      if (mode === "unplayed") {
        const playedSet = new Set(
          (Array.isArray(state?.playSessions) ? state.playSessions : [])
            .map((session) => challengeTargetKey(session?.target || {}))
            .filter(Boolean)
        );
        const unplayedPool = pool.filter((candidate) => !playedSet.has(challengeTargetKey(candidate)));
        if (unplayedPool.length) pool = unplayedPool;
      }
      if (!pool.length) throw new Error("No games available in local cache.");
      const minutes = Math.max(1, Math.min(120, Number(state?.preferences?.threeInSixtyMinutesPerTarget || 20)));
      let challenge = null;
      let session = null;
      if (mode === "three-in-60") {
        const mutable = pool.slice();
        const targets = [];
        while (targets.length < Math.min(3, mutable.length)) {
          const idx = Math.floor(Math.random() * mutable.length);
          targets.push(mutable.splice(idx, 1)[0]);
        }
        const pick = targets[0];
        challenge = {
          id: `c-${Date.now()}`,
          type: mode,
          target: pick,
          targets,
          totalTargets: targets.length,
          currentIndex: 0,
          completedCount: 0,
          expiresAt: new Date(Date.now() + minutes * 60000).toISOString(),
          status: "active",
        };
        session = {
          id: `s-${Date.now()}`,
          startedAt: new Date().toISOString(),
          endedAt: null,
          result: "played",
          target: pick,
        };
      } else {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        challenge = { id: `c-${Date.now()}`, type: mode, target: pick, status: "active" };
        session = {
          id: `s-${Date.now()}`,
          startedAt: new Date().toISOString(),
          endedAt: null,
          result: "played",
          target: pick,
        };
      }
      const nextState = sanitizeGamificationState({
        ...state,
        activeChallenge: challenge,
        recentSelections: [
          ...((Array.isArray(challenge?.targets) && challenge.targets.length
            ? challenge.targets.map((targetEntry) => challengeTargetKey(targetEntry))
            : [challengeTargetKey(challenge?.target || {})])),
          ...(state?.recentSelections || []),
        ].slice(0, 30),
        playSessions: [session, ...(state?.playSessions || [])].slice(0, 200),
        stats: { ...(state?.stats || {}), totalPlayed: Number(state?.stats?.totalPlayed || 0) + 1 },
      });
      await persistState(nextState);
      setActiveSection("overview");
      await refreshStandings(nextState);
    } catch (err) {
      setError(err?.message || "Failed to start challenge.");
    }
  };

  const completeRun = async (result) => {
    const activeChallenge = state?.activeChallenge || null;
    if (!activeChallenge) return;
    const sessions = Array.isArray(state?.playSessions) ? state.playSessions.slice() : [];
    let winInc = 0;
    if (sessions.length) {
      const first = { ...sessions[0], result, endedAt: new Date().toISOString() };
      if (result === "won" && sessions[0]?.result !== "won") winInc = 1;
      sessions[0] = first;
    }
    let nextChallenge = null;
    let playedInc = 0;
    if (activeChallenge.type === "three-in-60") {
      const targets = Array.isArray(activeChallenge?.targets) ? activeChallenge.targets : [];
      const nextIndex = Number(activeChallenge?.currentIndex || 0) + 1;
      const nextCompleted = Math.min(Number(activeChallenge?.completedCount || 0) + 1, targets.length);
      if (nextIndex < targets.length) {
        const minutes = Math.max(1, Math.min(120, Number(state?.preferences?.threeInSixtyMinutesPerTarget || 20)));
        nextChallenge = {
          ...activeChallenge,
          currentIndex: nextIndex,
          completedCount: nextCompleted,
          target: targets[nextIndex],
          expiresAt: new Date(Date.now() + minutes * 60000).toISOString(),
          status: "active",
        };
        sessions.unshift({
          id: `s-${Date.now()}`,
          startedAt: new Date().toISOString(),
          endedAt: null,
          result: "played",
          target: targets[nextIndex],
        });
        playedInc = 1;
      }
    }
    const nextState = sanitizeGamificationState({
      ...state,
      activeChallenge: nextChallenge,
      playSessions: sessions,
      stats: {
        ...(state?.stats || {}),
        totalWins: Number(state?.stats?.totalWins || 0) + winInc,
        totalPlayed: Number(state?.stats?.totalPlayed || 0) + playedInc,
      },
    });
    await persistState(nextState);
    if (nextChallenge) {
      setActiveSection("overview");
    }
    await refreshStandings(nextState);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let localState = sanitizeGamificationState(await getJsonSetting(GAMIFY_STATE_KEY, defaultGamificationState()));
      if (authToken) {
        try {
          const payload = await requestJsonWithBase(apiBaseUrl, "/api/player/me/gamification", {
            headers: resolveAuthHeaders(authToken),
          });
          if (payload?.state && typeof payload.state === "object") {
            localState = sanitizeGamificationState(payload.state);
            await setJsonSetting(GAMIFY_STATE_KEY, localState);
          }
        } catch {
          // fallback to local state
        }
      }
      if (!cancelled) {
        setState(localState);
        setSelectedMode(String(localState?.preferences?.defaultMode || "random"));
        await refreshStandings(localState);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, authToken, profileId]);

  useEffect(() => {
    if (!startToken) return;
    (async () => {
      const fresh = sanitizeGamificationState(await getJsonSetting(GAMIFY_STATE_KEY, defaultGamificationState()));
      const mode = String(fresh?.preferences?.defaultMode || state?.preferences?.defaultMode || "random");
      startRun(mode);
    })();
  }, [startToken]);

  useEffect(() => {
    if (state?.activeChallenge?.type !== "three-in-60") return undefined;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.activeChallenge?.id, state?.activeChallenge?.type]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target?.gameKey) {
        setTargetMeta(null);
        return;
      }
      const detail = await getCachedGameDetail(String(target.gameKey));
      if (!cancelled) setTargetMeta(detail);
    })();
    return () => {
      cancelled = true;
    };
  }, [target?.gameKey]);

  const remainingMs = Math.max(0, Date.parse(state?.activeChallenge?.expiresAt || "") - nowTs);
  const sec = Math.floor(remainingMs / 1000);
  const timerText = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <AppShell theme={theme} navigation={navigation} currentView="play" hideTopBar>
      <View style={styles.playWrap}>
        <Pressable style={[styles.playCircleBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]} onPress={() => (target ? completeRun("played") : startRun(String(state?.preferences?.defaultMode || "random")))}>
          <Text style={[styles.playCircleBtnText, { color: theme.title }]}>{target ? "Stop" : "Play!"}</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playChipRow}>
          {["player", "overview", "mode", "history", "standings", "ranks", "badges"].map((section) => (
            <Pressable key={section} style={[styles.playChip, activeSection === section && { borderColor: theme.accent }]} onPress={() => setActiveSection(section)}>
              <Text style={[styles.playChipText, { color: activeSection === section ? theme.text : theme.muted }]}>{section === "player" ? "Stats" : section.charAt(0).toUpperCase() + section.slice(1)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>{error}</Text> : null}

        {activeSection === "mode" ? (
          <View style={[styles.settingsCard, { borderColor: theme.border, backgroundColor: theme.panel }]}>
            <View style={styles.playModeRow}>
              {PLAY_MODES.map((mode) => (
                <Pressable key={mode.id} style={[styles.playModeBtn, { borderColor: theme.border }, selectedMode === mode.id && { borderColor: theme.accent, backgroundColor: theme.accent }]} onPress={() => setSelectedMode(mode.id)}>
                  <Text style={[styles.playModeText, { color: selectedMode === mode.id ? theme.panel : theme.text }]}>{mode.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.playModeActions}>
              <ThemedButton theme={theme} label="Set Default" onPress={() => persistState({ ...state, preferences: { ...(state?.preferences || {}), defaultMode: selectedMode } })} />
              <ThemedButton theme={theme} label="Play Selected" variant="ghost" onPress={() => startRun(selectedMode)} />
            </View>
          </View>
        ) : null}

        {activeSection === "overview" ? (
          <ScrollView style={styles.playBodyScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.settingsCard, { borderColor: theme.border, backgroundColor: theme.panel }]}>
              {targetMeta?.metadata?.images?.boxFront ? (
                <Image
                  source={{ uri: resolveImageUri(targetMeta.metadata.images.boxFront, apiBaseUrl) }}
                  style={styles.playCoverImage}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={[styles.settingsCardTitle, { color: theme.text }]}>
                {targetMeta?.metadata?.canonicalTitle || target?.gameName || "No active challenge"}
              </Text>
              {target ? (
                <Text style={[styles.settingsStat, { color: theme.muted }]}>
                  Disk {target.diskId} | {target.side === "sideA" ? "Side A" : "Side B"} |{" "}
                  {PLAY_MODES.find((mode) => mode.id === String(state?.activeChallenge?.type || ""))?.label || "Quick Play"}
                </Text>
              ) : null}
              {state?.activeChallenge?.type === "three-in-60" ? (
                <>
                  <Text style={[styles.settingsStat, { color: theme.muted }]}>
                    Game {Math.min(Number(state?.activeChallenge?.currentIndex || 0) + 1, Number(state?.activeChallenge?.totalTargets || 3))} of {Number(state?.activeChallenge?.totalTargets || 3)}
                  </Text>
                  <Text style={[styles.playTimerText, { color: sec <= 10 ? "#ffba8a" : theme.title }]}>{timerText}</Text>
                </>
              ) : null}
              {target ? (
                <View style={styles.playRunActions}>
                  <ThemedButton theme={theme} label="WIN" onPress={() => completeRun("won")} />
                  <ThemedButton theme={theme} label="LOSE" onPress={() => completeRun("lost")} />
                  <ThemedButton theme={theme} label="SKIP" variant="ghost" onPress={() => completeRun("played")} />
                </View>
              ) : null}
            </View>
            {targetMeta?.metadata?.description ? (
              <View style={[styles.settingsCard, { borderColor: theme.border, backgroundColor: theme.panel }]}>
                <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Description</Text>
                <Text style={[styles.settingsStat, { color: theme.muted }]}>{String(targetMeta.metadata.description)}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {activeSection === "player" ? (
          <View style={[styles.settingsCard, { borderColor: theme.border, backgroundColor: theme.panel }]}>
            <Text style={[styles.settingsStat, { color: theme.muted }]}>Profile: {authUser?.callsign || authUser?.displayName || authUser?.username || "Guest"}</Text>
            <Text style={[styles.settingsStat, { color: theme.muted }]}>Played: {Number(state?.stats?.totalPlayed || 0)}</Text>
            <Text style={[styles.settingsStat, { color: theme.muted }]}>Wins: {Number(state?.stats?.totalWins || 0)}</Text>
          </View>
        ) : null}

        {activeSection === "history" ? (
          <ScrollView style={styles.playBodyScroll} showsVerticalScrollIndicator={false}>
            {(state?.playSessions || []).slice(0, 8).map((session) => (
              <View key={session.id} style={[styles.playListItem, { borderColor: theme.border, backgroundColor: theme.panel }]}>
                <Text style={[styles.playListTitle, { color: theme.text }]}>{session?.target?.gameName || "Unknown Game"}</Text>
                <Text style={[styles.settingsStat, { color: theme.muted }]}>Disk {session?.target?.diskId} | {String(session?.result || "played").toUpperCase()}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {activeSection === "standings" ? (
          <ScrollView style={styles.playBodyScroll} showsVerticalScrollIndicator={false}>
            {standings.map((entry, index) => {
              const badge = pickStandingBadge(entry, index);
              const rankTitle = pickStandingTitle(entry, index);
              const isCurrent = String(entry?.profileId || "") === profileId;
              return (
                <View
                  key={`${entry.profileId}:${index}`}
                  style={[
                    styles.playStandingRow,
                    { borderColor: theme.border, backgroundColor: theme.panel },
                    isCurrent && { borderColor: theme.accent, backgroundColor: theme.panelAlt },
                  ]}
                >
                  <View style={styles.playStandingHeader}>
                    <View style={styles.playStandingBadgeWrap}>
                      <Image source={getBadgeImageSource(badge.tone)} style={styles.playStandingBadgeImage} resizeMode="contain" />
                      <Text style={[styles.playStandingRankOverlay, { color: theme.title }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.playStandingHeadText}>
                      <Text style={[styles.playStandingCallsign, { color: theme.text }]}>
                        {String(entry.callsign || "UNK").toUpperCase()}{isCurrent ? " (YOU)" : ""}
                      </Text>
                      <Text style={[styles.playStandingName, { color: theme.muted }]}>{entry.displayName}</Text>
                    </View>
                  </View>
                  <Text style={[styles.playStandingBadge, { color: theme.accent }]}>{badge.label}</Text>
                  <Text style={[styles.playStandingTitle, { color: theme.text }]}>{rankTitle}</Text>
                  <Text style={[styles.settingsStat, { color: theme.muted }]}>
                    Wins {Number(entry.totalWins || 0)} | Played {Number(entry.totalPlayed || 0)} | Win Rate {Math.round(Number(entry.winRate || 0) * 100)}%
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {activeSection === "ranks" ? (
          <ScrollView style={styles.playBodyScroll} showsVerticalScrollIndicator={false}>
            {RANK_LEGEND.map((rank) => (
              <View key={rank} style={[styles.playLegendRow, { borderColor: theme.border, backgroundColor: theme.panel }]}>
                <Text style={[styles.playLegendText, { color: theme.text }]}>{rank}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {activeSection === "badges" ? (
          <ScrollView style={styles.playBodyScroll} showsVerticalScrollIndicator={false}>
            {BADGE_LEGEND.map((badge) => (
              <View key={badge.label} style={[styles.playLegendRow, { borderColor: theme.border, backgroundColor: theme.panel }]}>
                <View style={styles.playBadgeLegendRow}>
                  <Image source={getBadgeImageSource(badge.tone)} style={styles.playBadgeLegendImage} resizeMode="contain" />
                  <View style={styles.playBadgeLegendTextWrap}>
                    <Text style={[styles.playLegendText, { color: theme.text }]}>{badge.label}</Text>
                    <Text style={[styles.settingsStat, { color: theme.muted }]}>{badge.description}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </AppShell>
  );
}

function ProfileScreen({ navigation, theme, apiBaseUrl, authUser, authToken, onAuthChange }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitAuth = async () => {
    const safeUser = String(username || "").trim();
    const safePass = String(password || "");
    if (!safeUser) return setError("Username is required.");
    if (!safePass) return setError("Password is required.");
    if (mode === "register" && !String(callsign || "").trim()) return setError("Callsign is required.");
    setBusy(true);
    setError("");
    try {
      const payload = await requestJsonWithBase(apiBaseUrl, mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: safeUser,
          password: safePass,
          displayName: String(displayName || "").trim(),
          callsign: String(callsign || "").trim(),
        }),
      });
      const token = String(payload?.token || "");
      const user = payload?.user && typeof payload.user === "object" ? payload.user : null;
      await setSetting(AUTH_TOKEN_KEY, token);
      await setJsonSetting(AUTH_USER_KEY, user || {});
      onAuthChange?.(user, token);
      setUsername("");
      setPassword("");
      setDisplayName("");
      setCallsign("");
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      if (authToken) {
        try {
          await requestJsonWithBase(apiBaseUrl, "/api/auth/logout", {
            method: "POST",
            headers: resolveAuthHeaders(authToken),
          });
        } catch {
          // local logout still proceeds
        }
      }
      await setSetting(AUTH_TOKEN_KEY, "");
      await setJsonSetting(AUTH_USER_KEY, {});
      onAuthChange?.(null, "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      theme={theme}
      navigation={navigation}
      currentView="profile"
      onPlayPress={() => navigation.navigate("Play", { startToken: Date.now() })}
    >
      <View style={styles.wrap}>
        <View style={[styles.profileStage, { borderColor: theme.border, backgroundColor: theme.panel }]}>
          <FloppySvg
            style={styles.profileBackdrop}
            caseColor={theme.panelAlt}
            caseStroke={theme.accent}
            diskColor={theme.bg}
            detailColor={theme.border}
            slotColor={theme.border}
          />
          <View style={[styles.profileCard, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}>
            <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Profile</Text>
            {authUser ? (
              <>
                <Text style={[styles.settingsStat, { color: theme.muted }]}>
                  Signed in as {authUser?.callsign || authUser?.displayName || authUser?.username}
                </Text>
                <Text style={[styles.settingsStat, { color: theme.muted }]}>{authUser?.username}</Text>
                <ThemedButton theme={theme} label={busy ? "Working..." : "Logout"} onPress={logout} />
              </>
            ) : (
              <>
                <View style={styles.profileModeRow}>
                  <Pressable style={[styles.profileModeChip, { borderColor: theme.border }, mode === "login" && { borderColor: theme.accent, backgroundColor: theme.panel }]} onPress={() => setMode("login")}>
                    <Text style={[styles.playChipText, { color: mode === "login" ? theme.text : theme.muted }]}>Login</Text>
                  </Pressable>
                  <Pressable style={[styles.profileModeChip, { borderColor: theme.border }, mode === "register" && { borderColor: theme.accent, backgroundColor: theme.panel }]} onPress={() => setMode("register")}>
                    <Text style={[styles.playChipText, { color: mode === "register" ? theme.text : theme.muted }]}>Join</Text>
                  </Pressable>
                </View>
                <ThemedInput theme={theme} value={username} onChangeText={setUsername} placeholder="Username" />
                {mode === "register" ? <ThemedInput theme={theme} value={displayName} onChangeText={setDisplayName} placeholder="Display name" /> : null}
                {mode === "register" ? <ThemedInput theme={theme} value={callsign} onChangeText={setCallsign} placeholder="Callsign" /> : null}
                <ThemedInput theme={theme} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
                {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>{error}</Text> : null}
                <ThemedButton theme={theme} label={busy ? "Working..." : mode === "register" ? "Create Profile" : "Sign In"} onPress={submitAuth} />
              </>
            )}
          </View>
        </View>
      </View>
    </AppShell>
  );
}

function SettingsScreen({ navigation, theme, onThemeChange, onApiBaseChange, authToken }) {
  const isFocused = useIsFocused();
  const [apiBaseInput, setApiBaseInput] = useState("");
  const [effectiveApiBase, setEffectiveApiBase] = useState(getConfiguredApiBaseUrl(""));
  const [stats, setStats] = useState({ pending: 0, failed: 0, synced: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stores, setStores] = useState([]);
  const [activeStoreKey, setActiveStoreKey] = useState("");
  const [savingActiveStore, setSavingActiveStore] = useState(false);
  const [pendingDeleteStoreKey, setPendingDeleteStoreKey] = useState("");
  const [deletingStoreKey, setDeletingStoreKey] = useState("");
  const [addGamesForm, setAddGamesForm] = useState({
    mode: "existing",
    datasetKey: "",
    newStoreName: "",
    newStoreKey: "",
    diskId: "",
    side: "sideA",
    gamesText: "",
  });
  const [addingGames, setAddingGames] = useState(false);
  const [apiFieldError, setApiFieldError] = useState("");
  const [addGamesErrors, setAddGamesErrors] = useState({});
  const [playConfig, setPlayConfig] = useState({ defaultMode: "random", threeInSixtyMinutesPerTarget: "20" });
  const [savingPlayConfig, setSavingPlayConfig] = useState(false);

  const refreshStats = async () => {
    const nextStats = await getSyncQueueStats();
    setStats(nextStats);
  };

  const loadStores = async (baseUrl) => {
    try {
      const response = await fetch(`${baseUrl}/api/stores`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const nextStores = Array.isArray(payload?.stores) ? payload.stores : [];
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setStores(nextStores);
      setActiveStoreKey(firstActive || "");
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey: prev.datasetKey || firstActive || "",
      }));
    } catch {
      const localActive = await getSetting(
        LOCAL_ACTIVE_STORE_KEY,
        String(BOOTSTRAP_DATA?.defaultStoreKey || "orig")
      );
      const nextStores = getBootstrapStores().map((store) => ({
        id: store.id,
        name: store.name,
        type: store.type || "builtin",
        source: "bundled",
        active: String(store.id) === String(localActive),
        available: true,
        diskCount: Number(store.diskCount || (Array.isArray(store.data) ? store.data.length : 0)),
      }));
      const firstActive = nextStores.find((store) => store.active)?.id || nextStores[0]?.id || "";
      setStores(nextStores);
      setActiveStoreKey(firstActive);
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey: prev.datasetKey || firstActive || "",
      }));
    }
  };

  useEffect(() => {
    if (!isFocused) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        await initLocalDb();
        const stored = await getSetting(API_BASE_URL_SETTING_KEY, "");
        if (!cancelled) {
          setApiBaseInput(String(stored || ""));
          setEffectiveApiBase(getConfiguredApiBaseUrl(stored));
        }
        const gamify = sanitizeGamificationState(await getJsonSetting(GAMIFY_STATE_KEY, defaultGamificationState()));
        if (!cancelled) {
          setPlayConfig({
            defaultMode: String(gamify?.preferences?.defaultMode || "random"),
            threeInSixtyMinutesPerTarget: String(gamify?.preferences?.threeInSixtyMinutesPerTarget || 20),
          });
        }
        await loadStores(getConfiguredApiBaseUrl(stored));
        const nextStats = await getSyncQueueStats();
        if (!cancelled) {
          setStats(nextStats);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const onSaveApiBase = async () => {
    setError("");
    setNotice("");
    setApiFieldError("");
    if (!isValidApiBaseUrl(apiBaseInput)) {
      setApiFieldError("Enter a valid http(s) URL or leave blank.");
      return;
    }
    try {
      await setSetting(API_BASE_URL_SETTING_KEY, apiBaseInput.trim());
      const stored = await getSetting(API_BASE_URL_SETTING_KEY, "");
      const nextBase = getConfiguredApiBaseUrl(stored);
      setEffectiveApiBase(nextBase);
      onApiBaseChange?.(nextBase);
      await loadStores(nextBase);
      setNotice("API URL saved");
    } catch (err) {
      setError(err?.message || "Failed to save API URL");
    }
  };

  const savePlayConfig = async () => {
    if (savingPlayConfig) return;
    setSavingPlayConfig(true);
    setError("");
    setNotice("");
    try {
      const current = sanitizeGamificationState(await getJsonSetting(GAMIFY_STATE_KEY, defaultGamificationState()));
      const nextMode = PLAY_MODES.some((mode) => mode.id === playConfig.defaultMode) ? playConfig.defaultMode : "random";
      const minutes = Math.max(1, Math.min(120, Number(playConfig.threeInSixtyMinutesPerTarget || 20) || 20));
      const nextState = sanitizeGamificationState({
        ...current,
        preferences: {
          ...(current.preferences || {}),
          defaultMode: nextMode,
          threeInSixtyMinutesPerTarget: minutes,
        },
      });
      await setJsonSetting(GAMIFY_STATE_KEY, nextState);
      if (authToken) {
        try {
          await requestJsonWithBase(effectiveApiBase, "/api/player/me/gamification", {
            method: "PUT",
            headers: resolveAuthHeaders(authToken, { "Content-Type": "application/json" }),
            body: JSON.stringify({ state: nextState }),
          });
        } catch {
          // Keep local settings if remote sync fails.
        }
      }
      setPlayConfig({
        defaultMode: nextMode,
        threeInSixtyMinutesPerTarget: String(minutes),
      });
      setNotice("Play mode defaults saved.");
    } catch (err) {
      setError(err?.message || "Failed to save play config");
    } finally {
      setSavingPlayConfig(false);
    }
  };

  const onResetApiBase = async () => {
    setError("");
    setNotice("");
    try {
      await setSetting(API_BASE_URL_SETTING_KEY, "");
      setApiBaseInput("");
      const nextBase = getConfiguredApiBaseUrl("");
      setEffectiveApiBase(nextBase);
      onApiBaseChange?.(nextBase);
      await loadStores(nextBase);
      setNotice("Using default API URL");
    } catch (err) {
      setError(err?.message || "Failed to reset API URL");
    }
  };

  const onRetrySync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const result = await pushPendingOps(effectiveApiBase);
      await refreshStats();
      setNotice(`Synced ${result.pushed}, failed ${result.failed}`);
    } catch (err) {
      setError(err?.message || "Retry sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveActiveStore = async () => {
    if (!activeStoreKey || savingActiveStore) return;
    setSavingActiveStore(true);
    setError("");
    setNotice("");
    try {
      await setSetting(LOCAL_ACTIVE_STORE_KEY, activeStoreKey);
      await seedBootstrapStoreLocal(activeStoreKey);
      try {
        const response = await fetch(`${effectiveApiBase}/api/stores/active`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: [activeStoreKey] }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        const nextStores = Array.isArray(payload?.stores) ? payload.stores : stores;
        const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
        setStores(nextStores);
        setActiveStoreKey(firstActive || activeStoreKey);
        setNotice("Active store saved.");
      } catch {
        await loadStores(effectiveApiBase);
        setNotice("Active store saved locally.");
      }
    } catch (err) {
      setError(err?.message || "Failed to save active store");
    } finally {
      setSavingActiveStore(false);
    }
  };

  const beginDeleteStore = (storeId) => {
    setPendingDeleteStoreKey(storeId);
    setError("");
    setNotice("");
  };

  const cancelDeleteStore = () => {
    setPendingDeleteStoreKey("");
  };

  const confirmDeleteStore = async (storeId) => {
    if (!storeId || deletingStoreKey) return;
    setDeletingStoreKey(storeId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${effectiveApiBase}/api/stores/${encodeURIComponent(storeId)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const nextStores = Array.isArray(payload?.stores) ? payload.stores : [];
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setStores(nextStores);
      setActiveStoreKey(firstActive || "");
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey: prev.datasetKey === storeId ? firstActive || "" : prev.datasetKey,
      }));
      setPendingDeleteStoreKey("");
      setNotice("Store deleted.");
    } catch (err) {
      setError(err?.message || "Failed to delete store");
    } finally {
      setDeletingStoreKey("");
    }
  };

  const addGamesToStore = async () => {
    if (addingGames) return;
    const validation = validateAddGamesForm(addGamesForm);
    setAddGamesErrors(validation.errors || {});
    if (!validation.valid) return;
    setAddingGames(true);
    setError("");
    setNotice("");
    try {
      const payloadBody =
        addGamesForm.mode === "new"
          ? {
              createStore: true,
              storeName: addGamesForm.newStoreName,
              storeKey: addGamesForm.newStoreKey,
              diskId: addGamesForm.diskId,
              side: addGamesForm.side,
              games: addGamesForm.gamesText,
              activateNewStore: true,
            }
          : {
              datasetKey: addGamesForm.datasetKey,
              diskId: addGamesForm.diskId,
              side: addGamesForm.side,
              games: addGamesForm.gamesText,
            };

      const response = await fetch(`${effectiveApiBase}/api/stores/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextStores = Array.isArray(payload?.stores) ? payload.stores : stores;
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : activeStoreKey;
      setStores(nextStores);
      setActiveStoreKey(firstActive || activeStoreKey);
      setAddGamesForm((prev) => ({
        ...prev,
        mode: payload?.createdStore ? "existing" : prev.mode,
        datasetKey: payload?.result?.dataset || firstActive || prev.datasetKey,
        newStoreName: payload?.createdStore ? "" : prev.newStoreName,
        newStoreKey: payload?.createdStore ? "" : prev.newStoreKey,
        gamesText: "",
      }));
      const addedCount = Number(payload?.result?.addedGames || 0);
      setNotice(`Added ${addedCount} game${addedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err?.message || "Failed to add games");
    } finally {
      setAddingGames(false);
    }
  };

  const setThemeAndSave = async (themeKey) => {
    const nextTheme = getThemeByKey(themeKey).id;
    onThemeChange?.(nextTheme);
    try {
      await setSetting(THEME_KEY_SETTING, nextTheme);
    } catch {
      // UI already updated.
    }
  };

  return (
    <AppShell
      theme={theme}
      navigation={navigation}
      currentView="config"
      onPlayPress={() => navigation.navigate("Play", { startToken: Date.now() })}
    >
      <View style={styles.wrap}>
        <View style={styles.diskHeader}>
          <Text style={[styles.title, { color: theme.title }]}>Settings</Text>
          <Pressable style={[styles.syncBtnGhost, { borderColor: theme.border }]} onPress={() => navigation.goBack()}>
            <Text style={[styles.syncBtnGhostText, { color: theme.muted }]}>Back</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#5dd7ff" />
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>Theme</Text>
        <View style={styles.providerSelectWrap}>
          <View style={[styles.providerMenu, { borderColor: theme.accent, backgroundColor: theme.panel }]}>
            {Object.values(THEMES).map((entry) => (
              <Pressable
                key={entry.id}
                style={[styles.providerMenuItem, theme.id === entry.id && styles.providerMenuItemActive]}
                onPress={() => setThemeAndSave(entry.id)}
              >
                <Text
                  style={[styles.providerMenuItemText, theme.id === entry.id && styles.providerMenuItemTextActive]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Gamification</Text>
          <Text style={[styles.fieldLabel, { color: theme.muted }]}>Default Mode</Text>
          <View style={styles.playModeRow}>
            {PLAY_MODES.map((mode) => (
              <Pressable
                key={mode.id}
                style={[
                  styles.playModeBtn,
                  { borderColor: theme.border, backgroundColor: theme.panelAlt },
                  playConfig.defaultMode === mode.id && { borderColor: theme.accent, backgroundColor: theme.accent },
                ]}
                onPress={() => setPlayConfig((prev) => ({ ...prev, defaultMode: mode.id }))}
              >
                <Text style={[styles.playModeText, { color: playConfig.defaultMode === mode.id ? theme.panel : theme.text }]}>
                  {mode.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: theme.muted }]}>3 in 60 minutes per game</Text>
          <TextInput
            value={playConfig.threeInSixtyMinutesPerTarget}
            onChangeText={(v) => setPlayConfig((prev) => ({ ...prev, threeInSixtyMinutesPerTarget: v.replace(/[^\d]/g, "") }))}
            style={[styles.fieldInput, { borderColor: theme.accent, backgroundColor: theme.panelAlt, color: theme.text }]}
            keyboardType="number-pad"
            placeholder="20"
            placeholderTextColor="#8f9fb8"
          />
          <Pressable style={[styles.syncBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]} onPress={savePlayConfig}>
            <Text style={[styles.syncBtnText, { color: theme.text }]}>{savingPlayConfig ? "Saving..." : "Save Play Config"}</Text>
          </Pressable>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>API Base URL override</Text>
        <TextInput
          value={apiBaseInput}
          onChangeText={(v) => {
            setApiBaseInput(v);
            setApiFieldError("");
          }}
          style={[styles.fieldInput, { borderColor: theme.accent, backgroundColor: theme.panelAlt, color: theme.text }]}
          placeholder="http://192.168.x.x:5000"
          placeholderTextColor="#8f9fb8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FieldError message={apiFieldError} />
        <Text style={[styles.apiHint, { color: theme.muted }]}>Effective API: {effectiveApiBase}</Text>

        <View style={styles.rowActions}>
          <Pressable
            style={[styles.rowBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
            onPress={onSaveApiBase}
            disabled={!isValidApiBaseUrl(apiBaseInput)}
          >
            <Text style={[styles.rowBtnText, { color: theme.text }]}>Save API URL</Text>
          </Pressable>
          <Pressable style={[styles.rowBtnGhost, { borderColor: theme.border }]} onPress={onResetApiBase}>
            <Text style={[styles.rowBtnGhostText, { color: theme.muted }]}>Use default</Text>
          </Pressable>
        </View>

        <ThemedCard theme={theme} style={styles.settingsCard}>
          <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Sync Queue</Text>
          <Text style={[styles.settingsStat, { color: theme.muted }]}>Pending: {stats.pending}</Text>
          <Text style={[styles.settingsStat, { color: theme.muted }]}>Failed: {stats.failed}</Text>
          <Text style={[styles.settingsStat, { color: theme.muted }]}>Synced: {stats.synced}</Text>
          <Text style={[styles.settingsStat, { color: theme.muted }]}>Total: {stats.total}</Text>
          <Pressable style={[styles.syncBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]} onPress={onRetrySync} disabled={syncing}>
            <Text style={[styles.syncBtnText, { color: theme.text }]}>{syncing ? "Syncing..." : "Retry Sync"}</Text>
          </Pressable>
        </ThemedCard>

        <View style={[styles.settingsCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Data Stores</Text>
          {(stores || []).map((store) => (
            <View key={store.id} style={styles.storeRow}>
              <Pressable
                style={styles.storeChoice}
                onPress={() => setActiveStoreKey(store.id)}
                disabled={!store.available}
              >
                <Text style={[styles.storeRadio, { color: activeStoreKey === store.id ? theme.text : theme.muted }]}>
                  {activeStoreKey === store.id ? "[x]" : "[ ]"}
                </Text>
                <View style={styles.storeMeta}>
                  <Text style={[styles.storeName, { color: theme.text }]}>{store.name}</Text>
                  <Text style={[styles.storeInfo, { color: theme.muted }]}>
                    {(store.type === "builtin" ? "Built-in" : "Custom")} | {Number(store.diskCount || 0)} disks
                  </Text>
                </View>
              </Pressable>
              {store.type !== "builtin" ? (
                pendingDeleteStoreKey === store.id ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      style={[styles.rowBtn, styles.deleteBtn, { borderColor: theme.danger, backgroundColor: theme.danger }]}
                      onPress={() => confirmDeleteStore(store.id)}
                      disabled={deletingStoreKey === store.id}
                    >
                      <Text style={[styles.rowBtnText, { color: theme.text }]}>{deletingStoreKey === store.id ? "Deleting..." : "Confirm"}</Text>
                    </Pressable>
                    <Pressable style={[styles.rowBtnGhost, { borderColor: theme.border }]} onPress={cancelDeleteStore}>
                      <Text style={[styles.rowBtnGhostText, { color: theme.muted }]}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.rowBtn, styles.deleteBtn, { borderColor: theme.danger, backgroundColor: theme.danger }]}
                    onPress={() => beginDeleteStore(store.id)}
                  >
                    <Text style={[styles.rowBtnText, { color: theme.text }]}>Delete</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          ))}
          <Pressable
            style={[styles.syncBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
            onPress={saveActiveStore}
            disabled={savingActiveStore || !activeStoreKey}
          >
            <Text style={[styles.syncBtnText, { color: theme.text }]}>{savingActiveStore ? "Saving..." : "Save Active Store"}</Text>
          </Pressable>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <Text style={[styles.settingsCardTitle, { color: theme.text }]}>Add Games to Store</Text>
          <View style={styles.rowActions}>
            <Pressable
              style={[
                styles.rowBtn,
                { borderColor: theme.accent, backgroundColor: theme.panelAlt },
                addGamesForm.mode === "existing" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAddGamesForm((prev) => ({ ...prev, mode: "existing" }))}
            >
              <Text style={[styles.rowBtnText, { color: theme.text }]}>Existing</Text>
            </Pressable>
            <Pressable
              style={[
                styles.rowBtn,
                { borderColor: theme.accent, backgroundColor: theme.panelAlt },
                addGamesForm.mode === "new" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAddGamesForm((prev) => ({ ...prev, mode: "new" }))}
            >
              <Text style={[styles.rowBtnText, { color: theme.text }]}>New Store</Text>
            </Pressable>
          </View>

          {addGamesForm.mode === "existing" ? (
            <>
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Target Store Key</Text>
              <TextInput
                value={addGamesForm.datasetKey}
                onChangeText={(v) => {
                  setAddGamesForm((prev) => ({ ...prev, datasetKey: v }));
                  setAddGamesErrors((prev) => ({ ...prev, datasetKey: "" }));
                }}
                style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
                placeholder="dataset key"
                placeholderTextColor="#8f9fb8"
              />
              <FieldError message={addGamesErrors.datasetKey} />
            </>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>New Store Name</Text>
              <TextInput
                value={addGamesForm.newStoreName}
                onChangeText={(v) => {
                  setAddGamesForm((prev) => ({ ...prev, newStoreName: v }));
                  setAddGamesErrors((prev) => ({ ...prev, newStoreName: "" }));
                }}
                style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
                placeholder="My New Store"
                placeholderTextColor="#8f9fb8"
              />
              <FieldError message={addGamesErrors.newStoreName} />
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>New Store Key (optional)</Text>
              <TextInput
                value={addGamesForm.newStoreKey}
                onChangeText={(v) => setAddGamesForm((prev) => ({ ...prev, newStoreKey: v }))}
                style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
                placeholder="my-store"
                placeholderTextColor="#8f9fb8"
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { color: theme.muted }]}>Disk ID</Text>
          <TextInput
            value={addGamesForm.diskId}
            onChangeText={(v) => {
              setAddGamesForm((prev) => ({ ...prev, diskId: v }));
              setAddGamesErrors((prev) => ({ ...prev, diskId: "" }));
            }}
            style={[styles.fieldInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
            placeholder="1"
            placeholderTextColor="#8f9fb8"
          />
          <FieldError message={addGamesErrors.diskId} />
          <Text style={[styles.fieldLabel, { color: theme.muted }]}>Side</Text>
          <View style={styles.rowActions}>
            <Pressable
              style={[
                styles.rowBtn,
                { borderColor: theme.accent, backgroundColor: theme.panelAlt },
                addGamesForm.side === "sideA" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAddGamesForm((prev) => ({ ...prev, side: "sideA" }))}
            >
              <Text style={[styles.rowBtnText, { color: theme.text }]}>Side A</Text>
            </Pressable>
            <Pressable
              style={[
                styles.rowBtn,
                { borderColor: theme.accent, backgroundColor: theme.panelAlt },
                addGamesForm.side === "sideB" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAddGamesForm((prev) => ({ ...prev, side: "sideB" }))}
            >
              <Text style={[styles.rowBtnText, { color: theme.text }]}>Side B</Text>
            </Pressable>
          </View>
          <FieldError message={addGamesErrors.side} />
          <Text style={[styles.fieldLabel, { color: theme.muted }]}>Games (one per line)</Text>
          <TextInput
            value={addGamesForm.gamesText}
            onChangeText={(v) => {
              setAddGamesForm((prev) => ({ ...prev, gamesText: v }));
              setAddGamesErrors((prev) => ({ ...prev, gamesText: "" }));
            }}
            style={[styles.fieldInput, styles.sideEditInput, { borderColor: theme.accent, color: theme.text, backgroundColor: theme.panelAlt }]}
            multiline
            textAlignVertical="top"
            placeholder={"Pitstop II\nImpossible Mission\nSummer Games"}
            placeholderTextColor="#8f9fb8"
          />
          <FieldError message={addGamesErrors.gamesText} />
          <Pressable
            style={[styles.syncBtn, { borderColor: theme.accent, backgroundColor: theme.panelAlt }]}
            onPress={addGamesToStore}
            disabled={addingGames || !validateAddGamesForm(addGamesForm).valid}
          >
            <Text style={[styles.syncBtnText, { color: theme.text }]}>{addingGames ? "Saving..." : "Add Games"}</Text>
          </Pressable>
        </View>

        {notice ? <Text style={[styles.syncHint, { color: theme.muted }]}>{notice}</Text> : null}
        {error ? <Text style={[styles.error, { color: "#ff9c9c" }]}>Error: {error}</Text> : null}
      </View>
    </AppShell>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    commodore: require("./assets/fonts/C64_Pro-STYLE.ttf"),
  });
  const [themeKey, setThemeKey] = useState("c64dark");
  const [themeReady, setThemeReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(getConfiguredApiBaseUrl(""));
  const theme = getThemeByKey(themeKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initLocalDb();
        const storedTheme = await getSetting(THEME_KEY_SETTING, "c64dark");
        const storedApiBase = await getSetting(API_BASE_URL_SETTING_KEY, "");
        const storedToken = await getSetting(AUTH_TOKEN_KEY, "");
        const storedUser = await getJsonSetting(AUTH_USER_KEY, {});
        if (!cancelled) setThemeKey(getThemeByKey(storedTheme).id);
        if (!cancelled) setApiBaseUrl(getConfiguredApiBaseUrl(storedApiBase));
        if (!cancelled) setAuthToken(String(storedToken || ""));
        if (!cancelled) {
          const safeUser = storedUser && typeof storedUser === "object" && Object.keys(storedUser).length
            ? storedUser
            : null;
          setAuthUser(safeUser);
        }
      } catch {
        if (!cancelled) setThemeKey("c64dark");
      } finally {
        if (!cancelled) setThemeReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authToken) return;
      try {
        const payload = await requestJsonWithBase(apiBaseUrl, "/api/auth/me", {
          headers: resolveAuthHeaders(authToken),
        });
        const user = payload?.user && typeof payload.user === "object" ? payload.user : null;
        if (!cancelled && user) {
          setAuthUser(user);
          await setJsonSetting(AUTH_USER_KEY, user);
        }
      } catch {
        if (!cancelled) {
          setAuthToken("");
          setAuthUser(null);
          await setSetting(AUTH_TOKEN_KEY, "");
          await setJsonSetting(AUTH_USER_KEY, {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, authToken]);

  if (!themeReady || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <View style={[styles.wrap, { justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator size="small" color="#5dd7ff" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="DiskView"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="Home">
            {(props) => <HomeScreen {...props} theme={theme} />}
          </Stack.Screen>
          <Stack.Screen name="DiskView">
            {(props) => <DiskViewScreen {...props} theme={theme} />}
          </Stack.Screen>
          <Stack.Screen
            name="GameDetail"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
            }}
          >
            {(props) => <GameDetailScreen {...props} theme={theme} />}
          </Stack.Screen>
          <Stack.Screen name="Settings">
            {(props) => (
              <SettingsScreen
                {...props}
                theme={theme}
                onThemeChange={setThemeKey}
                onApiBaseChange={setApiBaseUrl}
                authToken={authToken}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Play">
            {(props) => (
              <PlayScreen
                {...props}
                theme={theme}
                apiBaseUrl={apiBaseUrl}
                authUser={authUser}
                authToken={authToken}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Profile">
            {(props) => (
              <ProfileScreen
                {...props}
                theme={theme}
                apiBaseUrl={apiBaseUrl}
                authUser={authUser}
                authToken={authToken}
                onAuthChange={(nextUser, nextToken) => {
                  setAuthUser(nextUser || null);
                  setAuthToken(String(nextToken || ""));
                }}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  appTopBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 2,
    paddingBottom: 8,
    minHeight: 56,
  },
  appTopBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appTopBarBrandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: -6,
  },
  appTopBarBrandIcon: {
    width: 34,
    height: 34,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
  },
  appTopBarBrandTextWrap: {
    justifyContent: "center",
    marginLeft: -4,
    minWidth: 122,
  },
  appTopBarBrandTextStack: {
    position: "relative",
    minHeight: 24,
  },
  appTopBarBrand: {
    fontSize: 14,
    letterSpacing: 0,
    fontFamily: RETRO_FONT,
    transform: [{ translateY: 3 }],
    flexShrink: 0,
  },
  appTopBarBrandLines: {
    marginTop: -3,
    gap: 3,
  },
  appTopBarBrandLine: {
    height: 3,
    borderRadius: 1,
    width: "100%",
  },
  appTopBarPlayBtn: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  appTopBarPlayWrap: {
    position: "relative",
    width: 96,
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "visible",
  },
  appTopBarPlayPulse: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  appTopBarPlayLabel: {
    position: "absolute",
    right: 46,
    top: "50%",
    marginTop: -6,
    fontSize: 10,
    fontFamily: RETRO_FONT,
    lineHeight: 12,
  },
  appTopBarPlayGlyph: {
    position: "relative",
    width: 18,
    height: 16,
    opacity: 0.9,
  },
  appTopBarPlayGlyphLine: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 2,
    borderRadius: 2,
    top: 2,
  },
  appTopBarPlayGlyphLineMiddle: {
    top: 7,
  },
  appTopBarPlayGlyphLineBottom: {
    top: 12,
  },
  appContent: {
    flex: 1,
  },
  topSearchRegion: {
    position: "relative",
    marginTop: 6,
  },
  topSearchWrap: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  topSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 5,
    fontFamily: RETRO_FONT,
  },
  topSearchClear: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topSearchClearText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: RETRO_FONT,
  },
  topSuggestMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 40,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 40,
  },
  topSuggestItem: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topSuggestText: {
    fontSize: 13,
    fontFamily: RETRO_FONT,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bottomBarBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 2,
  },
  bottomBarBtnLabel: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: RETRO_FONT,
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  playWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  playCircleBtn: {
    alignSelf: "center",
    minWidth: 110,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  playCircleBtnText: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  playChip: {
    borderWidth: 1,
    borderColor: "#31516e",
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  playChipText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playModeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  playModeBtn: {
    borderWidth: 1,
    borderRadius: 9,
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playModeText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playModeActions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playBodyScroll: {
    flex: 1,
  },
  playCoverImage: {
    width: "100%",
    height: 200,
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 10,
    backgroundColor: "#0a1524",
    marginBottom: 8,
  },
  playTimerText: {
    marginTop: 6,
    fontSize: 42,
    fontWeight: "900",
    fontFamily: RETRO_FONT,
    letterSpacing: 2,
  },
  playRunActions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playListItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  playListTitle: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playStandingRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  playStandingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playStandingBadgeWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  playStandingBadgeImage: {
    width: 56,
    height: 56,
  },
  playStandingRankOverlay: {
    position: "absolute",
    top: 0,
    left: 3,
    fontSize: 15,
    fontWeight: "900",
    fontFamily: RETRO_FONT,
  },
  playStandingHeadText: {
    flex: 1,
  },
  playStandingRank: {
    fontSize: 18,
    fontWeight: "900",
    fontFamily: RETRO_FONT,
  },
  playStandingCallsign: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: RETRO_FONT,
  },
  playStandingName: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: RETRO_FONT,
  },
  playStandingBadge: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: RETRO_FONT,
  },
  playStandingTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playLegendRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  playLegendText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  playBadgeLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playBadgeLegendImage: {
    width: 54,
    height: 54,
  },
  playBadgeLegendTextWrap: {
    flex: 1,
  },
  profileStage: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  profileBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.86,
  },
  profileCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  profileSession: {
    gap: 6,
  },
  profileModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileModeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#c8f8ff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    fontFamily: RETRO_FONT,
  },
  input: {
    borderWidth: 1,
    borderColor: "#0fb8ef",
    borderRadius: 10,
    color: "#e8f6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#08101b",
  },
  meta: {
    marginTop: 8,
    color: "#b7d8ea",
    fontSize: 12,
  },
  apiHint: {
    marginTop: 4,
    color: "#7ea5be",
    fontSize: 9,
  },
  error: {
    marginTop: 8,
    color: "#ff9c9c",
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
  offline: {
    marginTop: 6,
    color: "#f8d06f",
    fontSize: 12,
    fontWeight: "600",
  },
  syncHint: {
    marginTop: 4,
    color: "#8db9a1",
    fontSize: 9,
    fontFamily: RETRO_FONT,
  },
  topActions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  loader: {
    marginTop: 10,
    marginBottom: 2,
  },
  syncBtn: {
    backgroundColor: "#123452",
    borderWidth: 1,
    borderColor: "#2d729f",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  syncBtnText: {
    color: "#d8f2ff",
    fontWeight: "700",
    fontSize: 13,
  },
  syncBtnGhost: {
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#37556f",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  syncBtnGhostText: {
    color: "#9ec0d8",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  diskCounterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  diskCounterText: {
    minWidth: 78,
    textAlign: "center",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: RETRO_FONT,
  },
  diskNavBtn: {
    minWidth: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  diskNavBtnText: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  diskStageScroll: {
    flex: 1,
  },
  diskStageScrollContent: {
    paddingBottom: 16,
    alignItems: "center",
  },
  row: {
    backgroundColor: "#0f1b2b",
    borderWidth: 1,
    borderColor: "#214666",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowTitle: {
    color: "#e8f7ff",
    fontSize: 15,
    fontWeight: "700",
  },
  rowSub: {
    marginTop: 4,
    color: "#8fb2c9",
    fontSize: 12,
  },
  rowActions: {
    marginTop: 8,
    flexDirection: "row",
  },
  sideEditList: {
    gap: 8,
  },
  sideEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sideEditInlineInput: {
    flex: 1,
    minHeight: 44,
  },
  sideEditDeleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#17334e",
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  rowBtnText: {
    color: "#d4eeff",
    fontSize: 12,
    fontWeight: "700",
  },
  rowBtnActive: {
    borderColor: "#5aa8d8",
    backgroundColor: "#1f4569",
  },
  rowInput: {
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 8,
    color: "#e8f6ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#0a1524",
  },
  rowBtnGhost: {
    marginLeft: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#37556f",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  rowBtnGhostText: {
    color: "#9ec0d8",
    fontSize: 12,
    fontWeight: "700",
  },
  sep: {
    height: 8,
  },
  diskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  diskCard: {
    backgroundColor: "#0f1b2b",
    borderWidth: 1,
    borderColor: "#214666",
    borderRadius: 12,
    padding: 10,
  },
  diskStage: {
    borderWidth: 0,
    borderRadius: 0,
    overflow: "visible",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    position: "relative",
    width: "100%",
    alignSelf: "center",
  },
  diskSvgBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: "auto",
    opacity: 0.96,
  },
  diskOverlayContent: {
    position: "relative",
    width: "100%",
    alignSelf: "center",
    zIndex: 2,
  },
  diskLabelBadge: {
    position: "absolute",
    left: "50%",
    minWidth: 98,
    maxWidth: 98,
    borderWidth: 0,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingVertical: 7,
    paddingHorizontal: 10,
    zIndex: 6,
  },
  diskLabelBadgeShadow: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: "6%",
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 0,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowOffset: { width: 3, height: 3 },
    shadowRadius: 0,
    elevation: 3,
  },
  diskLabelText: {
    fontSize: 30,
    letterSpacing: 2,
    textAlign: "center",
    fontFamily: RETRO_FONT,
    includeFontPadding: false,
    lineHeight: 34,
    paddingTop: 2,
    zIndex: 1,
  },
  diskStageTopOverlay: {
    position: "absolute",
    top: "2.2%",
    left: "14.2%",
    right: "14.2%",
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  diskResultCountText: {
    fontSize: 9,
    fontFamily: RETRO_FONT,
    letterSpacing: 1,
  },
  diskDeleteBtn: {
    minWidth: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 0,
  },
  diskDeleteConfirmWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diskDeleteConfirmBtn: {
    minWidth: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  diskDeleteConfirmText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  diskCardTitle: {
    color: "#dff5ff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    fontFamily: RETRO_FONT,
  },
  diskSides: {
    flexDirection: "column",
    gap: 4,
    paddingTop: 0,
    paddingBottom: 14,
  },
  challengeLabelGlow: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderRadius: 12,
  },
  sideCol: {
    width: "100%",
    alignSelf: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sideColFirst: {
    marginTop: 56,
  },
  detailScroll: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  gameMetaHeader: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 10,
  },
  gameMetaAppbar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gameMetaAppbarTitle: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
    letterSpacing: 0.8,
  },
  gameMetaAppbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gameMetaIconBtn: {
    minWidth: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    color: "#e6f8ff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
    fontFamily: RETRO_FONT,
  },
  detailSub: {
    color: "#97b7cb",
    fontSize: 12,
    marginBottom: 10,
    fontFamily: RETRO_FONT,
  },
  coverImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f3f5e",
    backgroundColor: "#0a1524",
    marginBottom: 10,
  },
  fieldLabel: {
    color: "#9fd3ee",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 8,
    color: "#e8f6ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#0a1524",
  },
  fieldArea: {
    minHeight: 120,
  },
  sideEditInput: {
    minHeight: 110,
  },
  providerRow: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  providerInlineLabel: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 60,
    fontFamily: RETRO_FONT,
  },
  providerSelectWrap: {
    position: "relative",
    zIndex: 20,
    flex: 1,
  },
  providerSelectBtn: {
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 8,
    minHeight: 38,
    backgroundColor: "#0a1524",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  providerSelectText: {
    color: "#d4eeff",
    fontSize: 13,
    fontWeight: "700",
  },
  providerSelectArrow: {
    color: "#9ec0d8",
    fontSize: 12,
    marginLeft: 10,
  },
  providerMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#2f658f",
    borderRadius: 8,
    backgroundColor: "#0f1b2b",
    overflow: "hidden",
  },
  providerMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#17334e",
  },
  providerMenuItemActive: {
    backgroundColor: "#1f4569",
  },
  providerMenuItemText: {
    color: "#d4eeff",
    fontSize: 13,
    fontWeight: "700",
  },
  providerMenuItemTextActive: {
    color: "#f0fbff",
  },
  fetchBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#37556f",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  fetchBtnText: {
    color: "#9ec0d8",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: RETRO_FONT,
  },
  providerFetchBtn: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  twoCol: {
    flexDirection: "row",
    marginTop: 2,
  },
  col: {
    flex: 1,
    marginRight: 8,
  },
  sideTitle: {
    color: "#a9d7ef",
    fontSize: 13,
    marginBottom: 0,
    letterSpacing: 1,
    fontFamily: RETRO_FONT,
  },
  sideTitleBadge: {
    position: "relative",
    borderWidth: 3,
    borderRadius: 3,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 6,
    overflow: "visible",
  },
  sideTitleBadgeShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderWidth: 1,
    borderRadius: 3,
    zIndex: -1,
    opacity: 0.95,
  },
  sideTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sideEditIconBtn: {
    width: 34,
    height: 30,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
  sideItem: {
    color: "#dff1ff",
    fontSize: 14,
    lineHeight: 17,
    marginBottom: 1,
    fontFamily: RETRO_FONT,
  },
  sideListWrap: {
    paddingHorizontal: 0,
  },
  sideListWrapContent: {
    paddingBottom: 2,
  },
  sideItemCard: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 8,
    marginBottom: 2,
    backgroundColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  challengeItemGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: 8,
  },
  sideItemRule: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 1,
    opacity: 0.8,
  },
  sideRating: {
    fontSize: 12,
    letterSpacing: 0.8,
    opacity: 0.95,
    fontFamily: RETRO_FONT,
  },
  ratingTapRow: {
    marginTop: 3,
  },
  sideRatingStars: {
    marginBottom: 2,
  },
  sideRatingHint: {
    marginTop: 1,
    fontSize: 10,
    fontFamily: RETRO_FONT,
    opacity: 0.9,
  },
  ratingPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ratingStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 0,
    paddingBottom: 1,
    paddingRight: 2,
  },
  ratingStarCell: {
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
  },
  ratingStarGlyph: {
    includeFontPadding: false,
    letterSpacing: 0,
    fontFamily: STAR_FONT,
    textAlign: "left",
  },
  ratingStarFillMask: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  ratingEditorWrap: {
    marginTop: 4,
    gap: 6,
  },
  ratingSliderWrap: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  ratingSliderNative: {
    width: "100%",
    height: 44,
  },
  ratingStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingStepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingStepText: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  ratingValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
  ratingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingSaveBtn: {
    minHeight: 28,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingSaveText: {
    fontSize: 9,
    fontWeight: "800",
    fontFamily: RETRO_FONT,
  },
  ratingCancelBtn: {
    minHeight: 28,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingCancelText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: RETRO_FONT,
  },
  sideEmpty: {
    color: "#7f9bb4",
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
  settingsCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#214666",
    borderRadius: 10,
    backgroundColor: "#0f1b2b",
    padding: 10,
  },
  settingsCardTitle: {
    color: "#dff5ff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  settingsStat: {
    color: "#a9d7ef",
    fontSize: 13,
    marginBottom: 4,
  },
  deleteBtn: {
    borderColor: "#8a2a34",
    backgroundColor: "#35141a",
  },
  storeRow: {
    borderTopWidth: 1,
    borderTopColor: "#17334e",
    paddingTop: 8,
    marginTop: 8,
  },
  storeChoice: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  storeRadio: {
    fontSize: 18,
    marginRight: 10,
  },
  storeMeta: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "700",
  },
  storeInfo: {
    marginTop: 2,
    fontSize: 12,
  },
});



