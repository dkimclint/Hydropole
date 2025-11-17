import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qhulkelhbhllcwwandes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodWxrZWxoYmhsbGN3d2FuZGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTg2MjUsImV4cCI6MjA3NjI5NDYyNX0.42UGFleZGnrE0GCc3F8jU69ernTCRu6np-uqDD5G2Rk';

const supabase = createClient(supabaseUrl, supabaseKey);

let map;
let userLocationMarker = null;
let userLocationCircle = null;
let watchId = null;
let isMobile = false;

// Station management
let stations = [];
let stationMarkers = [];
let selectedStation = null;

// === Water Level Color Functions ===
function getWaterLevelColor(waterLevelFeet) {
    if (waterLevelFeet >= 0 && waterLevelFeet <= 1.0) {
        return 'safe'; // Green
    } else if (waterLevelFeet >= 1.1 && waterLevelFeet <= 2.5) {
        return 'warning'; // Yellow
    } else if (waterLevelFeet >= 2.6 && waterLevelFeet <= 6.0) {
        return 'danger'; // Red
    } else {
        return 'offline'; // Default for values outside range
    }
}

function getWaterLevelStatus(waterLevelFeet) {
    if (waterLevelFeet >= 0 && waterLevelFeet <= 1.0) {
        return 'SAFE';
    } else if (waterLevelFeet >= 1.1 && waterLevelFeet <= 2.5) {
        return 'ALERT';
    } else if (waterLevelFeet >= 2.6 && waterLevelFeet <= 6.0) {
        return 'DANGER';
    } else {
        return 'UNKNOWN';
    }
}

// === Initialize everything when DOM is loaded ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    checkMobileDevice();
    initMap();
    initEventListeners();
    loadDarkModePreference();
    requestUserLocation();
    initDashboard();
    
    // Load stations after initialization
    setTimeout(() => {
        loadStations();
        startRealTimeUpdates();
    }, 1000);
    
    console.log('HydroPole App initialized successfully!');
});

// === Check if device is mobile ===
function checkMobileDevice() {
    isMobile = window.innerWidth <= 768;
    console.log('Mobile device detected:', isMobile);
    
    if (isMobile) {
        document.body.classList.add('mobile-device');
    } else {
        document.body.classList.add('desktop-device');
    }
}

// === Initialize Map ===
function initMap() {
    console.log('Initializing map...');
    
    const defaultCoords = [14.8322, 120.7333];
    const zoomLevel = isMobile ? 12 : 13;
    
    map = L.map('map', {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
        tap: true
    }).setView(defaultCoords, zoomLevel);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3
    }).addTo(map);
    
    // Ensure map is responsive
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
    
    console.log('Map initialized successfully');
}

// === Initialize Dashboard ===
function initDashboard() {
    // Initialize panel toggles for desktop
    const panelToggles = document.querySelectorAll('.panel-toggle');
    panelToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const panel = this.closest('.dashboard-panel');
            panel.classList.toggle('collapsed');
            
            const icon = this.querySelector('i');
            if (panel.classList.contains('collapsed')) {
                icon.style.transform = 'rotate(-90deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
    
    // Keep panels expanded by default on desktop, collapsed on mobile
    const panels = document.querySelectorAll('.dashboard-panel');
    panels.forEach(panel => {
        if (isMobile) {
            panel.classList.add('collapsed');
            const icon = panel.querySelector('.panel-toggle i');
            if (icon) {
                icon.style.transform = 'rotate(-90deg)';
            }
        } else {
            panel.classList.remove('collapsed');
            const icon = panel.querySelector('.panel-toggle i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        }
    });
}

// === Initialize Event Listeners ===
function initEventListeners() {
    console.log('Initializing event listeners...');
    
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Desktop map controls
    const zoomInBtn = document.getElementById('zoomInBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (map) map.zoomIn();
        });
    }
    
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (map) map.zoomOut();
        });
    }
    
    // Map control location button
    const desktopMapLocationBtn = document.getElementById('desktopMapLocationBtn');
    if (desktopMapLocationBtn) {
        desktopMapLocationBtn.addEventListener('click', focusOnUser);
    }
    
    // Search functionality
    const searchToggle = document.getElementById('searchToggle');
    if (searchToggle) {
        searchToggle.addEventListener('click', toggleSearch);
    }
    
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    const searchStationBtn = document.getElementById('searchStationBtn');
    if (searchStationBtn) {
        searchStationBtn.addEventListener('click', toggleStationSearch);
    }
    
    const stationSearchForm = document.getElementById('stationSearchForm');
    if (stationSearchForm) {
        stationSearchForm.addEventListener('submit', handleStationSearch);
    }
    
    // Add real-time search for stations
    const stationSearchBox = document.getElementById('stationSearchBox');
    if (stationSearchBox) {
        stationSearchBox.addEventListener('input', function() {
            const query = this.value.trim();
            showSearchResults(query);
        });
    }
    
    // Refresh stations button
    const refreshStations = document.getElementById('refreshStations');
    if (refreshStations) {
        refreshStations.addEventListener('click', loadStations);
    }
    
    // Close station panel
    const closeStationPanel = document.getElementById('closeStationPanel');
    if (closeStationPanel) {
        closeStationPanel.addEventListener('click', function() {
            const panel = document.getElementById('selectedStationPanel');
            if (panel) {
                panel.style.display = 'none';
            }
            selectedStation = null;
            renderStationsList();
        });
    }
    
    // Mobile navigation (only on mobile)
    if (isMobile) {
        initMobileEventListeners();
    }
    
    // Close search when clicking outside
    document.addEventListener('click', function(e) {
        const searchContainer = document.querySelector('.search-container');
        const searchToggle = document.getElementById('searchToggle');
        const stationSearchContainer = document.querySelector('.station-search-container');
        const searchStationBtn = document.getElementById('searchStationBtn');
        
        if (searchContainer && searchToggle && 
            !searchContainer.contains(e.target) && 
            !searchToggle.contains(e.target)) {
            searchContainer.classList.remove('active');
        }
        
        if (stationSearchContainer && searchStationBtn && 
            !stationSearchContainer.contains(e.target) && 
            !searchStationBtn.contains(e.target)) {
            stationSearchContainer.classList.remove('active');
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    console.log('All event listeners initialized successfully');
}

// === Initialize Mobile Event Listeners ===
function initMobileEventListeners() {
    console.log('Initializing mobile event listeners...');
    
    const mobileFocusBtn = document.getElementById('mobileFocusBtn');
    if (mobileFocusBtn) {
        mobileFocusBtn.addEventListener('click', focusOnUser);
    }
    
    const mobileRefreshBtn = document.getElementById('mobileRefreshBtn');
    if (mobileRefreshBtn) {
        mobileRefreshBtn.addEventListener('click', loadStations);
    }
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', showMobileMenu);
    }
    
    const closeMenu = document.getElementById('closeMenu');
    if (closeMenu) {
        closeMenu.addEventListener('click', hideMobileMenu);
    }
    
    const overlay = document.querySelector('.mobile-menu-overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                hideMobileMenu();
            }
        });
    }
}

