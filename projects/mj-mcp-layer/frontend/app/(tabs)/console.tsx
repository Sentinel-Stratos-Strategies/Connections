import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  FlatList,
  LayoutAnimation,
  UIManager,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { COLORS, QUICK_COMMANDS, STORAGE_KEYS } from "@/constants/config";
import { getConfig } from "@/constants/storage";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Types
type ConsoleMode = "shell" | "brady";

interface BradyMessage {
  id: string;
  role: "user" | "brady";
  content: string;
  timestamp: Date;
  command?: string;
  result?: string;
  blocked?: boolean;
  fix?: string;
  isLoading?: boolean;
}

// Brady starter prompts
const BRADY_PROMPTS = [
  "Check system health",
  "Run a drift scan",
  "Show compliance status",
  "Why am I being blocked?",
  "Show recent audit events",
  "Apply security policy",
  "What's wrong with my setup?",
  "Show active tenants",
  "Rotate my credentials",
  "Explain last deployment",
] as const;

// Generate UUID
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Hexagon Shield Icon Component
function HexagonShield({ size = 24, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size * 0.85,
          height: size * 0.95,
          backgroundColor: color,
          transform: [{ rotate: "0deg" }],
          borderRadius: size * 0.15,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: size * 0.15,
            left: size * 0.15,
            right: size * 0.15,
            bottom: size * 0.25,
            backgroundColor: COLORS.background,
            borderRadius: size * 0.1,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.25,
            left: size * 0.25,
            right: size * 0.25,
            bottom: size * 0.35,
            backgroundColor: color,
            opacity: 0.3,
            borderRadius: size * 0.08,
          }}
        />
      </View>
    </View>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.muted,
    marginHorizontal: 2,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// Parse markdown-lite content
function parseContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={key++} style={{ color: COLORS.text }}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    const content = match[0];
    if (content.startsWith("**")) {
      parts.push(
        <Text key={key++} style={{ color: COLORS.text, fontWeight: "700" }}>
          {content.slice(2, -2)}
        </Text>
      );
    } else if (content.startsWith("`")) {
      parts.push(
        <Text
          key={key++}
          style={{
            color: COLORS.success,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            backgroundColor: COLORS.border,
            paddingHorizontal: 4,
            borderRadius: 4,
          }}
        >
          {content.slice(1, -1)}
        </Text>
      );
    }
    lastIndex = match.index + content.length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key={key++} style={{ color: COLORS.text }}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : [<Text key={0} style={{ color: COLORS.text }}>{text}</Text>];
}

// Terminal HTML with xterm.js (unchanged)
function getTerminalHTML(shellUrl: string, token: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      height: 100%; 
      background: #0A0A0F; 
      overflow: hidden;
    }
    #terminal { 
      height: 100%; 
      width: 100%;
      padding: 8px;
    }
    .xterm { height: 100% !important; }
    .xterm-viewport { overflow-y: auto !important; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
  <script>
    const term = new Terminal({
      theme: {
        background: '#0A0A0F',
        foreground: '#E8E8F0',
        cursor: '#6C63FF',
        cursorAccent: '#0A0A0F',
        selectionBackground: '#6C63FF40',
        black: '#1E1E2E',
        red: '#FF4757',
        green: '#00FF94',
        yellow: '#FFB800',
        blue: '#6C63FF',
        magenta: '#A855F7',
        cyan: '#00D4FF',
        white: '#E8E8F0',
        brightBlack: '#6B6B8A',
        brightRed: '#FF6B7A',
        brightGreen: '#4DFFB0',
        brightYellow: '#FFCC33',
        brightBlue: '#8B85FF',
        brightMagenta: '#C084FC',
        brightCyan: '#33DFFF',
        brightWhite: '#FFFFFF'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true
    });
    
    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(document.getElementById('terminal'));
    
    setTimeout(() => fitAddon.fit(), 100);
    window.addEventListener('resize', () => fitAddon.fit());
    
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    function connect() {
      term.writeln('\\x1b[36mConnecting to MCP Shell...\\x1b[0m');
      
      try {
        ws = new WebSocket('${shellUrl}');
        
        ws.onopen = () => {
          reconnectAttempts = 0;
          term.writeln('\\x1b[32mConnected to MCP Gateway\\x1b[0m');
          term.writeln('\\x1b[90m────────────────────────────────────────\\x1b[0m');
          term.writeln('');
          
          // Send auth token
          ws.send(JSON.stringify({ type: 'auth', token: '${token}' }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'output') {
              term.write(data.content);
            } else if (data.type === 'error') {
              term.writeln('\\x1b[31mError: ' + data.message + '\\x1b[0m');
            }
          } catch {
            term.write(event.data);
          }
        };
        
        ws.onclose = () => {
          term.writeln('\\x1b[33mDisconnected from shell\\x1b[0m');
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            term.writeln('\\x1b[90mReconnecting in 3s (attempt ' + reconnectAttempts + '/' + maxReconnectAttempts + ')...\\x1b[0m');
            setTimeout(connect, 3000);
          }
        };
        
        ws.onerror = () => {
          term.writeln('\\x1b[31mWebSocket error\\x1b[0m');
        };
      } catch (e) {
        term.writeln('\\x1b[31mFailed to connect: ' + e.message + '\\x1b[0m');
      }
    }
    
    // Handle terminal input
    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', content: data }));
      }
    });
    
    // Expose functions to React Native
    window.sendCommand = (cmd) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        term.writeln('\\x1b[90m$ \\x1b[0m' + cmd);
        ws.send(JSON.stringify({ type: 'input', content: cmd + '\\n' }));
      } else {
        term.writeln('\\x1b[33mNot connected. Reconnecting...\\x1b[0m');
        connect();
      }
    };
    
    window.clearTerminal = () => {
      term.clear();
    };
    
    // Initial connection
    connect();
  </script>
