// script.js

// Set current year in footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Variables
let memories = [];
let markers = [];
let isRotating = false;
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

// Chicago date formatter
function formatChicagoDate(dateString) {
    const date = new Date(dateString + 'T12:00:00'); // Noon to avoid timezone issues
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Chicago'
    };
    return date.toLocaleDateString('en-US', options);
}

// Get today's date in Chicago for the form
function getChicagoToday() {
    const now = new Date();
    const chicagoDate = now.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const parts = chicagoDate.split('/');
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

// Set form date to Chicago's today
document.getElementById('date').value = getChicagoToday();

// Relative date for Chicago
function formatRelativeDateChicago(dateString) {
    const chicagoDate = new Date(dateString + 'T12:00:00');
    const now = new Date();
    
    // Convert both to Chicago time for accurate comparison
    const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const chicagoMemory = new Date(chicagoDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    
    const diffTime = Math.abs(chicagoNow - chicagoMemory);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? '' : 's'} ago`;
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
    
    // Create the globe - FIXED VERSION (no green land overlay)
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

// Create Earth with texture - FIXED (no green overlay)
function createEarthGlobe() {
    // Create sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Try to load Earth texture
    const textureLoader = new THREE.TextureLoader();
    
    // Create a colored Earth as fallback
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x2a5c8a,
        specular: new THREE.Color(0x333333),
        shininess: 10
    });
    
    // Try to load actual Earth texture
    try {
        const earthTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
            () => {
                console.log('Earth texture loaded');
                earthMaterial.map = earthTexture;
                earthMaterial.needsUpdate = true;
                earthMaterial.color.set(0xffffff); // Reset color when texture loads
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
    
    // REMOVED THE GREEN LAND OVERLAY - that was causing the green color!
    
    // Add clouds
    const cloudGeometry = new THREE.SphereGeometry(1.03, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15
    });
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);
    
    // Add atmosphere effect
    const atmosphereGeometry = new THREE.SphereGeometry(1.06, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x87ceeb,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x333333, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    // Add fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-3, -1, -2);
    scene.add(fillLight);
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
        
        // Truncate text if too long
        const memoryText = memory.text.length > 120 
            ? memory.text.substring(0, 120) + '...' 
            : memory.text;
        
        memoryItem.innerHTML = `
            <div class="delete-memory" data-id="${memory.id}">
                <i class="fas fa-trash"></i>
            </div>
            <div class="memory-location">${memory.location}</div>
            <div class="memory-date">
                <i class="far fa-calendar"></i>
                ${formatRelativeDateChicago(memory.date)}
                <span style="font-size: 0.8rem; margin-left: 8px; opacity: 0.8">
                    (${formatChicagoDate(memory.date)})
                </span>
            </div>
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
    document.getElementById('date').value = getChicagoToday(); // FIXED: Use Chicago date
    
    // Show success message
    alert(`Memory added for ${locationInput}! Look for the new marker on the globe.`);
});

