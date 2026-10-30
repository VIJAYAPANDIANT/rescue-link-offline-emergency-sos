import React, { useState } from 'react';
import { MapPinIcon, ExternalLinkIcon } from './Icons';
import StatusBadge from './StatusBadge';

export default function InteractiveMap({ incidents = [], onSelectIncident }) {
  const [selectedPin, setSelectedPin] = useState(null);

  // Filter only incidents with real valid GPS coordinates
  const mappedIncidents = incidents.filter(
    (inc) =>
      inc.location &&
      typeof inc.location.latitude === 'number' &&
      typeof inc.location.longitude === 'number' &&
      inc.location.latitude >= -90 &&
      inc.location.latitude <= 90 &&
      inc.location.longitude >= -180 &&
      inc.location.longitude <= 180 &&
      !(inc.location.latitude === 0 && inc.location.longitude === 0)
  );

  const unmappedCount = incidents.length - mappedIncidents.length;

  if (mappedIncidents.length === 0) {
    return (
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <MapPinIcon className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">No Geocoded Incidents</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          None of the current incidents contain verified GPS coordinates. Incidents without coordinates are never fabricated on the spatial canvas.
        </p>
        {unmappedCount > 0 && (
          <div className="mt-3 inline-block px-3 py-1 bg-amber-950/40 border border-amber-500/30 rounded-full text-xs text-amber-400">
            ⚠️ {unmappedCount} incidents quarantined as unmapped
          </div>
        )}
      </div>
    );
  }

  // Calculate bounding box
  const lats = mappedIncidents.map((i) => i.location.latitude);
  const lngs = mappedIncidents.map((i) => i.location.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = Math.max(maxLat - minLat, 0.02);
  const lngRange = Math.max(maxLng - minLng, 0.02);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const width = 800;
  const height = 450;
  const padding = 60;

  // Project lat/lng to canvas x/y
  const getCoordinates = (lat, lng) => {
    const x = padding + ((lng - (centerLng - lngRange / 2)) / lngRange) * (width - 2 * padding);
    const y = height - (padding + ((lat - (centerLat - latRange / 2)) / latRange) * (height - 2 * padding));
    return {
      x: Math.max(padding / 2, Math.min(width - padding / 2, x)),
      y: Math.max(padding / 2, Math.min(height - padding / 2, y)),
    };
  };

  const getMarkerColor = (type) => {
    switch (type) {
      case 'Medical Emergency':
        return '#EF4444';
      case 'Fire':
        return '#F97316';
      case 'Accident':
        return '#EAB308';
      case 'Personal Safety':
        return '#8B5CF6';
      case 'Test / Drill':
        return '#10B981';
      default:
        return '#3B82F6';
    }
  };

  return (
    <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-800 bg-navy-900/60 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-200">
            Geospatial Radar Canvas ({mappedIncidents.length} Mapped)
          </span>
          <span className="text-slate-500">
            Center: {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          {unmappedCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-400 font-medium">
              ⚠️ {unmappedCount} Unmapped
            </span>
          )}
          <span>Click any marker to inspect</span>
        </div>
      </div>

      {/* SVG Radar Map */}
      <div className="relative w-full aspect-[16/9] bg-gradient-to-b from-[#060b17] to-[#0d1629] overflow-hidden select-none">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          {/* Tactical Grid Lines */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />
          <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />

          {/* Range rings */}
          <circle cx={width / 2} cy={height / 2} r="70" fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx={width / 2} cy={height / 2} r="140" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={width / 2} cy={height / 2} r="210" fill="none" stroke="#0f172a" strokeWidth="1" />

          {/* Compass labels */}
          <text x={width / 2} y={padding - 10} fill="#475569" fontSize="10" textAnchor="middle">N</text>
          <text x={width / 2} y={height - padding + 20} fill="#475569" fontSize="10" textAnchor="middle">S</text>
          <text x={padding - 15} y={height / 2 + 4} fill="#475569" fontSize="10" textAnchor="middle">W</text>
          <text x={width - padding + 15} y={height / 2 + 4} fill="#475569" fontSize="10" textAnchor="middle">E</text>

          {/* Plotted Incident Markers */}
          {mappedIncidents.map((inc) => {
            const { x, y } = getCoordinates(inc.location.latitude, inc.location.longitude);
            const color = getMarkerColor(inc.emergencyType);
            const isSelected = selectedPin?.id === inc.id;

            return (
              <g
                key={inc.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => setSelectedPin(inc)}
              >
                {/* Pulse wave */}
                <circle cx={x} cy={y} r={isSelected ? '18' : '12'} fill={color} opacity="0.25">
                  <animate attributeName="r" values="8;20;8" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2.5s" repeatCount="indefinite" />
                </circle>

                {/* Pin core */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? '7' : '5'}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />
              </g>
            );
          })}
        </svg>

        {/* Selected Incident Drawer / Tooltip Overlay */}
        {selectedPin && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 bg-navy-850/95 backdrop-blur-md border border-slate-700 rounded-xl p-4 shadow-2xl z-20">
            <div className="flex items-start justify-between">
              <div>
                <StatusBadge type="emergencyType" value={selectedPin.emergencyType} />
                <h5 className="font-bold text-white text-sm mt-1.5 line-clamp-1">
                  {selectedPin.details || selectedPin.emergencyType}
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sender: {selectedPin.senderName || 'Anonymous'} • {new Date(selectedPin.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800 text-xs flex items-center justify-between text-slate-300">
              <span>
                📍 {selectedPin.location.latitude.toFixed(5)}, {selectedPin.location.longitude.toFixed(5)}
              </span>
              <a
                href={`https://maps.google.com/?q=${selectedPin.location.latitude},${selectedPin.location.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-red-400 hover:text-red-300 font-medium flex items-center"
              >
                Open Maps
                <ExternalLinkIcon className="w-3.5 h-3.5 ml-1" />
              </a>
            </div>

            {onSelectIncident && (
              <button
                onClick={() => onSelectIncident(selectedPin)}
                className="w-full mt-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-white transition"
              >
                Inspect Incident Details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
