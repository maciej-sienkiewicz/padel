import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RecordingProvider } from "@/contexts/RecordingContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
    return (
        <Stack screenOptions={{ headerBackTitle: "Back" }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="pairing" options={{ headerShown: false }} />
            <Stack.Screen name="camera" options={{ headerShown: false }} />
            <Stack.Screen name="remote" options={{ headerShown: false }} />
            <Stack.Screen name="highlights" options={{ headerShown: false }} />
        </Stack>
    );
}

export default function RootLayout() {
    useEffect(() => {
        SplashScreen.hideAsync();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <RecordingProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <RootLayoutNav />
                </GestureHandlerRootView>
            </RecordingProvider>
        </QueryClientProvider>
    );
}