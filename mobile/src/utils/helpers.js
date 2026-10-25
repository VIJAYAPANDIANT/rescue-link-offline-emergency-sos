/**
 * Utility Helper Functions
 */

/**
 * Format timestamp into user-friendly localized format
 */
export const formatTimestamp = (dateInput) => {
  if (!dateInput) return 'Unknown Time';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' · ' +
    date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format latitude and longitude coordinates into clean display string
 */
export const formatCoordinates = (latitude, longitude, accuracy) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return 'Coordinates Pending';
  }
  const latStr = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  const accStr = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
  return `${latStr}, ${lngStr}${accStr}`;
};

/**
 * Generate a unique local ID for demonstration drafts
 */
export const generateDraftId = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const time = Date.now().toString().slice(-4);
  return `DRAFT-${time}-${rand}`;
};
