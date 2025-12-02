// script.js

// Set current year in footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Set today's date as default in the form
document.getElementById('date').valueAsDate = new Date();

// Sample memories data (initially empty, will be loaded from localStorage)
let memories = [];
let markers = [];
let isRotating = true;
let markersVisible = true;
let countriesVisited = new Set();

// Three.js variables
let scene, camera, renderer, globe, controls, clouds;
let raycaster, mouse;
let hoveredMarker = null;

// Check if we have saved memories in localStorage
function loadMemories() {
    const savedMemories = localStorage.getItem('travelMemories');
    if (savedMemories) {
        memories = JSON.parse(savedMemories);
    } else {
        // Default sample memories for first-time users
        memories = [
            {
                id: 1,
                location: "Paris, France",
                lat: 48.8566,
                lng: 2.3522,
                date: "2023-06-15",
                text: "Visited the Eiffel Tower and had the most delicious croissants at a local bakery. The city lights at night were breathtaking!"
            },
            {
                id: 2,
                location: "Tokyo, Japan",
                lat: 35.6762,
                lng: 139.6503,
                date: "2022-11-03",
                text: "Experienced the vibrant Shibuya crossing and tried authentic sushi at Tsukiji market. The attention to detail in Japanese culture is amazing."
            },
            {
                id: 3,
                location: "New York, USA",
                lat: 40.7128,
                lng: -74.0060,
                date: "2023-09-22",
                text: "Saw a Broadway show and walked through Central Park in autumn. The city that never sleeps truly lives up to its name!"
            }
        ];
        saveMemories();
    }
    
    // Extract countries from memories
    memories.forEach(memory => {
        const locationParts = memory.location.split(', ');
        if (locationParts.length > 1) {
            countriesVisited.add(locationParts[1]);
        }
    });
}

// Save memories to localStorage
function saveMemories() {
    localStorage.setItem('travelMemories', JSON.stringify(memories));
}

// Initialize the globe
function initGlobe() {
    // Remove loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => loadingOverlay.remove(), 500);
        }, 1000);
    }
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1929);
    
    // Add stars
    addStars();
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, 
        document.getElementById('globeCanvas').clientWidth / 
        document.getElementById('globeCanvas').clientHeight, 
        0.1, 1000);
    camera.position.z = 2.5;
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('globeCanvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(
        document.getElementById('globeCanvas').clientWidth,
        document.getElementById('globeCanvas').clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    
    // Create the globe
    createGlobe();
    
    // Add markers for existing memories
    memories.forEach(memory => {
        addMarker(memory);
    });
    
    // Update stats and render list
    updateStats();
    renderMemoriesList();
    
    // Setup raycaster for mouse interactions
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Add mouse events for marker interaction
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    // Render loop
    animate();
    
    // Window resize handler
    window.addEventListener('resize', onWindowResize);
}

function addStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 2000;
        positions[i + 1] = (Math.random() - 0.5) * 2000;
        positions[i + 2] = (Math.random() - 0.5) * 2000;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function createGlobe() {
    // Earth geometry
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Earth material (using basic colors for demo - no external textures)
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x2a5c8a,
        specular: new THREE.Color(0x333333),
        shininess: 5,
        transparent: true,
        opacity: 0.95
    });
    
    // Earth mesh
    globe = new THREE.Mesh(geometry, earthMaterial);
    scene.add(globe);
    
    // Add land masses with a different color
    const landGeometry = new THREE.SphereGeometry(1.01, 64, 64);
    const landMaterial = new THREE.MeshPhongMaterial({
        color: 0x3a8c5a,
        transparent: true,
        opacity: 0.7
    });
    const land = new THREE.Mesh(landGeometry, landMaterial);
    
    // Create simple land shapes (in a real app, you'd use proper geography data)
    scene.add(land);
    
    // Add clouds layer
    const cloudGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2
    });
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
}