// === Handle Window Resize ===
function handleResize() {
    const wasMobile = isMobile;
    checkMobileDevice();
    
    if (wasMobile !== isMobile) {
        console.log('Device orientation changed, refreshing layout...');
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
        initDashboard();
        
        if (isMobile && !wasMobile) {
            initMobileEventListeners();
        }
    }
}

// === Mobile Menu Functions ===
function showMobileMenu() {
    console.log('Opening mobile menu...');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const overlayContent = document.querySelector('.overlay-content');
    
    if (!overlay || !overlayContent) return;
    
    // Clone the desktop dashboard content
    const desktopDashboard = document.querySelector('.desktop-dashboard');
    if (desktopDashboard) {
        overlayContent.innerHTML = desktopDashboard.innerHTML;
        
        // Reinitialize panel toggles in overlay
        const panelToggles = overlayContent.querySelectorAll('.panel-toggle');
        panelToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const panel = this.closest('.dashboard-panel');
                panel.classList.toggle('collapsed');
                
                const icon = this.querySelector('i');
                if (icon) {
                    if (panel.classList.contains('collapsed')) {
                        icon.style.transform = 'rotate(-90deg)';
                    } else {
                        icon.style.transform = 'rotate(0deg)';
                    }
                }
            });
        });
        
        // Reattach event listeners for cloned elements
        const refreshBtn = overlayContent.querySelector('#refreshStations');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                loadStations();
                hideMobileMenu();
            });
        }
        
        const closeStationPanel = overlayContent.querySelector('#closeStationPanel');
        if (closeStationPanel) {
            closeStationPanel.addEventListener('click', function() {
                const panel = document.getElementById('selectedStationPanel');
                if (panel) {
                    panel.style.display = 'none';
                }
                selectedStation = null;
                renderStationsList();
                hideMobileMenu();
            });
        }
        
        // Reattach station item click listeners
        const stationItems = overlayContent.querySelectorAll('.station-item');
        stationItems.forEach(item => {
            item.addEventListener('click', function() {
                const stationId = this.getAttribute('data-station-id');
                const station = stations.find(s => s.id === stationId);
                if (station) {
                    selectStation(station);
                    moveToStationLocation(station);
                    hideMobileMenu();
                }
            });
        });
        
        // Keep panels collapsed by default in mobile overlay
        const panels = overlayContent.querySelectorAll('.dashboard-panel');
        panels.forEach(panel => {
            panel.classList.add('collapsed');
            const icon = panel.querySelector('.panel-toggle i');
            if (icon) {
                icon.style.transform = 'rotate(-90deg)';
            }
        });
    }
    
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    console.log('Mobile menu opened');
}

