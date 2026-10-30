import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Platform,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

// Safely probe for native react-native-maps without crashing web or dev runtimes
let NativeMapView = null;
let NativeMarker = null;
let NativeCallout = null;
try {
  const Maps = require('react-native-maps');
  NativeMapView = Maps.default || Maps.MapView;
  NativeMarker = Maps.Marker;
  NativeCallout = Maps.Callout;
} catch (e) {
  NativeMapView = null;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAP_HEIGHT = 420;

export const EmergencyMapView = ({
  incidents = [],
  userLocation = null,
  selectedIncident = null,
  onSelectIncident,
  onMapPress,
  initialRegion = null,
}) => {
  // Fallback Tactical Canvas State
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5x to 4x
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Compute bounding center of incidents or default to standard coordinates
  const defaultCenter = useMemo(() => {
    if (userLocation) {
      return { lat: userLocation.latitude, lng: userLocation.longitude };
    }
    const withCoords = incidents.filter(
      (i) => i.latitude !== null && i.longitude !== null && typeof i.latitude === 'number'
    );
    if (withCoords.length > 0) {
      const avgLat = withCoords.reduce((acc, i) => acc + i.latitude, 0) / withCoords.length;
      const avgLng = withCoords.reduce((acc, i) => acc + i.longitude, 0) / withCoords.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 37.7749, lng: -122.4194 }; // Default view
  }, [incidents, userLocation]);

  // Pan Responder for Tactical Grid Canvas
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          panStartRef.current = { ...panOffset };
        },
        onPanResponderMove: (evt, gestureState) => {
          setPanOffset({
            x: panStartRef.current.x + gestureState.dx,
            y: panStartRef.current.y + gestureState.dy,
          });
        },
      }),
    [panOffset]
  );

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.3, 5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.3, 0.4));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const getMarkerColor = (type) => {
    switch (type) {
      case 'Medical Emergency':
        return '#EF4444'; // Red
      case 'Fire':
        return '#F97316'; // Orange
      case 'Accident':
        return '#F59E0B'; // Amber
      case 'Personal Safety':
        return '#8B5CF6'; // Purple
      case 'Test / Drill':
        return '#10B981'; // Green
      default:
        return '#3B82F6'; // Blue
    }
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'Medical Emergency':
        return '🚑';
      case 'Fire':
        return '🔥';
      case 'Accident':
        return '⚠️';
      case 'Personal Safety':
        return '🛡️';
      case 'Test / Drill':
        return '🧪';
      default:
        return '🚨';
    }
  };

  // Convert GPS Coordinates to Screen X, Y on Tactical Vector Canvas
  const projectCoordinates = (lat, lng) => {
    const scale = 3000 * zoomLevel;
    const x =
      SCREEN_WIDTH / 2 +
      (lng - defaultCenter.lng) * scale +
      panOffset.x;
    const y =
      MAP_HEIGHT / 2 -
      (lat - defaultCenter.lat) * scale +
      panOffset.y;
    return { x, y };
  };

  // 1. Native Map Rendering (react-native-maps in Dev Builds with native bridge)
  if (NativeMapView && NativeMarker && Platform.OS !== 'web') {
    const region = {
      latitude: defaultCenter.lat,
      longitude: defaultCenter.lng,
      latitudeDelta: 0.08 / zoomLevel,
      longitudeDelta: 0.08 / zoomLevel,
      ...initialRegion,
    };

    return (
      <View style={styles.container}>
        <NativeMapView
          style={styles.nativeMap}
          initialRegion={region}
          onPress={() => onMapPress && onMapPress()}
          showsUserLocation={!!userLocation}
          showsMyLocationButton={false}
          showsCompass={true}
        >
          {/* User Location Marker if available */}
          {userLocation && (
            <NativeMarker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="Your Current Location"
              pinColor="#2563EB"
            />
          )}

          {/* Incident Markers */}
          {incidents
            .filter((i) => typeof i.latitude === 'number' && typeof i.longitude === 'number')
            .map((incident) => {
              const isSelected =
                selectedIncident &&
                (selectedIncident.alertId === incident.alertId ||
                  selectedIncident.id === incident.id);
              const color = getMarkerColor(incident.emergencyType);

              return (
                <NativeMarker
                  key={incident.alertId || incident.id}
                  coordinate={{
                    latitude: incident.latitude,
                    longitude: incident.longitude,
                  }}
                  onPress={() => onSelectIncident && onSelectIncident(incident)}
                  pinColor={color}
                >
                  <View
                    style={[
                      styles.nativeMarkerCustom,
                      { backgroundColor: color },
                      isSelected && styles.markerSelectedHighlight,
                    ]}
                  >
                    <Text style={styles.nativeMarkerIcon}>
                      {getCategoryIcon(incident.emergencyType)}
                    </Text>
                  </View>
                </NativeMarker>
              );
            })}
        </NativeMapView>
      </View>
    );
  }

  // 2. High-Performance Tactical Grid Canvas (Runs anywhere: Web, Expo Go, Emulators without Google API keys)
  return (
    <View style={styles.container}>
      <View style={styles.tacticalGrid} {...panResponder.panHandlers}>
        {/* Radar Ring Background Grids */}
        <View style={styles.gridCenterDot} />
        <View style={[styles.radarCircle, { width: 140 * zoomLevel, height: 140 * zoomLevel }]} />
        <View style={[styles.radarCircle, { width: 280 * zoomLevel, height: 280 * zoomLevel }]} />
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />

        {/* User Current Location Indicator */}
        {userLocation && (
          (() => {
            const pos = projectCoordinates(userLocation.latitude, userLocation.longitude);
            return (
              <View
                key="user-location-marker"
                style={[styles.userLocMarker, { left: pos.x - 14, top: pos.y - 14 }]}
              >
                <View style={styles.userLocRing} />
                <View style={styles.userLocCore} />
              </View>
            );
          })()
        )}

        {/* Incident Markers */}
        {incidents
          .filter(
            (i) =>
              i.latitude !== null &&
              i.longitude !== null &&
              typeof i.latitude === 'number' &&
              typeof i.longitude === 'number'
          )
          .map((incident) => {
            const pos = projectCoordinates(incident.latitude, incident.longitude);
            const isSelected =
              selectedIncident &&
              (selectedIncident.alertId === incident.alertId ||
                selectedIncident.id === incident.id);
            const markerColor = getMarkerColor(incident.emergencyType);

            // Bounded to map viewport
            if (pos.x < -30 || pos.x > SCREEN_WIDTH + 30 || pos.y < -30 || pos.y > MAP_HEIGHT + 30) {
              return null;
            }

            return (
              <TouchableOpacity
                key={incident.alertId || incident.id}
                style={[
                  styles.tacticalMarker,
                  {
                    left: pos.x - 18,
                    top: pos.y - 18,
                    backgroundColor: markerColor,
                  },
                  isSelected && styles.markerSelectedHighlight,
                ]}
                activeOpacity={0.8}
                onPress={() => onSelectIncident && onSelectIncident(incident)}
              >
                <Text style={styles.tacticalMarkerIcon}>
                  {getCategoryIcon(incident.emergencyType)}
                </Text>
                {isSelected && <View style={styles.selectedBeaconPulse} />}
              </TouchableOpacity>
            );
          })}

        {/* Tactical Map Overlay Coordinates Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendText}>
            GRID: {defaultCenter.lat.toFixed(4)}°N, {defaultCenter.lng.toFixed(4)}°E · ZOOM: {zoomLevel.toFixed(1)}x
          </Text>
        </View>
      </View>

      {/* Map Control Buttons (+, -, Reset) */}
      <View style={styles.controlsColumn}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn}>
          <Text style={styles.controlBtnText}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut}>
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleResetView}>
          <Text style={styles.controlBtnText}>🎯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    backgroundColor: '#0F172A', // Slate 900 tactical dark
    overflow: 'hidden',
    position: 'relative',
  },
  nativeMap: {
    ...StyleSheet.absoluteFillObject,
  },
  nativeMarkerCustom: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.cardElevated,
  },
  nativeMarkerIcon: {
    fontSize: 16,
  },
  tacticalGrid: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#090D16',
  },
  crosshairH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: MAP_HEIGHT / 2,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  crosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SCREEN_WIDTH / 2,
    width: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  gridCenterDot: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - 3,
    top: MAP_HEIGHT / 2 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
  },
  radarCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.12)',
    transform: [{ translateX: -SCREEN_WIDTH / 2 }, { translateY: -MAP_HEIGHT / 2 }],
  },
  userLocMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  userLocCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
  },
  tacticalMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.cardElevated,
    zIndex: 10,
  },
  tacticalMarkerIcon: {
    fontSize: 18,
  },
  markerSelectedHighlight: {
    borderColor: '#FACC15', // Amber gold
    borderWidth: 3,
    transform: [{ scale: 1.25 }],
    zIndex: 20,
  },
  selectedBeaconPulse: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
  },
  legendContainer: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#94A3B8',
  },
  controlsColumn: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  controlBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