function addMarker(memory) {
    // Convert lat/lng to 3D position on sphere
    const lat = memory.lat;
    const lng = memory.lng;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    
    const radius = 1.06;
    const x = - (radius * Math.sin(phi) * Math.cos(theta));
    const y = (radius * Math.cos(phi));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    
    // Create marker (a small colored sphere)
    const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: getMarkerColor(memory.id)
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, y, z);
    marker.userData = memory;
    
    // Add pulsing animation
    let scale = 1;
    function pulse() {
        scale = scale === 1 ? 1.3 : 1;
        marker.scale.setScalar(scale);
        setTimeout(pulse, 1000);
    }
    pulse();
    
    scene.add(marker);
    markers.push(marker);
    
    // Add a line from marker to surface
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x * 0.95, y * 0.95, z * 0.95)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: getMarkerColor(memory.id),
        transparent: true,
        opacity: 0.5
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    
    // Store reference to line in marker
    marker.userData.line = line;
}

function getMarkerColor(id) {
    // Generate a color based on the memory ID
    const colors = [
        0xff3366, // Pink
        0x4facfe, // Blue
        0x00f2fe, // Cyan
        0x7cfc00, // Green
        0xffa500, // Orange
        0x9370db  // Purple
    ];
    return colors[id % colors.length];
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(markers);
    
    // Reset hover effect on previous marker
    if (hoveredMarker) {
        hoveredMarker.material.color.set(getMarkerColor(hoveredMarker.userData.id));
        document.body.style.cursor = 'default';
    }
    
    // Check for new hover
    if (intersects.length > 0) {
        hoveredMarker = intersects[0].object;
        hoveredMarker.material.color.set(0xffff00); // Highlight color
        document.body.style.cursor = 'pointer';
    } else {
        hoveredMarker = null;
    }
}

function onCanvasClick(event) {
    if (hoveredMarker) {
        displayMemory(hoveredMarker.userData);
        
        // Animate camera to look at marker
        const markerPos = hoveredMarker.position;
        new TWEEN.Tween(camera.position)
            .to({
                x: markerPos.x * 1.8,
                y: markerPos.y * 1.8,
                z: markerPos.z * 1.8
            }, 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    }
}

function displayMemory(memory) {
    // Highlight the memory in the list
    const memoryItems = document.querySelectorAll('.memory-item');
    memoryItems.forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.id) === memory.id) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