function hideMobileMenu() {
    console.log('Closing mobile menu...');
    const overlay = document.querySelector('.mobile-menu-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
    console.log('Mobile menu closed');
}

// === Load Stations - ONLY REAL DATA FROM DATABASE ===
async function loadStations() {
    console.log('Loading stations from database...');
    
    try {
        const stationsList = document.getElementById('stationsList');
        const refreshBtn = document.getElementById('refreshStations');
        
        if (stationsList) {
            stationsList.innerHTML = '<div class="loading-stations">Checking database...</div>';
        }
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }
        
        // Fetch data from flood_data table
        const { data: floodData, error } = await supabase
            .from('flood_data')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error loading flood_data:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log('Raw data from database:', floodData);

        // Check if we have ANY data at all
        if (!floodData || floodData.length === 0) {
            console.log('NO DATA FOUND in database');
            stations = [];
            
            if (stationsList) {
                stationsList.innerHTML = `
                    <div class="no-stations">
                        <i class="fas fa-database"></i>
                        <p>No Data Available</p>
                        <p class="station-help">Database is empty. Waiting for hardware connection.</p>
                        <div class="hardware-status">
                            <div class="status-indicator offline"></div>
                            <span>Database Empty</span>
                        </div>
                    </div>
                `;
            }
            
            updateStationMarkers();
            updateStationsCount();
            
            // Update footer
            const footer = document.querySelector('footer .footer-content');
            if (footer) {
                footer.innerHTML = '<i class="fas fa-satellite-dish"></i><span>HydroPole - Database Empty - Waiting for hardware...</span>';
            }
            
            showWaterLevelAlert('No data found in database. Waiting for hardware connection.', 'warning');
            
        } else {
            console.log(`Found ${floodData.length} records in database`);
            
            // Filter for records that have actual water level data and device_id
            const validData = floodData.filter(record => {
                const hasWaterLevel = record.water_level !== null && 
                                    record.water_level !== undefined && 
                                    !isNaN(parseFloat(record.water_level));
                
                const hasDeviceId = record.device_id && record.device_id.trim() !== '';
                
                // Check for valid GPS coordinates - THIS IS THE KEY FIX
                const hasValidGPS = record.gps_lat !== null && 
                                  record.gps_lng !== null &&
                                  !isNaN(parseFloat(record.gps_lat)) && 
                                  !isNaN(parseFloat(record.gps_lng)) &&
                                  parseFloat(record.gps_lat) !== 0 &&
                                  parseFloat(record.gps_lng) !== 0;
                
                console.log(`Record ${record.id}: water_level=${record.water_level}, device_id=${record.device_id}, gps_lat=${record.gps_lat}, gps_lng=${record.gps_lng}, valid=${hasWaterLevel && hasDeviceId && hasValidGPS}`);
                
                return hasWaterLevel && hasDeviceId && hasValidGPS;
            });

            console.log(`Found ${validData.length} valid records with water level data and GPS coordinates`);

            if (validData.length === 0) {
                // Data exists but no valid water level readings or GPS
                stations = [];
                
                if (stationsList) {
                    stationsList.innerHTML = `
                        <div class="no-stations">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>No Valid Data</p>
                            <p class="station-help">Database has records but no valid water level readings or GPS coordinates.</p>
                            <div class="hardware-status">
                                <div class="status-indicator offline"></div>
                                <span>Invalid Data Format</span>
                            </div>
                        </div>
                    `;
                }
                
                showWaterLevelAlert('Database has records but no valid water level data or GPS coordinates.', 'warning');
            } else {
                // WE HAVE REAL VALID DATA WITH GPS COORDINATES
                // Group by device_id to get unique stations with their latest data
                const stationMap = new Map();
                
                validData.forEach(record => {
                    const deviceId = record.device_id;
                    
                    // Only add if not already added (this gives us the latest record for each device)
                    if (!stationMap.has(deviceId)) {
                        const waterLevel = parseFloat(record.water_level);
                        const waterLevelFeet = metersToFeet(waterLevel);
                        
                        // USE REAL GPS COORDINATES FROM DATABASE - NO FALLBACK
                        const lat = parseFloat(record.gps_lat);
                        const lng = parseFloat(record.gps_lng);
                        
                        console.log(`📡 Setting coordinates for ${deviceId}: ${lat}, ${lng}`);
                        
                        // Determine status based on water level
                        const waterLevelStatus = getWaterLevelColor(waterLevelFeet);
                        
                        stationMap.set(deviceId, {
                            id: record.id,
                            device_id: deviceId,
                            name: `Station ${deviceId}`,
                            location: getLocationFromStatus(waterLevelStatus),
                            latitude: lat,
                            longitude: lng,
                            water_level: waterLevel,
                            water_level_feet: waterLevelFeet,
                            status: waterLevelStatus,
                            message: record.message || 'Normal operation',
                            last_communication: record.timestamp,
                            // Add raw GPS data for debugging
                            raw_gps_lat: record.gps_lat,
                            raw_gps_lng: record.gps_lng
                        });
                    }
                });
                
                // Convert to array
                stations = Array.from(stationMap.values());
                
                console.log(`✅ Loaded ${stations.length} stations from database with REAL GPS coordinates:`, stations);
                
                // Debug: Log coordinates for HYDROPOLE_001 specifically
                const hydropole001 = stations.find(s => s.device_id === 'HYDROPOLE_001');
                if (hydropole001) {
                    console.log(`🎯 HYDROPOLE_001 Real Coordinates: ${hydropole001.latitude}, ${hydropole001.longitude}`);
                    console.log(`🎯 HYDROPOLE_001 Raw GPS: ${hydropole001.raw_gps_lat}, ${hydropole001.raw_gps_lng}`);
                }
                
                if (stations.length === 0) {
                    if (stationsList) {
                        stationsList.innerHTML = `
                            <div class="no-stations">
                                <i class="fas fa-map-marker-alt"></i>
                                <p>No Station Locations</p>
                                <p class="station-help">Data exists but no valid GPS coordinates.</p>
                            </div>
                        `;
                    }
                } else {
                    showWaterLevelAlert(`Loaded ${stations.length} station(s) from database with real GPS coordinates`, 'success');
                    
                    // Update footer
                    const footer = document.querySelector('footer .footer-content');
                    if (footer) {
                        footer.innerHTML = `<i class="fas fa-satellite-dish"></i><span>HydroPole - ${stations.length} station(s) with live GPS</span>`;
                    }
                }
            }
        }
        
        // Update selected station if it still exists
        if (selectedStation) {
            const updatedStation = stations.find(s => s.id === selectedStation.id);
            if (updatedStation) {
                selectedStation = updatedStation;
                updateSelectedStationPanel();
            } else {
                // Selected station no longer exists, hide panel
                const panel = document.getElementById('selectedStationPanel');
                if (panel) {
                    panel.style.display = 'none';
                }
                selectedStation = null;
            }
        }
        
        renderStationsList();
        updateStationMarkers();
        updateStationsCount();
        
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    } catch (error) {
        console.error('Error loading stations:', error);
        showWaterLevelAlert('Error loading stations: ' + error.message, 'error');
        const refreshBtn = document.getElementById('refreshStations');
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
        const stationsList = document.getElementById('stationsList');
        if (stationsList) {
            stationsList.innerHTML = `
                <div class="no-stations">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error Loading Data</p>
                    <p class="station-help">${error.message}</p>
                    <button class="add-station-btn" onclick="loadStations()">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Helper function to get location from status
function getLocationFromStatus(status) {
    const statusMap = {
        'safe': 'Normal Water Level',
        'warning': 'Elevated Water Level', 
        'danger': 'Flood Warning Area'
    };
    return statusMap[status] || 'Monitoring Location';
}

// === Get Station Status ===
function getStationStatus(station) {
    if (!station.last_communication) return 'offline';
    
    const lastUpdate = new Date(station.last_communication);
    const now = new Date();
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
    
    if (minutesSinceUpdate > 60) return 'offline';
    if (minutesSinceUpdate > 15) return 'warning';
    
    return station.status || 'offline';
}

// === Render Stations List ===
function renderStationsList() {
    const stationsList = document.getElementById('stationsList');
    if (!stationsList) return;
    
    if (stations.length === 0) {
        // No stations with real data
        stationsList.innerHTML = `
            <div class="no-stations">
                <i class="fas fa-plug"></i>
                <p>No Stations Available</p>
                <p class="station-help">No data found in database</p>
                <div class="hardware-status">
                    <div class="status-indicator offline"></div>
                    <span>No Data</span>
                </div>
            </div>
        `;
        return;
    }
    
    // We have stations with real data
    stationsList.innerHTML = stations.map(station => {
        const waterLevelFeet = station.water_level_feet || metersToFeet(station.water_level);
        const waterLevelColor = getWaterLevelColor(waterLevelFeet);
        
        return `
        <div class="station-item ${selectedStation?.id === station.id ? 'active' : ''}" 
             data-station-id="${station.id}"
             data-lat="${station.latitude}"
             data-lng="${station.longitude}">
            <div class="station-info">
                <div class="station-name">${station.name}</div>
                <div class="station-location">${station.location}</div>
                <div class="station-coordinates">${parseFloat(station.latitude).toFixed(4)}, ${parseFloat(station.longitude).toFixed(4)}</div>
                <div class="station-data">
                    <span class="water-level-badge ${waterLevelColor}">${station.water_level !== null ? waterLevelFeet.toFixed(2) + ' ft' : 'No data'}</span>
                    <span class="data-source-badge">LIVE</span>
                </div>
            </div>
            <div class="station-status ${getStationStatus(station)}" title="${getStationStatus(station).toUpperCase()}"></div>
        </div>
        `;
    }).join('');
    
    // Add event listeners to station items
    const stationItems = stationsList.querySelectorAll('.station-item');
    stationItems.forEach(item => {
        item.addEventListener('click', function() {
            const stationId = this.getAttribute('data-station-id');
            const station = stations.find(s => s.id === stationId);
            if (station) {
                selectStation(station);
                moveToStationLocation(station);
            }
        });
    });
}

// === Move to Station Location ===
function moveToStationLocation(station) {
    if (!map || !station.latitude || !station.longitude) return;
    
    console.log(`Moving to station location: ${station.name} at ${station.latitude}, ${station.longitude}`);
    
    const stationLatLng = [parseFloat(station.latitude), parseFloat(station.longitude)];
    const zoomLevel = 16; // Close zoom level to focus on the station
    
    // Use flyTo for smooth animation to the station location
    map.flyTo(stationLatLng, zoomLevel, {
        duration: 1.5, // Animation duration in seconds
        easeLinearity: 0.25
    });
    
    // Highlight the station marker
    highlightStationMarker(station);
    
    showWaterLevelAlert(`Moved to ${station.name} location`, 'success');
}

// === Highlight Station Marker ===
function highlightStationMarker(station) {
    // Remove any existing highlights
    stationMarkers.forEach(marker => {
        const icon = marker.getIcon();
        if (icon.options.className && icon.options.className.includes('highlighted')) {
            // Reset to normal icon
            const status = getStationStatus(station);
            const newIcon = createStationMarkerIcon(station, status);
            marker.setIcon(newIcon);
        }
    });
    
    // Find and highlight the selected station marker
    const stationMarker = stationMarkers.find(marker => {
        const markerLatLng = marker.getLatLng();
        const stationLat = parseFloat(station.latitude);
        const stationLng = parseFloat(station.longitude);
        
        return Math.abs(markerLatLng.lat - stationLat) < 0.0001 && 
               Math.abs(markerLatLng.lng - stationLng) < 0.0001;
    });
    
    if (stationMarker) {
        // Create highlighted icon
        const status = getStationStatus(station);
        const highlightedIcon = createStationMarkerIcon(station, status, true);
        stationMarker.setIcon(highlightedIcon);
        
        // Open popup after animation
        setTimeout(() => {
            stationMarker.openPopup();
        }, 1600);
    }
}

// === Create Station Marker Icon (with highlight option) ===
function createStationMarkerIcon(station, status, isHighlighted = false) {
    const highlightClass = isHighlighted ? 'highlighted' : '';
    const waterLevelFeet = station.water_level_feet || metersToFeet(station.water_level);
    const waterLevelColor = getWaterLevelColor(waterLevelFeet);
    
    return L.divIcon({
        className: `station-marker ${highlightClass}`,
        html: `
            <div class="station-pulse ${waterLevelColor} ${highlightClass}"></div>
            <div class="station-dot ${waterLevelColor} ${highlightClass}"></div>
            <div class="station-marker-label ${highlightClass}">${station.water_level !== null ? waterLevelFeet.toFixed(1) + 'ft' : '--'}</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// === Update Station Markers on Map ===
function updateStationMarkers() {
    if (!map) return;
    
    // Clear existing markers
    stationMarkers.forEach(marker => map.removeLayer(marker));
    stationMarkers = [];
    
    // Only add markers if we have stations
    if (stations.length > 0) {
        stations.forEach(station => {
            if (station.latitude && station.longitude) {
                const marker = createStationMarker(station);
                stationMarkers.push(marker);
                marker.addTo(map);
            }
        });
        console.log(`Added ${stationMarkers.length} station markers to map`);
    } else {
        console.log('No station markers added - no stations available');
    }
}

// === Create Station Marker ===
function createStationMarker(station) {
    const status = getStationStatus(station);
    
    const stationIcon = createStationMarkerIcon(station, status);
    
    const marker = L.marker([parseFloat(station.latitude), parseFloat(station.longitude)], {
        icon: stationIcon
    });
    
    // Add enhanced popup with station info
    const popupContent = createEnhancedStationPopupContent(station);
    marker.bindPopup(popupContent, {
        className: 'station-popup-enhanced',
        maxWidth: 300
    });
    
    // Add click event to select station
    marker.on('click', function() {
        selectStation(station);
        moveToStationLocation(station);
    });
    
    return marker;
}

// === Create Enhanced Station Popup Content ===
function createEnhancedStationPopupContent(station) {
    const status = getStationStatus(station);
    const waterLevelFeet = station.water_level_feet || metersToFeet(station.water_level);
    const waterLevelColor = getWaterLevelColor(waterLevelFeet);
    const waterLevelStatus = getWaterLevelStatus(waterLevelFeet);
    const lastUpdate = station.last_communication ? new Date(station.last_communication) : null;
    const timeAgo = lastUpdate ? getTimeAgo(lastUpdate) : 'Never';
    
    // Show real GPS coordinates with high precision
    const displayLat = parseFloat(station.latitude).toFixed(6);
    const displayLng = parseFloat(station.longitude).toFixed(6);
    
    return `
        <div class="enhanced-popup-container">
            <div class="enhanced-popup-header">
                <div class="enhanced-popup-icon">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="enhanced-popup-title-section">
                    <div class="enhanced-popup-title">${station.name}</div>
                    <div class="enhanced-popup-subtitle">Live Monitoring Station</div>
                </div>
            </div>
            
            <div class="enhanced-popup-divider"></div>
            
            <div class="enhanced-popup-content">
                <div class="enhanced-info-grid">
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon water-level">
                            <i class="fas fa-water"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Water Level</div>
                            <div class="enhanced-info-value level-value">${waterLevelFeet.toFixed(2)} ft</div>
                            <div class="enhanced-level-status ${waterLevelColor}">${waterLevelStatus}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Live GPS Coordinates</div>
                            <div class="enhanced-info-value coordinates">${displayLat}, ${displayLng}</div>
                            <div class="enhanced-info-date">Real-time location</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Last Updated</div>
                            <div class="enhanced-info-value">${timeAgo}</div>
                            <div class="enhanced-info-date">${lastUpdate ? lastUpdate.toLocaleDateString() : 'Never'}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-id-card"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Device ID</div>
                            <div class="enhanced-info-value">${station.device_id}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="enhanced-popup-footer">
                <div class="enhanced-accuracy-info">
                    <i class="fas fa-satellite"></i>
                    Real-time GPS • Live Monitoring
                </div>
            </div>
        </div>
    `;
}

// === Select Station ===
function selectStation(station) {
    console.log('Selecting station:', station);
    
    selectedStation = station;
    
    // Update UI
    updateSelectedStationPanel();
    highlightSelectedStation();
    
    // Show station panel
    const stationPanel = document.getElementById('selectedStationPanel');
    if (stationPanel) {
        stationPanel.style.display = 'block';
    }
    
    if (isMobile) {
        hideMobileMenu();
    }
    
    // Close search if open
    const stationSearchContainer = document.querySelector('.station-search-container');
    if (stationSearchContainer) {
        stationSearchContainer.classList.remove('active');
    }
    
    showWaterLevelAlert(`Selected station: ${station.name}`, 'info');
}

// === Update Selected Station Panel ===
function updateSelectedStationPanel() {
    if (!selectedStation) return;
    
    const titleEl = document.getElementById('selectedStationTitle');
    const nameEl = document.getElementById('selectedStationName');
    const locationEl = document.getElementById('selectedStationLocation');
    const idEl = document.getElementById('selectedStationId');
    const coordsEl = document.getElementById('selectedStationCoordinates');
    const waterLevelEl = document.getElementById('selectedStationWaterLevel');
    const statusEl = document.getElementById('selectedStationStatus');
    const lastUpdateEl = document.getElementById('selectedStationLastUpdate');
    const deviceStatusEl = document.getElementById('selectedStationDeviceStatus');
    
    if (titleEl) titleEl.textContent = 'Station Data';
    if (nameEl) nameEl.textContent = selectedStation.name;
    if (locationEl) locationEl.textContent = selectedStation.location;
    if (idEl) idEl.textContent = `Device ID: ${selectedStation.device_id}`;
    if (coordsEl) {
        coordsEl.textContent = `${parseFloat(selectedStation.latitude).toFixed(6)}, ${parseFloat(selectedStation.longitude).toFixed(6)}`;
    }
    
    // Update water level data - ONLY show if we have real data
    if (selectedStation.water_level !== null && selectedStation.water_level !== undefined) {
        const waterLevel = parseFloat(selectedStation.water_level);
        if (!isNaN(waterLevel)) {
            // REAL DATA FROM DATABASE - Convert to feet
            const waterLevelFeet = selectedStation.water_level_feet || metersToFeet(waterLevel);
            const waterLevelColor = getWaterLevelColor(waterLevelFeet);
            const waterLevelStatus = getWaterLevelStatus(waterLevelFeet);
            
            if (waterLevelEl) {
                waterLevelEl.textContent = `${waterLevelFeet.toFixed(2)} ft`;
                waterLevelEl.className = `data-value water-level-${waterLevelColor}`;
                waterLevelEl.style.fontWeight = 'bold';
            }
            
            if (statusEl) {
                statusEl.textContent = waterLevelStatus;
                statusEl.className = `badge ${waterLevelColor}`;
            }
            
            if (deviceStatusEl) {
                deviceStatusEl.textContent = 'Connected - Live Data';
                deviceStatusEl.style.color = 'var(--safe-green)';
            }
        }
    } else {
        // No real data
        if (waterLevelEl) {
            waterLevelEl.textContent = 'No data available';
            waterLevelEl.className = 'data-value';
            waterLevelEl.style.color = 'var(--text-500)';
        }
        if (statusEl) {
            statusEl.textContent = 'OFFLINE';
            statusEl.className = 'badge';
        }
        if (deviceStatusEl) {
            deviceStatusEl.textContent = 'No Data Available';
            deviceStatusEl.style.color = 'var(--warning-red)';
        }
    }
    
    // Update last communication
    if (selectedStation.last_communication) {
        const lastUpdate = new Date(selectedStation.last_communication);
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `${lastUpdate.toLocaleDateString()} ${lastUpdate.toLocaleTimeString()}`;
        }
    } else {
        if (lastUpdateEl) lastUpdateEl.textContent = 'Never';
    }
}

// === Highlight Selected Station ===
function highlightSelectedStation() {
    renderStationsList();
}

// === Get Status Text ===
function getStatusText(status) {
    const statusMap = {
        'online': 'ONLINE',
        'offline': 'OFFLINE',
        'warning': 'WARNING',
        'error': 'DANGER',
        'safe': 'SAFE',
        'danger': 'DANGER'
    };
    return statusMap[status] || 'UNKNOWN';
}

// === Get Time Ago ===
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 8640000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// === Update Stations Count ===
function updateStationsCount() {
    const onlineStations = stations.filter(station => getStationStatus(station) !== 'offline').length;
    const totalStations = stations.length;
    
    const countElement = document.getElementById('stationsCount');
    if (!countElement) return;
    
    if (totalStations === 0) {
        countElement.textContent = 'No Stations';
        countElement.style.color = 'var(--warning-red)';
    } else {
        countElement.textContent = `${onlineStations}/${totalStations} Stations Online`;
        
        // Update badge color based on status
        if (onlineStations === totalStations) {
            countElement.style.color = 'var(--safe-green)';
        } else if (onlineStations === 0) {
            countElement.style.color = 'var(--warning-red)';
        } else {
            countElement.style.color = 'var(--alert-orange)';
        }
    }
}

// === Initialize Real-time Subscriptions ===
function initRealTimeSubscriptions() {
    // Subscribe to changes in flood_data table for real-time updates
    const floodSubscription = supabase
        .channel('flood_data_changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'flood_data' 
            }, 
            (payload) => {
                console.log('Real-time flood_data update:', payload);
                handleFloodDataUpdate(payload);
            }
        )
        .subscribe();
    
    console.log('✅ Real-time subscription initialized for flood_data');
}

// === Handle Real-time Flood Data Updates ===
function handleFloodDataUpdate(payload) {
    const eventType = payload.eventType;
    const newRecord = payload.new;
    
    if (!eventType) {
        console.warn('Unknown payload structure:', payload);
        return;
    }
    
    switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
            console.log('New/Updated flood data received:', newRecord);
            
            // Check if this is real data with valid water level AND GPS coordinates
            if (newRecord && 
                newRecord.water_level !== null && 
                !isNaN(parseFloat(newRecord.water_level)) &&
                newRecord.gps_lat !== null &&
                newRecord.gps_lng !== null &&
                !isNaN(parseFloat(newRecord.gps_lat)) &&
                !isNaN(parseFloat(newRecord.gps_lng))) {
                
                // This is REAL data from database with GPS
                console.log(`📍 New GPS coordinates for ${newRecord.device_id}: ${newRecord.gps_lat}, ${newRecord.gps_lng}`);
                
                loadStations(); // Reload to get latest data with new GPS
                
                const waterLevelFeet = metersToFeet(parseFloat(newRecord.water_level));
                const waterLevelColor = getWaterLevelColor(waterLevelFeet);
                
                // Show alert for important status changes
                if (waterLevelColor === 'danger') {
                    showWaterLevelAlert(`🚨 DANGER: High water level (${waterLevelFeet.toFixed(2)} ft) at ${newRecord.device_id || 'Unknown Device'}`, 'error');
                } else if (waterLevelColor === 'warning') {
                    showWaterLevelAlert(`⚠️ ALERT: Elevated water level (${waterLevelFeet.toFixed(2)} ft) at ${newRecord.device_id || 'Unknown Device'}`, 'warning');
                } else {
                    showWaterLevelAlert(`✅ New data received from ${newRecord.device_id}`, 'success');
                }
            } else {
                console.log('Incomplete data received - missing water level or GPS coordinates');
            }
            break;
            
        default:
            loadStations(); // Reload for any other event type
            break;
    }
}

