import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qhulkelhbhllcwwandes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodWxrZWxoYmhsbGN3d2FuZGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTg2MjUsImV4cCI6MjA3NjI5NDYyNX0.42UGFleZGnrE0GCc3F8jU69ernTCRu6np-uqDD5G2Rk';
const supabase = createClient(supabaseUrl, supabaseKey);


   const apiKey = "88a96b7da2208820a4b66471bcb2af02";
    const baseURL = window.location.origin;
    let stationMarkers = {};
    let userMarkers = [];

    // === Discreet User Location ===
    let watchId = null;
    let userLocationMarker = null;
    let userCircle = null;
    

    // === Initialize Map ===
    const map = L.map("map").setView([14.8479, 120.8287], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // === Utility Functions ===
    function createDeviceMarker(waterLevel, status) {
        const currentZoom = map.getZoom();
        
        let pinColor;
        switch(status) {
            case 'safe': pinColor = '#34a853'; break;
            case 'alert': pinColor = '#fbbc04'; break;
            case 'danger': pinColor = '#ef4444'; break;
            default: pinColor = '#6b7280';
        }

        let markerSize, fontSize;
        if (currentZoom >= 16) { markerSize = 40; fontSize = 12; }
        else if (currentZoom >= 14) { markerSize = 32; fontSize = 10; }
        else if (currentZoom >= 12) { markerSize = 24; fontSize = 8; }
        else { markerSize = 20; fontSize = 7; }

        return L.divIcon({
            className: "device-marker",
            html: `
                <div style="
                    background: ${pinColor};
                    width: ${markerSize}px;
                    height: ${markerSize}px;
                    border: 2px solid #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: #ffffff;
                    font-size: ${fontSize}px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    border-radius: 50%;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                ">
                    ${parseFloat(waterLevel).toFixed(1)}
                </div>
            `,
            iconSize: [markerSize, markerSize],
            iconAnchor: [markerSize/2, markerSize/2]
        });
    }

    function createUserMarker() {
        return L.divIcon({
            className: "user-marker",
            html: `
                <div style="
                    background: #ffff00;
                    width: 20px;
                    height: 20px;
                    border: 2px solid #000000;
                    border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    // === IMPROVED Location Functions ===
    function getGeolocationError(error) {
        switch(error.code) {
            case 1: return "Location access denied by user";
            case 2: return "Location information unavailable";
            case 3: return "Location request timed out";
            default: return "Unknown location error";
        }
    }



function startContinuousTracking() {
    console.log("🔄 Starting SMART location tracking...");
    
    if (!navigator.geolocation) {
        console.error("❌ Geolocation not supported");
        return;
    }

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }

    let lastGoodLocation = null;
    let poorAccuracyCount = 0;

    watchId = navigator.geolocation.watchPosition(
        function(position) {
            const accuracy = position.coords.accuracy;
            console.log(`📍 Location update - Accuracy: ${Math.round(accuracy)}m`);
            
            // STRATEGY: Only update when accuracy is good
            if (accuracy < 100) { // Good GPS accuracy
                lastGoodLocation = position.coords;
                poorAccuracyCount = 0;
                console.log("✅ Good GPS - updating location");
                showUserLocationOnMap(position.coords);
            } 
            else if (accuracy < 1000) { // Moderate accuracy
                lastGoodLocation = position.coords;
                poorAccuracyCount = 0;
                console.log("⚠️ Moderate accuracy - using location");
                showUserLocationOnMap(position.coords);
            }
            else { // Poor accuracy (IP-based)
                poorAccuracyCount++;
                console.warn(`🚫 Poor accuracy (${poorAccuracyCount}x) - keeping last good location`);
                
                // Only revert to poor location after multiple failures
                if (poorAccuracyCount > 3 && !lastGoodLocation) {
                    console.log("🔄 Using current poor location as fallback");
                    showUserLocationOnMap(position.coords);
                }
                else if (lastGoodLocation) {
                    console.log("📍 Showing last known good location");
                    showUserLocationOnMap(lastGoodLocation);
                }
            }
        },
        function(error) {
            console.error("❌ Location error:", getGeolocationError(error));
            // Keep showing last good location during errors
            if (lastGoodLocation) {
                console.log("⚠️ Error - keeping last good location visible");
                showUserLocationOnMap(lastGoodLocation);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
        }
    );
}

    // IMPROVED: Better location display with accuracy feedback
 function showUserLocationOnMap(coords) {
    const lat = coords.latitude;
    const lng = coords.longitude;

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
        console.error("❌ Invalid coordinates");
        return;
    }

    console.log(`📍 Showing location at: ${lat}, ${lng}`);

    // Remove existing marker
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }

    // Simple yellow dot marker
    const userIcon = L.divIcon({
        className: 'user-location-dot',
        html: `
            <div style="
                background: #ffff00;
                width: 20px;
                height: 20px;
                border: 3px solid #000000;
                border-radius: 50%;
                box-shadow: 0 2px 10px rgba(0,0,0,0.8);
            "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Add user marker
    userLocationMarker = L.marker([lat, lng], { 
        icon: userIcon,
        zIndexOffset: 1000
    }).addTo(map).bindPopup(`
        <div style="min-width: 200px;">
            <strong>📍 Your Location</strong><br>
            <small>Lat: ${lat.toFixed(6)}</small><br>
            <small>Lng: ${lng.toFixed(6)}</small><br>
            <em>Updated: ${new Date().toLocaleTimeString()}</em>
        </div>
    `);

    console.log("✅ User marker placed on map");
}






    // === Debug Functions ===
    function testLocation() {
        console.log("🧪 Testing location service...");
        
        if (!navigator.geolocation) {
            alert("❌ Geolocation not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const coords = position.coords;
                const accuracy = coords.accuracy;
                let accuracyMsg = "";
                
                if (accuracy <= 20) accuracyMsg = "Excellent (GPS)";
                else if (accuracy <= 100) accuracyMsg = "Good (WiFi+GPS)";
                else if (accuracy <= 500) accuracyMsg = "Moderate (WiFi)";
                else accuracyMsg = "Poor (IP-based)";
                
                alert(`✅ Location test successful!\n\nLatitude: ${coords.latitude.toFixed(6)}\nLongitude: ${coords.longitude.toFixed(6)}\nAccuracy: ${Math.round(accuracy)} meters\nStatus: ${accuracyMsg}`);
                console.log("📍 Test location:", coords);
                showUserLocationOnMap(coords);
            },
            function(error) {
                const errorMsg = getGeolocationError(error);
                alert(`❌ Location test failed:\n${errorMsg}\n\nPlease check:\n• Location permissions\n• GPS/WiFi connection\n• Browser settings`);
                console.error("Location test error:", error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }




    // === Other Existing Functions ===
    function getStatusFromLevel(waterLevel) {
        if (waterLevel >= 2.6) return { status: 'danger', message: 'CRITICAL: Flood evacuation advised' };
        if (waterLevel >= 1.1) return { status: 'alert', message: 'ALERT: Rising water levels detected' };
        return { status: 'safe', message: 'SAFE: Normal water levels' };
    }

async function fetchRealData() {
    try {
        console.log("🔄 Fetching REAL flood data...");
        const response = await fetch(`http://localhost/Hydro-pole/api/get_flood_data.php`);
        console.log("📡 API Response status:", response.status);
        
        const result = await response.json();
        console.log("📊 REAL DATA:", result);
        
        if (result.status === 'success') {
            console.log(`📍 Found ${result.data.length} REAL flood devices`);
            updateMapWithRealData(result.data);
            updateDisplayWithRealData(result.data); // ← ADD THIS LINE
        }
    } catch (error) {
        console.error('❌ Real data fetch failed:', error);
    }
}



function updateDisplayWithRealData(data) {
    if (!data || data.length === 0) {
        // Show "No data" message instead of test data
        document.getElementById("waterLevel").textContent = "0";
        document.getElementById("statusText").textContent = "NO DATA";
        document.getElementById("statusText").className = 'badge ok';
        document.getElementById("lastUpdate").textContent = "--:--:--";
        document.getElementById("historyList").innerHTML = "<li>No flood data available</li>";
        return;
    }


        const mostCritical = data.reduce((prev, current) => {
            const priority = { danger: 3, alert: 2, safe: 1 };
            return priority[current.status] > priority[prev.status] ? current : prev;
        });

        document.getElementById("waterLevel").textContent = mostCritical.water_level;
        document.getElementById("statusText").textContent = mostCritical.status.toUpperCase();
        document.getElementById("statusText").className = 'badge ' + 
            (mostCritical.status === 'danger' ? 'danger' : 
            mostCritical.status === 'alert' ? 'warn' : 'ok');
        document.getElementById("lastUpdate").textContent = new Date(mostCritical.timestamp).toLocaleString();

       
    }

 function updateHistoryList(historyData) {
    const historyList = document.getElementById("historyList");
    
    if (!historyData || historyData.length === 0) {
        historyList.innerHTML = "<li>No history data available</li>";
        return;
    }

    historyList.innerHTML = historyData.map(reading => `
        <li>
            <strong>${reading.device_name || reading.device_id}</strong><br>
            <strong>Water Level:</strong> ${reading.water_level} ft<br>
            <span class="badge ${reading.status === 'danger' ? 'danger' : reading.status === 'alert' ? 'warn' : 'ok'}">
                ${reading.status.toUpperCase()}
            </span><br>
            <small>${reading.message}</small><br>
            <small>${new Date(reading.timestamp).toLocaleString()}</small>
        </li>
    `).join('');
}

function updateMapWithRealData(data) {
    console.log("📍 updateMapWithRealData called with:", data);
    console.log("🔍 First device structure:", data[0]); // ADD THIS
    

    if (!data || !Array.isArray(data)) {
        console.error("❌ Invalid data received:", data);
        return;
    }

    // Clear old markers
    Object.values(stationMarkers).forEach(marker => {
        if (marker) map.removeLayer(marker);
    });
    stationMarkers = {};

    console.log(`📍 Processing ${data.length} devices...`);

    // Add device markers
    data.forEach(device => {
        const lat = parseFloat(device.current_lat);
        const lng = parseFloat(device.current_lng);
        const deviceId = device.device_id || "unknown";
        
        console.log(`📍 Device ${deviceId}:`, { 
            lat, lng, 
            status: device.status, 
            water_level: device.water_level 
        });

        if (!isNaN(lat) && !isNaN(lng)) {
            const marker = L.marker([lat, lng], {
                icon: createDeviceMarker(device.water_level, device.status)
            }).addTo(map).bindPopup(`
                <div style="min-width: 200px;">
                    <strong>${device.device_name || deviceId}</strong><br>
                    Level: ${device.water_level} ft<br>
                    Status: ${device.status}<br>
                    Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
                    ${device.timestamp ? new Date(device.timestamp).toLocaleString() : 'No timestamp'}
                </div>
            `);

            stationMarkers[deviceId] = marker;
            console.log(`✅ Added marker for device ${deviceId} at ${lat}, ${lng}`);
        } else {
            console.warn(`⚠️ Invalid coordinates for device ${deviceId}:`, { lat, lng });
        }
    });

    console.log(`✅ Loaded ${Object.keys(stationMarkers).length} device markers total`);
}


    // Search, Dark Mode, Alert functions remain the same...
    const searchForm = document.getElementById("searchForm");
    const searchBox = document.getElementById("searchBox");
    const searchResults = document.getElementById("searchResults");
    let searchMarker;

    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const query = searchBox.value.trim();
        if (!query) return;

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph`;
            const res = await fetch(url);
            const data = await res.json();

            searchResults.innerHTML = "";
            searchResults.style.display = "none";

            if (data.length === 0) {
                searchResults.innerHTML = `<div class="search-result">No results found.</div>`;
                searchResults.style.display = "block";
                return;
            }

            data.slice(0, 5).forEach(place => {
                const item = document.createElement("div");
                item.className = "search-result";
                item.textContent = place.display_name;
                item.addEventListener("click", () => {
                    const lat = parseFloat(place.lat);
                    const lon = parseFloat(place.lon);
                  

                    if (searchMarker) map.removeLayer(searchMarker);
                    searchMarker = L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: "search-marker",
                            html: `<div style="background:orange;width:25px;height:25px;border-radius:50%;border:2px solid #000;display:flex;align-items:center;justify-content:center;">📍</div>`,
                            iconSize: [25, 25],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(map).bindPopup(place.display_name).openPopup();

                    searchResults.style.display = "none";
                    searchBox.value = place.display_name;
                });
                searchResults.appendChild(item);
            });
            searchResults.style.display = "block";
        } catch (err) {
            console.error("Error searching location:", err);
        }
    });

    document.addEventListener("click", (e) => {
        const searchContainer = document.querySelector(".search");
        if (!searchContainer.contains(e.target)) {
            searchResults.style.display = "none";
        }
    });

    searchBox.addEventListener("input", () => {
        if (searchBox.value.trim()) {
            searchResults.style.display = "block";
        } else {
            searchResults.style.display = "none";
        }
    });

    const darkModeToggle = document.getElementById("darkModeToggle");
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        darkModeToggle.textContent = "☀️";
    }
    darkModeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        if (document.body.classList.contains("dark-mode")) {
            darkModeToggle.textContent = "☀️";
            localStorage.setItem("darkMode", "enabled");
        } else {
            darkModeToggle.textContent = "🌙";
            localStorage.setItem("darkMode", "disabled");
        }
    });


    function showAlert(level, message) {
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) existingAlert.remove();

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${level}`;
        alertDiv.innerHTML = `
            <strong>${level.toUpperCase()}:</ong> ${message}
            <button onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(alertDiv);

        if (level !== 'danger') {
            setTimeout(() => {
                if (alertDiv.parentElement) alertDiv.remove();
            }, 10000);
        }
    }



// === Initialize everything ===
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Initializing HydroPole System...");
    
    // Load initial data - ADD THESE LINES!
    console.log("🔵 Calling fetchRealData()...");
    fetchRealData();
    
    console.log("🔵 Calling loadFloodHistory()...");
    loadFloodHistory();
    

    
    // Start continuous location tracking
    console.log("📍 Starting continuous location tracking...");
    startContinuousTracking();

    // Set up refresh intervals
    setInterval(fetchRealData, 30000); // Update flood data every 30 seconds
   

    console.log('✅ HydroPole Flood Monitoring System initialized');
});

async function loadFloodHistory(deviceId = null) {
    try {
        let url = 'http://localhost/Hydro-pole/api/get_flood_history.php';
        if (deviceId) {
            url += `?device_id=${deviceId}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
            updateHistoryList(result.data);
            console.log(`📜 Loaded ${result.data.length} history records`);
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}