function renderMemoriesList() {
    const memoriesList = document.getElementById('memoriesList');
    memoriesList.innerHTML = '';
    
    if (memories.length === 0) {
        memoriesList.innerHTML = `
            <div class="no-memories">
                <p>No memories yet. Add your first travel memory using the form below!</p>
            </div>
        `;
        return;
    }
    
    // Sort memories by date (newest first)
    const sortedMemories = [...memories].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedMemories.forEach(memory => {
        const memoryItem = document.createElement('div');
        memoryItem.className = 'memory-item';
        memoryItem.dataset.id = memory.id;
        
        const dateObj = new Date(memory.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Truncate text if too long
        const memoryText = memory.text.length > 150 
            ? memory.text.substring(0, 150) + '...' 
            : memory.text;
        
        memoryItem.innerHTML = `
            <div class="memory-location">${memory.location}</div>
            <div class="memory-date">${formattedDate}</div>
            <div class="memory-text">${memoryText}</div>
        `;
        
        // Add click event to focus on marker
        memoryItem.addEventListener('click', () => {
            displayMemory(memory);
            
            // Find and animate to the marker
            const marker = markers.find(m => m.userData.id === memory.id);
            if (marker) {
                new TWEEN.Tween(camera.position)
                    .to({
                        x: marker.position.x * 1.8,
                        y: marker.position.y * 1.8,
                        z: marker.position.z * 1.8
                    }, 1000)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
            }
        });
        
        memoriesList.appendChild(memoryItem);
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    // Rotate the globe if auto-rotation is enabled
    if (isRotating) {
        globe.rotation.y += 0.001;
        clouds.rotation.y += 0.0005;
    }
    
    // Update controls
    controls.update();
    
    // Update Tween animations
    TWEEN.update();
    
    // Render
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = document.getElementById('globeCanvas').clientWidth / 
                   document.getElementById('globeCanvas').clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
        document.getElementById('globeCanvas').clientWidth,
        document.getElementById('globeCanvas').clientHeight
    );
}

// Handle form submission
document.getElementById('memoryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const locationInput = document.getElementById('location').value.trim();
    const dateInput = document.getElementById('date').value;
    const memoryText = document.getElementById('memory').value.trim();
    
    if (!locationInput || !dateInput || !memoryText) {
        alert('Please fill in all fields');
        return;
    }
    
    // Geocode the location (simplified - using mock coordinates)
    // In a real app, you'd use a geocoding API like Google Maps or OpenStreetMap
    const geocodedLocation = geocodeLocation(locationInput);
    
    const newMemory = {
        id: memories.length > 0 ? Math.max(...memories.map(m => m.id)) + 1 : 1,
        location: locationInput,
        lat: geocodedLocation.lat,
        lng: geocodedLocation.lng,
        date: dateInput,
        text: memoryText
    };
    
    // Add to memories array
    memories.push(newMemory);
    
    // Save to localStorage
    saveMemories();
    
    // Extract country from location
    const locationParts = locationInput.split(', ');
    if (locationParts.length > 1) {
        countriesVisited.add(locationParts[1]);
    }
    
    // Add marker to globe
    addMarker(newMemory);
    
    // Update stats and list
    updateStats();
    renderMemoriesList();
    
    // Reset form
    document.getElementById('memoryForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    
    // Show success message
    alert(`Memory added for ${locationInput}! Look for the new marker on the globe.`);
});

// Mock geocoding function (in a real app, replace with actual geocoding API)
function geocodeLocation(location) {
    // Mock coordinates for popular locations
    const locationMap = {
        'paris, france': { lat: 48.8566, lng: 2.3522 },
        'tokyo, japan': { lat: 35.6762, lng: 139.6503 },
        'new york, usa': { lat: 40.7128, lng: -74.0060 },
        'london, uk': { lat: 51.5074, lng: -0.1278 },
        'sydney, australia': { lat: -33.8688, lng: 151.2093 },
        'cairo, egypt': { lat: 30.0444, lng: 31.2357 },
        'rio de janeiro, brazil': { lat: -22.9068, lng: -43.1729 },
        'beijing, china': { lat: 39.9042, lng: 116.4074 }
    };
    
    const normalizedLocation = location.toLowerCase();
    if (locationMap[normalizedLocation]) {
        return locationMap[normalizedLocation];
    }
    
    // Generate random coordinates for unknown locations
    return {
        lat: (Math.random() * 160) - 80, // Between -80 and 80
        lng: (Math.random() * 360) - 180 // Between -180 and 180
    };
}

// Update statistics
function updateStats() {
    document.getElementById('countriesCount').textContent = countriesVisited.size;
    document.getElementById('memoriesCount').textContent = memories.length;
    
    if (memories.length > 0) {
        const dates = memories.map(m => new Date(m.date));
        const oldestDate = new Date(Math.min(...dates));
        document.getElementById('firstMemory').textContent = oldestDate.getFullYear();
    } else {
        document.getElementById('firstMemory').textContent = '--';
    }
}

// Control button handlers
document.getElementById('rotateToggle').addEventListener('click', function() {
    isRotating = !isRotating;
    this.textContent = isRotating ? 'Pause Rotation' : 'Resume Rotation';
});

document.getElementById('resetView').addEventListener('click', function() {
    // Reset camera position
    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 0, z: 2.5 }, 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
        
    // Reset camera target
    controls.target.set(0, 0, 0);
});

document.getElementById('toggleMarkers').addEventListener('click', function() {
    markersVisible = !markersVisible;
    this.textContent = markersVisible ? 'Hide Markers' : 'Show Markers';
    
    markers.forEach(marker => {
        marker.visible = markersVisible;
        if (marker.userData.line) {
            marker.userData.line.visible = markersVisible;
        }
    });
});

// Add loading overlay to HTML
function addLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <h2>Loading Travel Memory Globe</h2>
        <p>Initializing 3D globe and loading your memories...</p>
    `;
    document.body.appendChild(overlay);
}

// Initialize the application
function initApp() {
    addLoadingOverlay();
    loadMemories();
    initGlobe();
}

// Start the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Add some utility functions for future enhancements
function exportMemories() {
    const dataStr = JSON.stringify(memories, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'travel-memories.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importMemories(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedMemories = JSON.parse(e.target.result);
            memories = importedMemories;
            saveMemories();
            location.reload(); // Reload to update everything
        } catch (error) {
            alert('Error importing memories. Please check the file format.');
        }
    };
    reader.readAsText(file);
}

// Add export/import functionality (optional - could be added to UI later)
console.log('Travel Memory Globe initialized!');
console.log('Use exportMemories() to export your memories as JSON');
console.log('Use importMemories(event) with a file input to import memories');