// Improved geocoding function with real coordinates for major cities
function geocodeLocation(location) {
    // Comprehensive location database with real coordinates
    const locationDatabase = {
        // USA Cities
        'new york, usa': { lat: 40.7128, lng: -74.0060 },
        'chicago, usa': { lat: 41.8781, lng: -87.6298 },
        'los angeles, usa': { lat: 34.0522, lng: -118.2437 },
        'miami, usa': { lat: 25.7617, lng: -80.1918 },
        'las vegas, usa': { lat: 36.1699, lng: -115.1398 },
        'san francisco, usa': { lat: 37.7749, lng: -122.4194 },
        'washington dc, usa': { lat: 38.9072, lng: -77.0369 },
        'boston, usa': { lat: 42.3601, lng: -71.0589 },
        'seattle, usa': { lat: 47.6062, lng: -122.3321 },
        'houston, usa': { lat: 29.7604, lng: -95.3698 },
        'denver, usa': { lat: 39.7392, lng: -104.9903 },
        'phoenix, usa': { lat: 33.4484, lng: -112.0740 },
        'dallas, usa': { lat: 32.7767, lng: -96.7970 },
        'atlanta, usa': { lat: 33.7489, lng: -84.3880 },
        'philadelphia, usa': { lat: 39.9526, lng: -75.1932 },
        'minneapolis, usa': { lat: 44.9778, lng: -93.2650 },
        'indianapolis, usa': { lat: 39.7684, lng: -86.1581 },
        'orlando, usa': { lat: 28.5383, lng: -81.3792 },
        
        // European Cities
        'paris, france': { lat: 48.8566, lng: 2.3522 },
        'london, uk': { lat: 51.5074, lng: -0.1278 },
        'rome, italy': { lat: 41.9028, lng: 12.4964 },
        'berlin, germany': { lat: 52.5200, lng: 13.4050 },
        'madrid, spain': { lat: 40.4168, lng: -3.7038 },
        'barcelona, spain': { lat: 41.3851, lng: 2.1734 },
        'amsterdam, netherlands': { lat: 52.3676, lng: 4.9041 },
        'prague, czech republic': { lat: 50.0755, lng: 14.4378 },
        'vienna, austria': { lat: 48.2082, lng: 16.3738 },
        'athens, greece': { lat: 37.9838, lng: 23.7275 },
        'lisbon, portugal': { lat: 38.7223, lng: -9.1393 },
        'dublin, ireland': { lat: 53.3498, lng: -6.2603 },
        'edinburgh, uk': { lat: 55.9533, lng: -3.1883 },
        
        // Asian Cities
        'tokyo, japan': { lat: 35.6762, lng: 139.6503 },
        'beijing, china': { lat: 39.9042, lng: 116.4074 },
        'shanghai, china': { lat: 31.2304, lng: 121.4737 },
        'hong kong, china': { lat: 22.3193, lng: 114.1694 },
        'singapore, singapore': { lat: 1.3521, lng: 103.8198 },
        'bangkok, thailand': { lat: 13.7563, lng: 100.5018 },
        'seoul, south korea': { lat: 37.5665, lng: 126.9780 },
        'taipei, taiwan': { lat: 25.0330, lng: 121.5654 },
        'mumbai, india': { lat: 19.0760, lng: 72.8777 },
        'delhi, india': { lat: 28.7041, lng: 77.1025 },
        'bangalore, india': { lat: 12.9716, lng: 77.5946 },
        'cebu, philippines': { lat: 10.3157, lng: 123.8854 },
        'batangas, philippines': { lat: 13.7569, lng: 121.0583 },
        'manila, philippines': { lat: 14.5995, lng: 120.9842 },
        
        // Australian Cities
        'sydney, australia': { lat: -33.8688, lng: 151.2093 },
        'melbourne, australia': { lat: -37.8136, lng: 144.9631 },
        'brisbane, australia': { lat: -27.4698, lng: 153.0251 },
        'perth, australia': { lat: -31.9505, lng: 115.8605 },
        
        // South American Cities
        'rio de janeiro, brazil': { lat: -22.9068, lng: -43.1729 },
        'sao paulo, brazil': { lat: -23.5505, lng: -46.6333 },
        'buenos aires, argentina': { lat: -34.6037, lng: -58.3816 },
        'lima, peru': { lat: -12.0464, lng: -77.0428 },
        'bogota, colombia': { lat: 4.7110, lng: -74.0721 },
        'santiago, chile': { lat: -33.4489, lng: -70.6693 },
        
        // African Cities
        'cairo, egypt': { lat: 30.0444, lng: 31.2357 },
        'cape town, south africa': { lat: -33.9249, lng: 18.4241 },
        'nairobi, kenya': { lat: -1.2864, lng: 36.8172 },
        'lagos, nigeria': { lat: 6.5244, lng: 3.3792 },
        'marrakech, morocco': { lat: 31.6295, lng: -7.9811 },
        
        // Middle Eastern Cities
        'tel aviv, israel': { lat: 32.0853, lng: 34.7818 },
        'istanbul, turkey': { lat: 41.0082, lng: 28.9784 },
        'tehran, iran': { lat: 35.6892, lng: 51.3890 },
        'doha, qatar': { lat: 25.2854, lng: 51.5310 },
        'riyadh, saudi arabia': { lat: 24.7136, lng: 46.6753 },
        'dubai, uae': { lat: 25.2048, lng: 55.2708 },
        
        // Canadian Cities
        'toronto, canada': { lat: 43.6510, lng: -79.3470 },
        'vancouver, canada': { lat: 49.2827, lng: -123.1207 },
        'montreal, canada': { lat: 45.5017, lng: -73.5673 },
        'calgary, canada': { lat: 51.0447, lng: -114.0719 },
        'ottawa, canada': { lat: 45.4215, lng: -75.6998 },
        
        // Mexican Cities
        'mexico city, mexico': { lat: 19.4326, lng: -99.1332 },
        'cancun, mexico': { lat: 21.1619, lng: -86.8515 },
        
        // Russian Cities
        'moscow, russia': { lat: 55.7558, lng: 37.6173 },
        'saint petersburg, russia': { lat: 59.9343, lng: 30.3351 },
        
        // Caribbean Cities
        'havana, cuba': { lat: 23.1136, lng: -82.3666 },
        'kingston, jamaica': { lat: 17.9714, lng: -76.7922 },
        
        // Additional Major Cities
        'jakarta, indonesia': { lat: -6.2088, lng: 106.8456 },
        'manila, philippines': { lat: 14.5995, lng: 120.9842 },
        'ho chi minh city, vietnam': { lat: 10.8231, lng: 106.6297 },
        'kuala lumpur, malaysia': { lat: 3.1390, lng: 101.6869 },
        'osaka, japan': { lat: 34.6937, lng: 135.5023 },
        'kyoto, japan': { lat: 35.0116, lng: 135.7681 },
        'venice, italy': { lat: 45.4408, lng: 12.3155 },
        'florence, italy': { lat: 43.7696, lng: 11.2558 },
        'milan, italy': { lat: 45.4642, lng: 9.1900 },
        'zurich, switzerland': { lat: 47.3769, lng: 8.5417 },
        'geneva, switzerland': { lat: 46.2044, lng: 6.1432 },
        'brussels, belgium': { lat: 50.8503, lng: 4.3517 },
        'copenhagen, denmark': { lat: 55.6761, lng: 12.5683 },
        'stockholm, sweden': { lat: 59.3293, lng: 18.0686 },
        'helsinki, finland': { lat: 60.1699, lng: 24.9384 },
        'oslo, norway': { lat: 59.9139, lng: 10.7522 },
        'reykjavik, iceland': { lat: 64.1466, lng: -21.9426 },
        'warsaw, poland': { lat: 52.2297, lng: 21.0122 },
        'budapest, hungary': { lat: 47.4979, lng: 19.0402 },
        'bucharest, romania': { lat: 44.4268, lng: 26.1025 }
    };
    
    // Normalize the input
    const normalizedLocation = location.toLowerCase().trim();
    
    // Try exact match first
    if (locationDatabase[normalizedLocation]) {
        return locationDatabase[normalizedLocation];
    }
    
    // Try matching just the city name (without country)
    const cityName = normalizedLocation.split(',')[0].trim();
    for (const key in locationDatabase) {
        if (key.startsWith(cityName + ',')) {
            return locationDatabase[key];
        }
    }
    
    // Try fuzzy matching for common variations
    const commonVariations = {
        'nyc': 'new york, usa',
        'new york city': 'new york, usa',
        'la': 'los angeles, usa',
        'san fran': 'san francisco, usa',
        'dc': 'washington dc, usa',
        'sf': 'san francisco, usa',
        'chi': 'chicago, usa',
        'mia': 'miami, usa',
        'lax': 'los angeles, usa',
        'lon': 'london, uk',
        'ldn': 'london, uk',
        'par': 'paris, france',
        'rom': 'rome, italy',
        'ber': 'berlin, germany',
        'mad': 'madrid, spain',
        'bar': 'barcelona, spain',
        'ams': 'amsterdam, netherlands',
        'pra': 'prague, czech republic',
        'vie': 'vienna, austria',
        'ath': 'athens, greece',
        'lis': 'lisbon, portugal',
        'dub': 'dublin, ireland',
        'edi': 'edinburgh, uk',
        'tok': 'tokyo, japan',
        'pek': 'beijing, china',
        'sha': 'shanghai, china',
        'hk': 'hong kong, china',
        'sin': 'singapore, singapore',
        'bkk': 'bangkok, thailand',
        'sel': 'seoul, south korea',
        'tpe': 'taipei, taiwan',
        'bom': 'mumbai, india',
        'del': 'delhi, india',
        'blr': 'bangalore, india',
        'dxb': 'dubai, uae',
        'syd': 'sydney, australia',
        'mel': 'melbourne, australia',
        'bne': 'brisbane, australia',
        'per': 'perth, australia',
        'rio': 'rio de janeiro, brazil',
        'sao': 'sao paulo, brazil',
        'bue': 'buenos aires, argentina',
        'lim': 'lima, peru',
        'bog': 'bogota, colombia',
        'scl': 'santiago, chile',
        'cai': 'cairo, egypt',
        'cpt': 'cape town, south africa',
        'nbo': 'nairobi, kenya',
        'los': 'lagos, nigeria',
        'rak': 'marrakech, morocco',
        'tlv': 'tel aviv, israel',
        'ist': 'istanbul, turkey',
        'thr': 'tehran, iran',
        'yyz': 'toronto, canada',
        'yvr': 'vancouver, canada',
        'yul': 'montreal, canada',
        'yyc': 'calgary, canada',
        'mex': 'mexico city, mexico',
        'cun': 'cancun, mexico',
        'svx': 'moscow, russia',
        'led': 'saint petersburg, russia',
        'hav': 'havana, cuba',
        'kin': 'kingston, jamaica',
        'cgk': 'jakarta, indonesia',
        'mnl': 'manila, philippines',
        'sgn': 'ho chi minh city, vietnam',
        'kul': 'kuala lumpur, malaysia',
        'kix': 'osaka, japan',
        'ngo': 'kyoto, japan',
        'vce': 'venice, italy',
        'flr': 'florence, italy',
        'mxp': 'milan, italy',
        'zrh': 'zurich, switzerland',
        'gva': 'geneva, switzerland',
        'bru': 'brussels, belgium',
        'cph': 'copenhagen, denmark',
        'arn': 'stockholm, sweden',
        'hel': 'helsinki, finland',
        'osl': 'oslo, norway',
        'kef': 'reykjavik, iceland',
        'waw': 'warsaw, poland',
        'bud': 'budapest, hungary',
        'otp': 'bucharest, romania'
    };
    
    if (commonVariations[normalizedLocation]) {
        return locationDatabase[commonVariations[normalizedLocation]];
    }
    
    // If no match found, try to estimate coordinates based on country
    const countryMatch = normalizedLocation.match(/, ([a-z\s]+)$/);
    if (countryMatch) {
        const country = countryMatch[1].trim();
        const countryCoordinates = {
            'usa': { lat: 39.8283, lng: -98.5795 }, // Center of USA
            'france': { lat: 46.2276, lng: 2.2137 },
            'uk': { lat: 55.3781, lng: -3.4360 },
            'italy': { lat: 41.8719, lng: 12.5674 },
            'germany': { lat: 51.1657, lng: 10.4515 },
            'spain': { lat: 40.4637, lng: -3.7492 },
            'japan': { lat: 36.2048, lng: 138.2529 },
            'china': { lat: 35.8617, lng: 104.1954 },
            'australia': { lat: -25.2744, lng: 133.7751 },
            'brazil': { lat: -14.2350, lng: -51.9253 },
            'canada': { lat: 56.1304, lng: -106.3468 },
            'india': { lat: 20.5937, lng: 78.9629 },
            'russia': { lat: 61.5240, lng: 105.3188 },
            'mexico': { lat: 23.6345, lng: -102.5528 }
        };
        
        if (countryCoordinates[country]) {
            // Add some random offset so markers don't stack exactly in center
            return {
                lat: countryCoordinates[country].lat + (Math.random() * 10 - 5),
                lng: countryCoordinates[country].lng + (Math.random() * 10 - 5)
            };
        }
    }
    
    // Last resort: random coordinates but weighted toward populated areas
    // Most of the world's population lives between 60°N and 40°S
    return {
        lat: (Math.random() * 100) - 40, // Between -40 and 60
        lng: (Math.random() * 360) - 180 // Between -180 and 180
    };
}

// Update statistics
function updateStats() {
    document.getElementById('countriesCount').textContent = countriesVisited.size;
    document.getElementById('memoriesCount').textContent = memories.length;
    
    if (memories.length > 0) {
        // Calculate dates in Chicago time
        const chicagoDates = memories.map(m => {
            const date = new Date(m.date + 'T12:00:00');
            return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        });
        
        const oldestDate = new Date(Math.min(...chicagoDates));
        const latestDate = new Date(Math.max(...chicagoDates));
        
        document.getElementById('firstMemory').textContent = oldestDate.getFullYear();
        
        // Format latest memory date in Chicago time
        const now = new Date();
        const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        const diffTime = Math.abs(chicagoNow - latestDate);
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
    if (isRotating) {
        this.innerHTML = '<i class="fas fa-pause"></i> Pause Rotation';
    } else {
        this.innerHTML = '<i class="fas fa-play"></i> Start Rotation';
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