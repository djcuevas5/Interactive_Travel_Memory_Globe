// script.js

// Set current year in footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Set today's date as default in the form
document.getElementById('date').valueAsDate = new Date();

// Variables
let memories = [];
let markers = [];
let isRotating = true;
let markersVisible = true;
let countriesVisited = new Set();
let memoryToDelete = null;

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
    // Create loading overlay
    addLoadingOverlay();
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    
    // Add stars
    addStars();
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, 
        document.getElementById('globeCanvas').clientWidth / 
        document.getElementById('globeCanvas').clientHeight, 
        0.1, 2000);
    camera.position.z = 3;
    
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
    controls.rotateSpeed = 0.8;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    
    // Create the globe
    createEarthGlobe();
    
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
    
    // Remove loading overlay after everything is loaded
    setTimeout(() => {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
            }, 500);
        }
    }, 1500);
    
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
        size: 0.8,
        sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// Create Earth with texture
function createEarthGlobe() {
    // Create sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Try to load Earth texture
    const textureLoader = new THREE.TextureLoader();
    
    // Create a colored Earth as fallback
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x2a5c8a,
        specular: new THREE.Color(0x333333),
        shininess: 10,
        transparent: true,
        opacity: 0.95
    });
    
    // Try to load actual Earth texture
    try {
        const earthTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
            () => {
                console.log('Earth texture loaded');
                earthMaterial.map = earthTexture;
                earthMaterial.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.log('Using colored Earth instead:', error);
            }
        );
    } catch (error) {
        console.log('Using colored Earth texture');
    }
    
    // Earth mesh
    globe = new THREE.Mesh(geometry, earthMaterial);
    scene.add(globe);
    
    // Add land masses
    const landGeometry = new THREE.SphereGeometry(1.01, 64, 64);
    const landMaterial = new THREE.MeshPhongMaterial({
        color: 0x3a8c5a,
        transparent: true,
        opacity: 0.6
    });
    const land = new THREE.Mesh(landGeometry, landMaterial);
    land.rotation.y = Math.PI / 4;
    scene.add(land);
    
    // Add clouds
    const cloudGeometry = new THREE.SphereGeometry(1.03, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15
    });
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    // Add a subtle point light
    const pointLight = new THREE.PointLight(0xffffff, 0.3, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);
}

function addMarker(memory) {
    // Convert lat/lng to 3D position on sphere
    const lat = memory.lat;
    const lng = memory.lng;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    
    const radius = 1.05;
    const x = - (radius * Math.sin(phi) * Math.cos(theta));
    const y = (radius * Math.cos(phi));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    
    // Create marker group
    const markerGroup = new THREE.Group();
    
    // Create marker (a small colored sphere)
    const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: getMarkerColor(memory.id)
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, 0, 0);
    
    // Create glowing effect
    const glowGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: getMarkerColor(memory.id),
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    
    // Add pulsing animation
    let pulseDirection = 0.01;
    function animateGlow() {
        if (glow.scale.x > 1.5 || glow.scale.x < 1) {
            pulseDirection *= -1;
        }
        glow.scale.x += pulseDirection;
        glow.scale.y += pulseDirection;
        glow.scale.z += pulseDirection;
        requestAnimationFrame(animateGlow);
    }
    animateGlow();
    
    markerGroup.add(marker);
    markerGroup.add(glow);
    markerGroup.position.set(x, y, z);
    markerGroup.userData = memory;
    markerGroup.userData.marker = marker;
    markerGroup.userData.glow = glow;
    
    scene.add(markerGroup);
    markers.push(markerGroup);
    
    // Add a line connecting marker to Earth
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x * 0.97, y * 0.97, z * 0.97)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: getMarkerColor(memory.id),
        transparent: true,
        opacity: 0.5
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    markerGroup.userData.line = line;
}