// === Request User Location ===
function requestUserLocation() {
    if (!navigator.geolocation) {
        showWaterLevelAlert('Geolocation is not supported by your browser', 'warning');
        return;
    }
    
    console.log('Requesting user location...');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log('📍 Initial location found:', latitude, longitude);
            
            const zoomLevel = isMobile ? 15 : 15;
            if (map) {
                map.setView([latitude, longitude], zoomLevel);
            }
            createUserLocationMarker(latitude, longitude);
        },
        (error) => {
            console.error('Error getting location:', error);
            let message = 'Unable to get your location';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location access denied. Please enable location permissions.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
            }
            showWaterLevelAlert(message, 'warning');
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
    
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            updateUserLocationMarker(latitude, longitude);
        },
        (error) => {
            console.error('Error watching location:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000,
            distanceFilter: 5
        }
    );
}

// === Create User Location Marker ===
function createUserLocationMarker(lat, lng) {
    if (!map) return;
    
    console.log('Creating user marker at:', lat, lng);
    
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    if (userLocationCircle) map.removeLayer(userLocationCircle);
    
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div class="user-pulse-outer"></div>
            <div class="user-pulse-inner"></div>
            <div class="user-dot"></div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    userLocationCircle = L.circle([lat, lng], {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 2,
        radius: isMobile ? 20 : 25
    }).addTo(map);
    
    userLocationMarker = L.marker([lat, lng], { 
        icon: userIcon
    }).addTo(map);
    
    const popupContent = createUserPopupContent(lat, lng);
    userLocationMarker.bindPopup(popupContent, {
        className: 'user-popup-enhanced',
        maxWidth: isMobile ? 280 : 300,
        autoClose: true
    });
    
    console.log('✅ User location marker created');
}

