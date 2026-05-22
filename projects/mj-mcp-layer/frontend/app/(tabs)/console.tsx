import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, QUICK_COMMANDS } from "@/constants/config";
import { getConfig } from "@/constants/storage";

// Terminal HTML with xterm.js
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
function QuickCommandButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-border rounded-lg px-3 py-2 mr-2"
    >
      <Text className="text-text text-xs">{label}</Text>
    </Pressable>
  );
}

export default function ConsoleScreen() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<{
    shellUrl: string;
    token: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const cfg = await getConfig();
    setConfig({
      shellUrl: cfg.shellUrl,
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

  if (!config) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <View>
            <Text className="text-xl font-bold text-text">Console</Text>
            <Text className="text-muted text-xs">MCP Cloud Shell</Text>
          </View>
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
        </View>

        {/* Quick Commands */}
        <View className="border-b border-border">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 py-3"
            contentContainerClassName="gap-2"
          >
            {QUICK_COMMANDS.map((cmd) => (
              <QuickCommandButton
                key={cmd.label}
                label={cmd.label}
                onPress={() => sendCommand(cmd.command)}
              />
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
    </SafeAreaView>
  );
}