function getMarkerColor(id) {
    // Generate a color based on the memory ID
    const colors = [
        0xff3366, // Pink
        0x4facfe, // Blue
        0x00f2fe, // Cyan
        0x7cfc00, // Green
        0xffa500, // Orange
        0x9370db, // Purple
        0xff6b6b, // Coral
        0x51cf66  // Bright Green
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
        hoveredMarker.userData.marker.material.color.set(getMarkerColor(hoveredMarker.userData.id));
        document.body.style.cursor = 'default';
    }
    
    // Check for new hover
    if (intersects.length > 0) {
        hoveredMarker = intersects[0].object.parent; // Get the marker group
        hoveredMarker.userData.marker.material.color.set(0xffff00); // Highlight color
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
            <div class="no-memories" style="text-align: center; padding: 40px; color: #88c1ff;">
                <i class="fas fa-map-marker-alt" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <h3 style="color: #4facfe; margin-bottom: 10px;">No Memories Yet</h3>
                <p>Add your first travel memory using the form below!</p>
                <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.8;">Click "Add Memory to Globe" to get started.</p>
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
        const memoryText = memory.text.length > 120 
            ? memory.text.substring(0, 120) + '...' 
            : memory.text;
        
        memoryItem.innerHTML = `
            <div class="delete-memory" data-id="${memory.id}">
                <i class="fas fa-trash"></i>
            </div>
            <div class="memory-location">${memory.location}</div>
            <div class="memory-date">${formattedDate}</div>
            <div class="memory-text">${memoryText}</div>
        `;
        
        // Add click event to focus on marker
        memoryItem.addEventListener('click', (e) => {
            // Don't trigger if delete button was clicked
            if (!e.target.closest('.delete-memory')) {
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
            }
        });
        
        // Add delete button event
        const deleteBtn = memoryItem.querySelector('.delete-memory');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent memory click event
            showDeleteModal(memory);
        });
        
        memoriesList.appendChild(memoryItem);
    });
}

function showDeleteModal(memory) {
    memoryToDelete = memory;
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'flex';
}

function hideDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'none';
    memoryToDelete = null;
}

// DELETE FUNCTIONALITY
function deleteMemory() {
    if (!memoryToDelete) return;
    
    const memoryId = memoryToDelete.id;
    
    // Remove from memories array
    memories = memories.filter(m => m.id !== memoryId);
    
    // Remove marker from scene
    const markerIndex = markers.findIndex(m => m.userData.id === memoryId);
    if (markerIndex !== -1) {
        const marker = markers[markerIndex];
        scene.remove(marker);
        
        // Remove line if it exists
        if (marker.userData.line) {
            scene.remove(marker.userData.line);
        }
        
        // Remove glow if it exists
        if (marker.userData.glow) {
            scene.remove(marker.userData.glow);
        }
        
        markers.splice(markerIndex, 1);
    }
    
    // Update countries visited
    countriesVisited.clear();
    memories.forEach(memory => {
        const locationParts = memory.location.split(', ');
        if (locationParts.length > 1) {
            countriesVisited.add(locationParts[1]);
        }
    });
    
    // Save to localStorage
    saveMemories();
    
    // Update UI
    updateStats();
    renderMemoriesList();
    
    // Hide modal
    hideDeleteModal();
    
    // Show confirmation
    alert(`Memory for ${memoryToDelete.location} has been deleted.`);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Rotate the globe if auto-rotation is enabled
    if (isRotating && globe) {
        globe.rotation.y += 0.001;
        if (clouds) clouds.rotation.y += 0.0005;
    }
    
    // Update controls
    if (controls) controls.update();
    
    // Update Tween animations
    TWEEN.update();
    
    // Render
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    
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
    
    // Geocode the location
    const geocodedLocation = geocodeLocation(locationInput);
    
    // Generate new ID
    const newId = memories.length > 0 ? Math.max(...memories.map(m => m.id)) + 1 : 1;
    
    const newMemory = {
        id: newId,
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

// Mock geocoding function
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
        'beijing, china': { lat: 39.9042, lng: 116.4074 },
        'moscow, russia': { lat: 55.7558, lng: 37.6173 },
        'mumbai, india': { lat: 19.0760, lng: 72.8777 },
        'rome, italy': { lat: 41.9028, lng: 12.4964 },
        'berlin, germany': { lat: 52.5200, lng: 13.4050 },
        'madrid, spain': { lat: 40.4168, lng: -3.7038 },
        'toronto, canada': { lat: 43.6510, lng: -79.3470 },
        'mexico city, mexico': { lat: 19.4326, lng: -99.1332 }
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
        const latestDate = new Date(Math.max(...dates));
        
        document.getElementById('firstMemory').textContent = oldestDate.getFullYear();
        
        // Format latest memory date
        const now = new Date();
        const diffTime = Math.abs(now - latestDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            document.getElementById('latestMemory').textContent = 'Today';
        } else if (diffDays === 1) {
            document.getElementById('latestMemory').textContent = 'Yesterday';
        } else if (diffDays < 30) {
            document.getElementById('latestMemory').textContent = `${diffDays}d ago`;
        } else if (diffDays < 365) {
            const diffMonths = Math.floor(diffDays / 30);
            document.getElementById('latestMemory').textContent = `${diffMonths}mo ago`;
        } else {
            document.getElementById('latestMemory').textContent = latestDate.getFullYear();
        }
    } else {
        document.getElementById('firstMemory').textContent = '--';
        document.getElementById('latestMemory').textContent = '--';
    }
}