// === Create Enhanced User Popup Content ===
function createUserPopupContent(lat, lng) {
    // Get location name using reverse geocoding
    getLocationName(lat, lng).then(locationName => {
        const freshPopupContent = createEnhancedPopupContent(lat, lng, locationName);
        if (userLocationMarker) {
            userLocationMarker.setPopupContent(freshPopupContent);
        }
    });
    
    return createEnhancedPopupContent(lat, lng, 'Loading address...');
}

// === Create Enhanced Popup Content with Location Name ===
function createEnhancedPopupContent(lat, lng, locationName) {
    return `
        <div class="enhanced-popup-container">
            <div class="enhanced-popup-header">
                <div class="enhanced-popup-icon">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="enhanced-popup-title-section">
                    <div class="enhanced-popup-title">Your Current Location</div>
                    <div class="enhanced-popup-subtitle">Live GPS Position</div>
                </div>
            </div>
            
            <div class="enhanced-popup-divider"></div>
            
            <div class="enhanced-popup-content">
                <div class="enhanced-info-grid">
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Coordinates</div>
                            <div class="enhanced-info-value coordinates">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Last Updated</div>
                            <div class="enhanced-info-value">${new Date().toLocaleTimeString()}</div>
                            <div class="enhanced-info-date">${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-location-dot"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Location</div>
                            <div class="enhanced-info-value location">${locationName}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="enhanced-popup-footer">
                <div class="enhanced-accuracy-info">
                    <i class="fas fa-satellite"></i>
                    GPS Active • Real-time Tracking
                </div>
            </div>
        </div>
    `;
}

