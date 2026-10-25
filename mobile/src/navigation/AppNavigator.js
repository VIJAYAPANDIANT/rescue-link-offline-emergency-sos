import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { SendSOSScreen } from '../screens/SendSOSScreen';
import { NearbyDevicesScreen } from '../screens/NearbyDevicesScreen';
import { EmergencyHistoryScreen } from '../screens/EmergencyHistoryScreen';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

/**
 * AppNavigator
 *
 * Implements seamless, crash-resilient navigation between:
 * - Home (Emergency Dashboard)
 * - Send SOS (Incident reporting form)
 * - Nearby Devices (BLE mesh status)
 * - Emergency History (Local offline audit logs)
 *
 * Provides a React Navigation compatible contract:
 * `navigation.navigate(screenName, params)` and `navigation.goBack()`
 * plus an accessible bottom navigation bar for quick emergency access.
 */
export const AppNavigator = () => {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [history, setHistory] = useState(['Home']);
  const [routeParams, setRouteParams] = useState({});

  // Global in-memory demonstration drafts list for Step 1
  const [drafts, setDrafts] = useState([]);

  const handleDraftCreated = (newDraft) => {
    setDrafts((prev) => [newDraft, ...prev]);
  };

  const handleClearDrafts = () => {
    setDrafts([]);
  };

  // React Navigation compatible navigation controller
  const navigation = {
    navigate: (screenName, params = {}) => {
      setRouteParams(params);
      setHistory((prev) => [...prev, screenName]);
      setCurrentScreen(screenName);
    },
    goBack: () => {
      if (history.length > 1) {
        const newHistory = [...history];
        newHistory.pop(); // remove current
        const previousScreen = newHistory[newHistory.length - 1];
        setHistory(newHistory);
        setCurrentScreen(previousScreen);
      } else {
        setCurrentScreen('Home');
      }
    },
  };

  // Render current screen component
  const renderScreen = () => {
    switch (currentScreen) {
      case 'SendSOS':
        return (
          <SendSOSScreen
            navigation={navigation}
            route={{
              params: {
                ...routeParams,
                onDraftCreated: handleDraftCreated,
              },
            }}
          />
        );
      case 'NearbyDevices':
        return (
          <NearbyDevicesScreen
            navigation={navigation}
            route={{ params: routeParams }}
          />
        );
      case 'EmergencyHistory':
        return (
          <EmergencyHistoryScreen
            navigation={navigation}
            drafts={drafts}
            onClearDrafts={handleClearDrafts}
            route={{ params: routeParams }}
          />
        );
      case 'Home':
      default:
        return (
          <HomeScreen
            navigation={navigation}
            route={{ params: routeParams }}
          />
        );
    }
  };

  // Bottom Navigation Items
  const navTabs = [
    { key: 'Home', label: 'Dashboard', icon: '🚨' },
    { key: 'SendSOS', label: 'Send SOS', icon: '📝' },
    { key: 'NearbyDevices', label: 'Nearby', icon: '📡' },
    { key: 'EmergencyHistory', label: 'History', icon: '📋', badge: drafts.length },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Active Screen View */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Accessible Bottom Emergency Navigation Bar */}
      <View style={[styles.bottomBar, shadows.cardElevated]}>
        {navTabs.map((tab) => {
          const isActive = currentScreen === tab.key;
          const isSOS = tab.key === 'SendSOS';

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isSOS && styles.sosTabHighlight]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <View style={styles.tabIconWrapper}>
                <Text style={[styles.tabIcon, isSOS && styles.sosTabIcon]}>
                  {tab.icon}
                </Text>
                {tab.badge > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                  isSOS && styles.sosTabLabel,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  sosTabHighlight: {
    transform: [{ scale: 1.05 }],
  },
  sosTabIcon: {
    fontSize: 22,
  },
  sosTabLabel: {
    color: colors.primary,
    fontWeight: '800',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});

export default AppNavigator;
