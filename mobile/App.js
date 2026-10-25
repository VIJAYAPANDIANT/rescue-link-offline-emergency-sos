import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { AppNavigator } from './src/navigation';
import { colors } from './src/utils/theme';

/**
 * RescueLink Mobile Application
 *
 * Offline Bluetooth Emergency SOS System
 * Step 1: Foundation & SOS Mobile User Interface
 */
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