// === Get Location Name from Coordinates ===
async function getLocationName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.display_name) {
            const parts = data.display_name.split(',');
            if (parts.length >= 2) {
                return parts[0] + ', ' + parts[1];
            }
            return data.display_name;
        }
        return 'Unknown Location';
    } catch (error) {
        console.error('Error getting location name:', error);
        return 'Location unavailable';
    }
}

// === Update User Location Marker ===
function updateUserLocationMarker(lat, lng) {
    if (userLocationMarker && userLocationCircle && map) {
        userLocationMarker.setLatLng([lat, lng]);
        userLocationCircle.setLatLng([lat, lng]);
        
        getLocationName(lat, lng).then(locationName => {
            const freshPopupContent = createEnhancedPopupContent(lat, lng, locationName);
            userLocationMarker.setPopupContent(freshPopupContent);
        });
    }
}

// === Focus on User - FIXED VERSION ===
function focusOnUser() {
    console.log('Focus on user clicked');
    
    if (userLocationMarker && map) {
        const latlng = userLocationMarker.getLatLng();
        const zoomLevel = isMobile ? 16 : 16;
        console.log('Focusing on user location:', latlng);
        
        map.setView(latlng, zoomLevel);
        
        if (isMobile) {
            userLocationMarker.openPopup();
            hideMobileMenu();
        }
        
        showWaterLevelAlert('Centered map on your location', 'success');
    } else {
        console.log('User location not available, requesting location...');
        showWaterLevelAlert('Your location is not available. Requesting location...', 'warning');
        
        // Try to request location again with better error handling
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    console.log('📍 New location found:', latitude, longitude);
                    
                    const zoomLevel = isMobile ? 16 : 16;
                    if (map) {
                        map.setView([latitude, longitude], zoomLevel);
                        createUserLocationMarker(latitude, longitude);
                        
                        // Open popup after a delay
                        setTimeout(() => {
                            if (userLocationMarker) {
                                userLocationMarker.openPopup();
                            }
                        }, 500);
                    }
                    
                    showWaterLevelAlert('Location found! Centered map on your location', 'success');
                },
                (error) => {
                    console.error('Error getting location:', error);
                    let message = 'Unable to get your location';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location access denied. Please enable location permissions in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information unavailable. Please check your GPS signal.';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out. Please try again.';
                            break;
                    }
                    showWaterLevelAlert(message, 'error');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            showWaterLevelAlert('Geolocation is not supported by your browser', 'error');
        }
    }
}