// Control button handlers
document.getElementById('rotateToggle').addEventListener('click', function() {
    isRotating = !isRotating;
    const icon = this.querySelector('i');
    if (isRotating) {
        this.innerHTML = '<i class="fas fa-pause"></i> Pause Rotation';
    } else {
        this.innerHTML = '<i class="fas fa-play"></i> Resume Rotation';
    }
});

document.getElementById('resetView').addEventListener('click', function() {
    // Reset camera position
    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 0, z: 3 }, 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
        
    // Reset camera target
    controls.target.set(0, 0, 0);
});

document.getElementById('toggleMarkers').addEventListener('click', function() {
    markersVisible = !markersVisible;
    if (markersVisible) {
        this.innerHTML = '<i class="fas fa-map-marker-alt"></i> Hide Markers';
    } else {
        this.innerHTML = '<i class="fas fa-map-marker-alt"></i> Show Markers';
    }
    
    markers.forEach(marker => {
        marker.visible = markersVisible;
        if (marker.userData.line) {
            marker.userData.line.visible = markersVisible;
        }
        if (marker.userData.glow) {
            marker.userData.glow.visible = markersVisible;
        }
    });
});

document.getElementById('exportData').addEventListener('click', function() {
    exportMemories();
});

document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', function(e) {
    importMemories(e);
});

// Modal event handlers for DELETE
document.getElementById('confirmDelete').addEventListener('click', deleteMemory);
document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);

// Close modal when clicking outside
document.getElementById('deleteModal').addEventListener('click', function(e) {
    if (e.target === this) {
        hideDeleteModal();
    }
});

// Add loading overlay to HTML
function addLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <h2>Loading Divine's Travel Memory Globe</h2>
        <p>Initializing 3D globe and loading your memories...</p>
    `;
    document.body.appendChild(overlay);
}

// Export memories as JSON file
function exportMemories() {
    const dataStr = JSON.stringify(memories, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'divine-travel-memories-' + new Date().toISOString().split('T')[0] + '.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Import memories from JSON file
function importMemories(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedMemories = JSON.parse(e.target.result);
            
            // Validate the imported data
            if (!Array.isArray(importedMemories)) {
                throw new Error('Invalid file format');
            }
            
            // Ask for confirmation
            if (confirm(`Import ${importedMemories.length} memories? This will replace your current memories.`)) {
                memories = importedMemories;
                saveMemories();
                location.reload(); // Reload to update everything
            }
        } catch (error) {
            alert('Error importing memories. Please check the file format.');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Initialize the application
function initApp() {
    loadMemories();
    initGlobe();
    
    // Add event listeners for form
    document.getElementById('memoryForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const location = document.getElementById('location').value.trim();
        const date = document.getElementById('date').value;
        const memoryText = document.getElementById('memory').value.trim();
        
        if (!location || !date || !memoryText) {
            alert('Please fill in all fields');
            return;
        }
        
        const geocodedLocation = geocodeLocation(location);
        const newId = memories.length > 0 ? Math.max(...memories.map(m => m.id)) + 1 : 1;
        
        const newMemory = {
            id: newId,
            location: location,
            lat: geocodedLocation.lat,
            lng: geocodedLocation.lng,
            date: date,
            text: memoryText
        };
        
        memories.push(newMemory);
        saveMemories();
        
        const locationParts = location.split(', ');
        if (locationParts.length > 1) {
            countriesVisited.add(locationParts[1]);
        }
        
        addMarker(newMemory);
        updateStats();
        renderMemoriesList();
        
        document.getElementById('memoryForm').reset();
        document.getElementById('date').valueAsDate = new Date();
        
        alert(`Memory added for ${location}! Look for the new marker on the globe.`);
    });
}

// Start the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key closes modal
    if (e.key === 'Escape' && document.getElementById('deleteModal').style.display === 'flex') {
        hideDeleteModal();
    }
    
    // Ctrl+S to save/export (prevent default browser save)
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportMemories();
    }
});

console.log("Divine's Travel Memory Globe initialized!");