import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map Type Component
const MapTypeSelector = ({ onMapTypeChange }) => {
  const [mapType, setMapType] = useState('openstreetmap');

  const handleMapTypeChange = (type) => {
    setMapType(type);
    onMapTypeChange(type);
  };

  return (
    <div className="map-type-selector">
      <button 
        className={mapType === 'openstreetmap' ? 'active' : ''}
        onClick={() => handleMapTypeChange('openstreetmap')}
      >
        OpenStreetMap
      </button>
      <button 
        className={mapType === 'satellite' ? 'active' : ''}
        onClick={() => handleMapTypeChange('satellite')}
      >
        Satellite
      </button>
      <button 
        className={mapType === 'hybrid' ? 'active' : ''}
        onClick={() => handleMapTypeChange('hybrid')}
      >
        Hybrid
      </button>
      <button 
        className={mapType === 'terrain' ? 'active' : ''}
        onClick={() => handleMapTypeChange('terrain')}
      >
        Terrain
      </button>
    </div>
  );
};

// DEM Data Management Component
const DEMDataHandler = ({ onDEMDataLoad, onDEMDataChange }) => {
  const [demData, setDemData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setIsLoading(true);
      
      // Simulate DEM data processing
      setTimeout(() => {
        const demData = {
          name: file.name,
          size: file.size,
          type: file.type,
          timestamp: new Date().toISOString()
        };
        
        setDemData(demData);
        onDEMDataLoad(demData);
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="dem-data-handler">
      <input 
        type="file" 
        accept=".dem,.asc,.tif" 
        onChange={handleFileUpload} 
        disabled={isLoading}
      />
      {isLoading && <p>Loading DEM data...</p>}
      {demData && (
        <div className="dem-data-info">
          <p>Loaded: {demData.name}</p>
          <p>Size: {demData.size} bytes</p>
        </div>
      )}
    </div>
  );
};

// Map Source Selector Component
const MapSourceSelector = ({ onSourceChange }) => {
  const [selectedSource, setSelectedSource] = useState('osm');

  const sources = [
    { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
    { id: 'satellite', name: 'Satellite', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    { id: 'terrain', name: 'Terrain', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}' }
  ];

  const handleSourceChange = (sourceId) => {
    setSelectedSource(sourceId);
    const source = sources.find(s => s.id === sourceId);
    if (source) {
      onSourceChange(source);
    }
  };

  return (
    <div className="map-source-selector">
      {sources.map((source) => (
        <button
          key={source.id}
          className={selectedSource === source.id ? 'active' : ''}
          onClick={() => handleSourceChange(source.id)}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
};

// Main Map Component with Enhanced Features
const EnhancedMap = ({ 
  center = [51.505, -0.09], 
  zoom = 13,
  mapType = 'openstreetmap',
  onMapTypeChange,
  onDEMDataLoad,
  onSourceChange
}) => {
  const [currentMapType, setCurrentMapType] = useState(mapType);
  const [demData, setDemData] = useState(null);
  const [selectedSource, setSelectedSource] = useState('osm');

  useEffect(() => {
    setCurrentMapType(mapType);
  }, [mapType]);

  const handleMapTypeChange = (type) => {
    setCurrentMapType(type);
    if (onMapTypeChange) {
      onMapTypeChange(type);
    }
  };

  const handleDEMDataLoad = (data) => {
    setDemData(data);
    if (onDEMDataLoad) {
      onDEMDataLoad(data);
    }
  };

  const handleSourceChange = (source) => {
    setSelectedSource(source);
    if (onSourceChange) {
      onSourceChange(source);
    }
  };

  const getTileLayerUrl = () => {
    switch (selectedSource.id) {
      case 'satellite':
        return 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';
      case 'osm':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  return (
    <div className="enhanced-map">
      <div className="map-controls">
        <MapTypeSelector onMapTypeChange={handleMapTypeChange} />
        <MapSourceSelector onSourceChange={handleSourceChange} />
        <DEMDataHandler onDEMDataLoad={handleDEMDataLoad} />
      </div>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url={getTileLayerUrl()}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      </MapContainer>
    </div>
  );
};

export default EnhancedMap;