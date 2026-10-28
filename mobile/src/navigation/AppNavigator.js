import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { SendSOSScreen } from '../screens/SendSOSScreen';
import { NearbyDevicesScreen } from '../screens/NearbyDevicesScreen';
import { EmergencyHistoryScreen } from '../screens/EmergencyHistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors, spacing, shadows } from '../utils/theme';

/**
 * Navigation Content Controller
 */
const NavigatorContent = () => {
  const { isAuthenticated } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [history, setHistory] = useState(['Home']);
  const [routeParams, setRouteParams] = useState({});

  // Global in-memory demonstration drafts list
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
      case 'Login':
        return <LoginScreen navigation={navigation} route={{ params: routeParams }} />;
      case 'Register':
        return <RegisterScreen navigation={navigation} route={{ params: routeParams }} />;
      case 'Profile':
        return <ProfileScreen navigation={navigation} route={{ params: routeParams }} />;
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
    { key: 'EmergencyHistory', label: 'History', icon: '📋' },
    {
      key: 'Profile',
      label: isAuthenticated ? 'Profile' : 'Sign In',
      icon: isAuthenticated ? '🛡️' : '👤',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Active Screen View */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Accessible Bottom Emergency Navigation Bar */}
      <View style={[styles.bottomBar, shadows.cardElevated]}>
        {navTabs.map((tab) => {
          const isActive =
            currentScreen === tab.key ||
            (tab.key === 'Profile' && (currentScreen === 'Login' || currentScreen === 'Register'));
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
                numberOfLines={1}
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

/**
 * AppNavigator Root (Wrapped with AuthProvider)
 */
export const AppNavigator = () => {
  return (
    <AuthProvider>
      <NavigatorContent />
    </AuthProvider>
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
    paddingHorizontal: spacing.xs,
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
    fontSize: 10,
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