// === Search Functions ===
function toggleSearch() {
    const searchContainer = document.querySelector('.search-container');
    const stationSearchContainer = document.querySelector('.station-search-container');
    
    if (stationSearchContainer) {
        stationSearchContainer.classList.remove('active');
    }
    
    if (searchContainer) {
        searchContainer.classList.toggle('active');
        
        if (searchContainer.classList.contains('active')) {
            const searchBox = document.getElementById('searchBox');
            if (searchBox) {
                setTimeout(() => searchBox.focus(), 100);
            }
        }
    }
}

function toggleStationSearch() {
    const stationSearchContainer = document.querySelector('.station-search-container');
    const searchContainer = document.querySelector('.search-container');
    
    if (searchContainer) {
        searchContainer.classList.remove('active');
    }
    
    if (stationSearchContainer) {
        stationSearchContainer.classList.toggle('active');
        
        if (stationSearchContainer.classList.contains('active')) {
            const stationSearchBox = document.getElementById('stationSearchBox');
            if (stationSearchBox) {
                setTimeout(() => stationSearchBox.focus(), 100);
            }
        }
    }
}

// Show search results as user types
function showSearchResults(query) {
    const resultsContainer = document.getElementById('stationSearchResults');
    if (!resultsContainer) return;
    
    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    const filteredStations = stations.filter(station => 
        station.device_id && station.device_id.toUpperCase().includes(query.toUpperCase()) ||
        station.name && station.name.toUpperCase().includes(query.toUpperCase())
    );
    
    if (filteredStations.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No stations found</div>';
        return;
    }
    
    resultsContainer.innerHTML = filteredStations.map(station => `
        <div class="search-result-item" onclick="selectStationFromSearch('${station.id}')">
            <div class="result-station-name">${station.name}</div>
            <div class="result-station-id">${station.device_id}</div>
            <div class="result-station-location">${station.location}</div>
        </div>
    `).join('');
}