</body>
</html>
`;
}

// Quick Command Button
function QuickCommandButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="bg-surface border border-border rounded-lg px-3 py-2 mr-2">
      <Text className="text-text text-xs">{label}</Text>
    </Pressable>
  );
}

// Mode Toggle Component
function ModeToggle({ mode, onModeChange }: { mode: ConsoleMode; onModeChange: (mode: ConsoleMode) => void }) {
  const slideAnim = useRef(new Animated.Value(mode === "shell" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: mode === "shell" ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [mode, slideAnim]);

  const indicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 4,
        marginHorizontal: 16,
        marginVertical: 8,
        position: "relative",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 4,
          left: indicatorLeft,
          width: "50%",
          height: "100%",
          backgroundColor: COLORS.primary,
          borderRadius: 20,
        }}
      />
      <Pressable
        onPress={() => onModeChange("shell")}
        style={{ flex: 1, paddingVertical: 10, alignItems: "center", zIndex: 1 }}
      >
        <Text style={{ color: mode === "shell" ? "#FFFFFF" : COLORS.muted, fontWeight: "600", fontSize: 14 }}>
          Shell
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onModeChange("brady")}
        style={{ flex: 1, paddingVertical: 10, alignItems: "center", zIndex: 1 }}
      >
        <Text style={{ color: mode === "brady" ? "#FFFFFF" : COLORS.muted, fontWeight: "600", fontSize: 14 }}>
          Brady
        </Text>
      </Pressable>
    </View>
  );
}

// Brady Prompt Chip
function PromptChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: COLORS.border,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
      }}
    >
      <Text style={{ color: COLORS.text, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

// Brady Message Bubble
function MessageBubble({
  message,
  onApplyFix,
}: {
  message: BradyMessage;
  onApplyFix?: (fix: string) => void;
}) {
  const [resultExpanded, setResultExpanded] = useState(false);
  const isUser = message.role === "user";

  const toggleResult = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setResultExpanded(!resultExpanded);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (message.isLoading) {
    return (
      <View style={{ flexDirection: "row", marginVertical: 8, paddingHorizontal: 16 }}>
        <View style={{ marginRight: 8, marginTop: 4 }}>
          <HexagonShield size={28} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: COLORS.accent,
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            BRADY
          </Text>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderLeftWidth: 3,
              borderLeftColor: COLORS.accent,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 18,
              borderBottomRightRadius: 18,
              borderBottomLeftRadius: 18,
              padding: 12,
            }}
          >
            <TypingIndicator />
          </View>
        </View>
      </View>
    );
  }

  if (isUser) {
    return (
      <View style={{ alignItems: "flex-end", marginVertical: 8, paddingHorizontal: 16 }}>
        <View
          style={{
            backgroundColor: COLORS.primary,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 4,
            padding: 12,
            maxWidth: "80%",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22 }}>{message.content}</Text>
        </View>
        <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>{formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  // Brady message
  const borderColor = message.blocked ? COLORS.warning : message.command ? COLORS.success : COLORS.accent;

  return (
    <View style={{ flexDirection: "row", marginVertical: 8, paddingHorizontal: 16 }}>
      <View style={{ marginRight: 8, marginTop: 4 }}>
        <HexagonShield size={28} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: COLORS.accent,
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          BRADY
        </Text>
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderLeftWidth: 3,
            borderLeftColor: borderColor,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 18,
            borderBottomRightRadius: 18,
            borderBottomLeftRadius: 18,
            padding: 12,
            maxWidth: "95%",
          }}
        >
          {/* Security Block Header */}
          {message.blocked && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="warning" size={16} color={COLORS.warning} />
              <Text style={{ color: COLORS.warning, fontWeight: "700", marginLeft: 6, fontSize: 14 }}>
                Security Block Detected
              </Text>
            </View>
          )}

          {/* Command Block */}
          {message.command && (
            <View style={{ marginBottom: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: COLORS.success,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: COLORS.background, fontSize: 10, fontWeight: "700" }}>EXECUTED COMMAND</Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: "#050508",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    color: COLORS.success,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    fontSize: 13,
                  }}
                >
                  {message.command}
                </Text>
              </View>
            </View>
          )}

          {/* Main Content */}
          <Text style={{ fontSize: 15, lineHeight: 22 }}>{parseContent(message.content)}</Text>

          {/* Result Expander */}
          {message.result && (
            <View style={{ marginTop: 8 }}>
              <Pressable
                onPress={toggleResult}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: COLORS.muted, fontSize: 13 }}>
                  {resultExpanded ? "Hide Output" : "View Output"}
                </Text>
                <Ionicons
                  name={resultExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={COLORS.muted}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>
              {resultExpanded && (
                <View
                  style={{
                    backgroundColor: "#050508",
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 4,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.success,
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      fontSize: 12,
                    }}
                  >
                    {message.result}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Apply Fix Button */}
          {message.fix && onApplyFix && (
            <Pressable
              onPress={() => onApplyFix(message.fix!)}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Apply Fix</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>
          )}
        </View>
        <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>{formatTime(message.timestamp)}</Text>
      </View>
    </View>
  );
}

// Error Message Bubble
function ErrorBubble({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flexDirection: "row", marginVertical: 8, paddingHorizontal: 16 }}>
      <View style={{ marginRight: 8, marginTop: 4 }}>
        <HexagonShield size={28} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: COLORS.accent,
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          BRADY
        </Text>
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderLeftWidth: 3,
            borderLeftColor: COLORS.danger,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 18,
            borderBottomRightRadius: 18,
            borderBottomLeftRadius: 18,
            padding: 12,
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 15, lineHeight: 22 }}>
            Brady couldn&apos;t reach the MCP layer. Check your connection or token.
          </Text>
          <Pressable
            onPress={onRetry}
            style={{
              backgroundColor: COLORS.danger,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14, marginLeft: 6 }}>Retry</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Welcome Screen
function WelcomeScreen({ onPromptPress }: { onPromptPress: (prompt: string) => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
      <HexagonShield size={64} />
      <Text style={{ color: COLORS.text, fontSize: 28, fontWeight: "700", marginTop: 16 }}>Brady</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, fontStyle: "italic", marginTop: 4 }}>
        Enterprise MCP Orchestrator
      </Text>
      <Text
        style={{
          color: COLORS.text,
          fontSize: 16,
          textAlign: "center",
          marginTop: 16,
          lineHeight: 24,
        }}
      >
        Ask me anything about your infrastructure.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 32, maxHeight: 50 }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {BRADY_PROMPTS.map((prompt) => (
          <PromptChip key={prompt} label={prompt} onPress={() => onPromptPress(prompt)} />
        ))}
      </ScrollView>
    </View>
  );
}

// Brady Chat Interface
function BradyChat({ config }: { config: { mcpBaseUrl: string; token: string } }) {
  const [messages, setMessages] = useState<BradyMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageRef = useRef<string>("");

  // Load tenantId and conversation history
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const storedTenantId = await SecureStore.getItemAsync("tenantId");
      setTenantId(storedTenantId || "default");

      // Load conversation history
      const conversationKey = `brady_conversation_${storedTenantId || "default"}`;
      const stored = await AsyncStorage.getItem(conversationKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages(
          parsed.map((m: BradyMessage) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }))
        );
      }
    } catch {
      setTenantId("default");
    }
  }

  // Persist conversation
  async function persistConversation(newMessages: BradyMessage[]) {
    try {
      const conversationKey = `brady_conversation_${tenantId || "default"}`;
      await AsyncStorage.setItem(conversationKey, JSON.stringify(newMessages));
    } catch {
      // Silent fail for persistence
    }
  }

  // Clear conversation
  async function clearConversation() {
    Alert.alert("Clear Session", "Are you sure you want to clear the conversation history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setMessages([]);
          const conversationKey = `brady_conversation_${tenantId || "default"}`;
          await AsyncStorage.removeItem(conversationKey);
        },
      },
    ]);
  }

  // Send message to Brady API
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: BradyMessage = {
        id: generateUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      lastMessageRef.current = text.trim();
      setInputText("");
      setHasError(false);

      // Add user message and loading indicator
      const newMessages = [...messages, userMessage];
      setMessages([
        ...newMessages,
        { id: "loading", role: "brady", content: "", timestamp: new Date(), isLoading: true },
      ]);
      setIsLoading(true);

      try {
        // Build context from last 6 messages
        const context = messages
          .slice(-6)
          .map((m) => `${m.role === "user" ? "User" : "Brady"}: ${m.content}`);

        const response = await fetch(`${config.mcpBaseUrl}/api/mj-brady`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ellis-aegis-token": config.token,
            "x-tenant-id": tenantId || "default",
            "x-request-id": generateUUID(),
          },
          body: JSON.stringify({
            message: text.trim(),
            tenantId: tenantId || "default",
            context,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        const bradyMessage: BradyMessage = {
          id: generateUUID(),
          role: "brady",
          content: data.reply || "I received your message but have no response.",
          timestamp: new Date(),
          command: data.command,
          result: data.result,
          blocked: data.blocked,
          fix: data.fix,
        };

        const finalMessages = [...newMessages, bradyMessage];
        setMessages(finalMessages);
        persistConversation(finalMessages);
      } catch {
        // Remove loading indicator and show error
        setMessages(newMessages);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, config, tenantId]
  );

  // Apply fix handler
  async function handleApplyFix(fix: string) {
    try {
      const response = await fetch(`${config.mcpBaseUrl}/api/change-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ellis-aegis-token": config.token,
          "x-tenant-id": tenantId || "default",
          "x-request-id": generateUUID(),
        },
        body: JSON.stringify({ fix }),
      });

      if (response.ok) {
        const confirmMessage: BradyMessage = {
          id: generateUUID(),
          role: "brady",
          content: "Fix has been applied successfully. The change request has been submitted for processing.",
          timestamp: new Date(),
        };
        const newMessages = [...messages, confirmMessage];
        setMessages(newMessages);
        persistConversation(newMessages);
      } else {
        Alert.alert("Error", "Failed to apply fix. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Failed to connect to MCP layer.");
    }
  }

  // Retry last message
  function retryLastMessage() {
    if (lastMessageRef.current) {
      sendMessage(lastMessageRef.current);
    }
  }

  // Render message item
  const renderMessage = ({ item }: { item: BradyMessage }) => (
    <MessageBubble message={item} onApplyFix={item.fix ? handleApplyFix : undefined} />
  );

  if (messages.length === 0 && !isLoading) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Clear button for empty state */}
        <View style={{ position: "absolute", top: 8, right: 16, zIndex: 10 }}>
          <Pressable
            onPress={clearConversation}
            style={{
              width: 40,
              height: 40,
              backgroundColor: COLORS.surface,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>

        <WelcomeScreen onPromptPress={sendMessage} />

        {/* Input Bar */}
        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {BRADY_PROMPTS.map((prompt) => (
              <PromptChip key={prompt} label={prompt} onPress={() => sendMessage(prompt)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Brady anything..."
              placeholderTextColor={COLORS.muted}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: COLORS.text,
                fontSize: 16,
                maxHeight: 100,
              }}
            />
            <Pressable
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: inputText.trim() ? COLORS.primary : COLORS.muted,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
              }}
            >
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {/* Clear button */}
      <View style={{ position: "absolute", top: 8, right: 16, zIndex: 10 }}>
        <Pressable
          onPress={clearConversation}
          style={{
            width: 40,
            height: 40,
            backgroundColor: COLORS.surface,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
        </Pressable>
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        style={{ flex: 1 }}
        contentContainerStyle={{ flexDirection: "column-reverse", paddingTop: 60, paddingBottom: 8 }}
        ListHeaderComponent={hasError ? <ErrorBubble onRetry={retryLastMessage} /> : null}
      />

      {/* Input Bar */}
      <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {BRADY_PROMPTS.map((prompt) => (
            <PromptChip key={prompt} label={prompt} onPress={() => sendMessage(prompt)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Brady anything..."
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: COLORS.text,
              fontSize: 16,
              maxHeight: 100,
            }}
          />
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: inputText.trim() && !isLoading ? COLORS.primary : COLORS.muted,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Main Console Screen
export default function ConsoleScreen() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<{
    shellUrl: string;
    mcpBaseUrl: string;
    token: string;
  } | null>(null);
  const [mode, setMode] = useState<ConsoleMode>("brady");
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const cfg = await getConfig();
    setConfig({
      shellUrl: cfg.shellUrl,
      mcpBaseUrl: cfg.mcpBaseUrl,
      token: cfg.token || "",
    });
  }

  function sendCommand(command: string) {
    webViewRef.current?.injectJavaScript(`
      window.sendCommand("${command}");
      true;
    `);
  }

  function clearTerminal() {
    webViewRef.current?.injectJavaScript(`
      window.clearTerminal();
      true;
    `);
  }

  function handleModeChange(newMode: ConsoleMode) {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setMode(newMode);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }

  if (!config) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View>
          <Text className="text-xl font-bold text-text">Console</Text>
          <Text className="text-muted text-xs">{mode === "shell" ? "MCP Cloud Shell" : "Brady AI Assistant"}</Text>
        </View>
        {mode === "shell" && (
          <View className="flex-row gap-2">
            <Pressable
              onPress={clearTerminal}
              className="w-10 h-10 bg-surface rounded-lg items-center justify-center border border-border"
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.muted} />
            </Pressable>
            <Pressable
              onPress={loadConfig}
              className="w-10 h-10 bg-surface rounded-lg items-center justify-center border border-border"
            >
              <Ionicons name="refresh" size={18} color={COLORS.muted} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Mode Toggle */}
      <ModeToggle mode={mode} onModeChange={handleModeChange} />

      {/* Content */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {mode === "shell" ? (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
            {/* Quick Commands */}
            <View className="border-b border-border">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="px-4 py-3"
                contentContainerClassName="gap-2"
              >
                {QUICK_COMMANDS.map((cmd) => (
                  <QuickCommandButton key={cmd.label} label={cmd.label} onPress={() => sendCommand(cmd.command)} />
                ))}
              </ScrollView>
            </View>

            {/* Terminal WebView */}
            <View className="flex-1">
              {isLoading && (
                <View className="absolute inset-0 items-center justify-center bg-background z-10">
                  <ActivityIndicator color={COLORS.primary} size="large" />
                  <Text className="text-muted mt-4">Loading terminal...</Text>
                </View>
              )}
              <WebView
                ref={webViewRef}
                source={{
                  html: getTerminalHTML(config.shellUrl, config.token),
                }}
                onLoadEnd={() => setIsLoading(false)}
                style={{ flex: 1, backgroundColor: COLORS.background }}
                scrollEnabled={false}
                keyboardDisplayRequiresUserAction={false}
                hideKeyboardAccessoryView={true}
                allowsInlineMediaPlayback={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            </View>
          </KeyboardAvoidingView>
        ) : (
          <BradyChat config={config} />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
