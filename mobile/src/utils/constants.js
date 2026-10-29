/**
 * RescueLink Emergency Constants & Enums
 */

export const APP_CONFIG = {
  APP_NAME: 'RescueLink',
  APP_SUBTITLE: 'Offline Bluetooth Emergency SOS',
  VERSION: '1.0.0',
};

export const EMERGENCY_TYPES = [
  {
    id: 'medical',
    label: 'Medical Emergency',
    badgeText: 'Medical',
    description: 'Severe injury, cardiac arrest, breathing difficulty, or unconsciousness',
    symbol: '⚕️',
    color: '#DC2626',
    bgColor: '#FEE2E2',
  },
  {
    id: 'accident',
    label: 'Accident',
    badgeText: 'Accident',
    description: 'Vehicle collision, building collapse, or mechanical disaster',
    symbol: '🚗',
    color: '#EA580C',
    bgColor: '#FFEDD5',
  },
  {
    id: 'safety',
    label: 'Personal Safety',
    badgeText: 'Safety',
    description: 'Threat of violence, harassment, lost in wilderness, or trapped',
    symbol: '🛡️',
    color: '#7C3AED',
    bgColor: '#F3E8FF',
  },
  {
    id: 'fire',
    label: 'Fire',
    badgeText: 'Fire',
    description: 'Structure fire, wildfire, gas leak, or smoke inhalation',
    symbol: '🔥',
    color: '#E11D48',
    bgColor: '#FFE4E6',
  },
  {
    id: 'other',
    label: 'Other',
    badgeText: 'Other',
    description: 'Natural disaster, flood, severe weather, or unclassified crisis',
    symbol: '⚠️',
    color: '#475569',
    bgColor: '#F1F5F9',
  },
  {
    id: 'drill',
    label: 'Test / Drill',
    badgeText: 'Drill Mode',
    description: 'Safe practice drill for testing offline beacons and device relays without alarm',
    symbol: '🧪',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
];

export const STATUS_STATES = {
  BLUETOOTH: {
    READY: { label: 'BLE Standby (Offline)', variant: 'info', icon: '📡' },
    SCANNING: { label: 'BLE Scanning...', variant: 'info', icon: '🔍' },
    OFF: { label: 'Bluetooth Off', variant: 'warning', icon: '📵' },
  },
  INTERNET: {
    ONLINE: { label: 'Cloud Gateway Connected', variant: 'success', icon: '🌐' },
    OFFLINE: { label: 'Offline (Mesh Only)', variant: 'warning', icon: '📴' },
  },
  LOCATION: {
    LOCKED: { label: 'GPS Coordinates Active', variant: 'info', icon: '📍' },
    ACQUIRING: { label: 'Acquiring GPS Fix...', variant: 'warning', icon: '🛰️' },
    UNAVAILABLE: { label: 'Location Unavailable', variant: 'danger', icon: '❌' },
  },
};

export const SAFETY_DISCLAIMER = {
  SHORT: 'Notice: Emergency delivery is not guaranteed. Not a replacement for 911 / 112.',
  FULL: 'RescueLink operates as an offline peer-to-peer demonstration system. Emergency delivery cannot be guaranteed in all conditions. This application is NOT an official substitute for certified emergency services. When standard cellular or wireline infrastructure is functional, always call 911 or your local emergency number immediately.',
};