// Global function for search result selection
window.selectStationFromSearch = function(stationId) {
    const station = stations.find(s => s.id === stationId);
    if (station) {
        const stationSearchContainer = document.querySelector('.station-search-container');
        if (stationSearchContainer) {
            stationSearchContainer.classList.remove('active');
        }
        const stationSearchBox = document.getElementById('stationSearchBox');
        if (stationSearchBox) {
            stationSearchBox.value = '';
        }
        selectStation(station);
        moveToStationLocation(station);
    }
};

function handleStationSearch(e) {
    e.preventDefault();
    const stationSearchBox = document.getElementById('stationSearchBox');
    if (!stationSearchBox) return;
    
    const query = stationSearchBox.value.trim();
    
    if (query) {
        searchStation(query);
    } else {
        showWaterLevelAlert('Please enter a station ID to search', 'warning');
    }
}

function searchStation(query) {
    if (!map) return;
    
    const foundStation = stations.find(s => 
        s.device_id && s.device_id.toUpperCase().includes(query.toUpperCase()) ||
        s.name && s.name.toUpperCase().includes(query.toUpperCase())
    );
    
    if (foundStation) {
        // Close search first
        const stationSearchContainer = document.querySelector('.station-search-container');
        if (stationSearchContainer) {
            stationSearchContainer.classList.remove('active');
        }
        const stationSearchBox = document.getElementById('stationSearchBox');
        if (stationSearchBox) {
            stationSearchBox.value = '';
        }
        
        // Then select and focus on the station
        selectStation(foundStation);
        moveToStationLocation(foundStation);
        showWaterLevelAlert(`Found station: ${foundStation.name}`, 'success');
    } else {
        showWaterLevelAlert(`Station "${query}" not found`, 'warning');
    }
}

function handleSearch(e) {
    e.preventDefault();
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;
    
    const query = searchBox.value.trim();
    
    if (query) {
        searchLocation(query);
    } else {
        showWaterLevelAlert('Please enter a location to search', 'warning');
    }
}

function searchLocation(query) {
    if (!map) return;
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                map.flyTo([lat, lon], 15);
                
                const marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`<b>${result.display_name}</b>`)
                    .openPopup();
                
                setTimeout(() => {
                    map.removeLayer(marker);
                }, 10000);
                
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) {
                    searchContainer.classList.remove('active');
                }
                const searchBox = document.getElementById('searchBox');
                if (searchBox) {
                    searchBox.value = '';
                }
                
                if (isMobile) {
                    hideMobileMenu();
                }
            } else {
                showWaterLevelAlert('Location not found. Please try a different search term.', 'warning');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            showWaterLevelAlert('Search failed. Please try again.', 'error');
        });
}

// === Alert Functions ===
function addWaterLevelAlert(message, type = 'info') {
    const alertList = document.getElementById('alertList');
    if (!alertList) return;
    
    const alertItem = document.createElement('div');
    alertItem.className = 'alert-item';
    
    const iconClass = type === 'info' ? 'fa-info-circle' : 
                     type === 'success' ? 'fa-check-circle' : 
                     type === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle';
    
    alertItem.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    alertList.insertBefore(alertItem, alertList.firstChild);
    
    // Limit to 5 alerts
    while (alertList.children.length > 5) {
        alertList.removeChild(alertList.lastChild);
    }
}

function showWaterLevelAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert-toast');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert-toast ${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(alert);
    
    addWaterLevelAlert(message, type);
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// === Dark Mode ===
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        if (document.body.classList.contains('dark-mode')) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
    
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function loadDarkModePreference() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
}

// === Start Real-time Updates ===
function startRealTimeUpdates() {
    console.log('Setting up real-time database updates...');
    initRealTimeSubscriptions();
    
    // Refresh stations every 30 seconds to check for new data
    setInterval(() => {
        loadStations();
    }, 30000);
}

// === Clean up when page unloads ===
window.addEventListener('beforeunload', function() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});

// === Utility Functions ===
function metersToFeet(meters) {
    return meters * 3.28084;
}

// === Make functions globally available ===
window.selectStationFromPopup = function(stationId) {
    const station = stations.find(s => s.id === stationId);
    if (station) {
        selectStation(station);
        moveToStationLocation(station);
    }
};

window.focusOnUser = focusOnUser;
window.showWaterLevelAlert = showWaterLevelAlert;
window.hideMobileMenu = hideMobileMenu;
window.loadStations = loadStations;
window.moveToStationLocation = moveToStationLocation;