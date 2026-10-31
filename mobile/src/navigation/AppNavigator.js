import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { SendSOSScreen } from '../screens/SendSOSScreen';
import { NearbyDevicesScreen } from '../screens/NearbyDevicesScreen';
import { EmergencyHistoryScreen } from '../screens/EmergencyHistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EmergencyContactsScreen } from '../screens/EmergencyContactsScreen';
import { NotificationHistoryScreen } from '../screens/NotificationHistoryScreen';
import { LiveEmergencyMapScreen } from '../screens/LiveEmergencyMapScreen';
import { spacing, shadows } from '../utils/theme';

/**
 * Navigation Content Controller
 */
const NavigatorContent = () => {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
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
      case 'Settings':
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
      case 'Contacts':
      case 'EmergencyContacts':
        return <EmergencyContactsScreen navigation={navigation} route={{ params: routeParams }} />;
      case 'NotificationHistory':
        return <NotificationHistoryScreen navigation={navigation} route={{ params: routeParams }} />;
      case 'LiveMap':
      case 'Map':
        return <LiveEmergencyMapScreen navigation={navigation} route={{ params: routeParams }} />;
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

  // Bottom Navigation Items with Accessible Icons & Labels
  const navTabs = [
    { key: 'Home', label: 'Home', icon: '🚨' },
    { key: 'LiveMap', label: 'Map', icon: '🗺️' },
    { key: 'SendSOS', label: 'Send SOS', icon: '⚡' },
    { key: 'NearbyDevices', label: 'Nearby', icon: '📡' },
    { key: 'EmergencyHistory', label: 'History', icon: '📋' },
    {
      key: 'Profile',
      label: isAuthenticated ? 'Settings' : 'Sign In',
      icon: isAuthenticated ? '⚙️' : '👤',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Active Screen View */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Accessible Bottom Emergency Navigation Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.cardBackground,
            borderTopColor: colors.border,
          },
          shadows.cardElevated,
        ]}
      >
        {navTabs.map((tab) => {
          const isActive =
            currentScreen === tab.key ||
            (tab.key === 'Profile' && (currentScreen === 'Login' || currentScreen === 'Register'));
          const isSOS = tab.key === 'SendSOS';

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                isSOS && [styles.sosTabHighlight, { backgroundColor: isDark ? '#450A0A' : '#FEE2E2', borderColor: colors.primaryBorder }],
              ]}
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
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  { color: colors.textSecondary },
                  isActive && [styles.tabLabelActive, { color: isSOS ? colors.primary : (isDark ? '#60A5FA' : colors.navy) }],
                  isSOS && [styles.sosTabLabel, { color: colors.primary }],
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
 * AppNavigator Root (Wrapped with ThemeProvider & AuthProvider)
 */
export const AppNavigator = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigatorContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    height: 68,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  tabIconWrapper: {
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
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  sosTabHighlight: {
    transform: [{ scale: 1.05 }],
    borderWidth: 1,
    paddingHorizontal: 4,
    marginHorizontal: 2,
  },
  sosTabIcon: {
    fontSize: 22,
  },
  sosTabLabel: {
    fontWeight: '900',
  },
});

export default AppNavigator;
