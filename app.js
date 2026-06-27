// Telegram WebApp initialization
const tg = window.Telegram.WebApp;
tg.expand();

// User info
const user = tg.initDataUnsafe?.user || { first_name: 'Гость' };
document.getElementById('userName').textContent = user.first_name;
if (user.photo_url) {
    document.getElementById('userAvatar').src = user.photo_url;
}

// Application state
let currentPoint = null;
let map = null;
let userMarker = null;
let points = [];
let audioPlayer = null;
let currentAudio = null;
let isPlaying = false;
let currentSpeed = 1.0;

// Load points data
async function loadPoints() {
    try {
        const response = await fetch('data/points.json');
        points = await response.json();
        return points;
    } catch (error) {
        console.error('Failed to load points:', error);
        return [];
    }
}

// Initialize map
function initMap() {
    const defaultCoords = [44.0433, 42.8594]; // Ессентуки центр
    map = L.map('map').setView(defaultCoords, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Add user location
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (!userMarker) {
                    userMarker = L.marker([latitude, longitude], {
                        icon: L.divIcon({
                            className: 'user-marker',
                            html: '📍',
                            iconSize: [30, 30]
                        })
                    }).addTo(map);
                    map.setView([latitude, longitude], 15);
                } else {
                    userMarker.setLatLng([latitude, longitude]);
                }
                
                // Check proximity to points
                checkProximity(latitude, longitude);
            },
            (error) => {
                console.warn('Geolocation error:', error);
            },
            { enableHighAccuracy: true }
        );
    }
}

// Check if user is near any point
function checkProximity(lat, lng) {
    points.forEach(point => {
        const distance = calculateDistance(lat, lng, point.lat, point.lng);
        if (distance < 20 && point.status !== 'visited') {
            if (!currentAudio || currentAudio.id !== point.id) {
                playPointAudio(point);
            }
        }
    });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000;
}

// Add points to map
function addPointsToMap(points) {
    points.forEach(point => {
        const markerColor = getMarkerColor(point.status);
        const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                className: 'point-marker',
                html: `<div style="background: ${markerColor}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">${point.number}</div>`,
                iconSize: [32, 32]
            })
        }).addTo(map);
        
        marker.on('click', () => {
            showPointInfo(point);
        });
    });
}

function getMarkerColor(status) {
    switch(status) {
        case 'not_visited': return '#95a5a6';
        case 'current': return '#3498db';
        case 'visited': return '#27ae60';
        default: return '#95a5a6';
    }
}

// Show point info in bottom sheet
function showPointInfo(point) {
    currentPoint = point;
    const sheet = document.getElementById('bottomSheet');
    const info = document.getElementById('pointInfo');
    const loading = document.getElementById('loadingState');
    
    info.style.display = 'block';
    loading.style.display = 'none';
    
    document.getElementById('pointTitle').textContent = point.title;
    document.getElementById('pointNumber').textContent = `#${point.number}`;
    document.getElementById('pointImage').src = point.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f0f0f0"/%3E%3Ctext x="100" y="100" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="14"%3EНет фото%3C/text%3E%3C/svg%3E';
    document.getElementById('pointDescription').textContent = point.description;
    
    // Setup audio player
    setupAudioPlayer(point);
    
    sheet.classList.add('open');
    tg.HapticFeedback.impactOccurred('light');
}

// Setup audio player
function setupAudioPlayer(point) {
    const audioElement = document.getElementById('audioPlayer');
    audioElement.style.display = 'block';
    
    if (currentAudio && currentAudio.src) {
        currentAudio.pause();
    }
    
    currentAudio = new Audio(point.audio);
    currentAudio.id = point.id;
    currentAudio.playbackRate = currentSpeed;
    
    // Update progress bar
    currentAudio.addEventListener('timeupdate', () => {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        document.getElementById('progressBar').value = progress;
        document.getElementById('currentTime').textContent = formatTime(currentAudio.currentTime);
    });
    
    currentAudio.addEventListener('loadedmetadata', () => {
        document.getElementById('totalTime').textContent = formatTime(currentAudio.duration);
    });
    
    currentAudio.addEventListener('ended', () => {
        document.getElementById('playBtn').textContent = '▶';
        isPlaying = false;
        // Mark point as visited
        point.status = 'visited';
        addPointsToMap(points);
    });
}

// Format time in minutes:seconds
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Play audio
function playPointAudio(point) {
    if (!currentAudio || currentAudio.id !== point.id) {
        setupAudioPlayer(point);
    }
    
    if (currentAudio) {
        currentAudio.play();
        document.getElementById('playBtn').textContent = '⏸';
        isPlaying = true;
    }
}

// Control playback
document.getElementById('playBtn').addEventListener('click', () => {
    if (currentAudio) {
        if (isPlaying) {
            currentAudio.pause();
            document.getElementById('playBtn').textContent = '▶';
            isPlaying = false;
        } else {
            currentAudio.play();
            document.getElementById('playBtn').textContent = '⏸';
            isPlaying = true;
        }
    }
});

document.getElementById('rewindBackBtn').addEventListener('click', () => {
    if (currentAudio) {
        currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 15);
        tg.HapticFeedback.impactOccurred('light');
    }
});

document.getElementById('rewindForwardBtn').addEventListener('click', () => {
    if (currentAudio) {
        currentAudio.currentTime = Math.min(currentAudio.duration, currentAudio.currentTime + 15);
        tg.HapticFeedback.impactOccurred('light');
    }
});

document.getElementById('speedBtn').addEventListener('click', () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    let index = speeds.indexOf(currentSpeed);
    index = (index + 1) % speeds.length;
    currentSpeed = speeds[index];
    document.getElementById('speedBtn').textContent = `${currentSpeed}x`;
    if (currentAudio) {
        currentAudio.playbackRate = currentSpeed;
    }
    tg.HapticFeedback.impactOccurred('light');
});

document.getElementById('progressBar').addEventListener('input', (e) => {
    if (currentAudio && currentAudio.duration) {
        const seekTime = (e.target.value / 100) * currentAudio.duration;
        currentAudio.currentTime = seekTime;
    }
});

// Download audio
document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (currentPoint && currentPoint.audio) {
        try {
            const response = await fetch(currentPoint.audio);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentPoint.title}.mp3`;
            a.click();
            URL.revokeObjectURL(url);
            tg.HapticFeedback.notificationOccurred('success');
        } catch (error) {
            console.error('Download failed:', error);
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
});

// Bottom sheet drag to close
let startY = 0;
let currentY = 0;
const sheet = document.getElementById('bottomSheet');

sheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
});

sheet.addEventListener('touchmove', (e) => {
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0 && sheet.classList.contains('open')) {
        const transform = Math.min(diff, 200);
        sheet.style.transform = `translateY(${transform}px)`;
    }
});

sheet.addEventListener('touchend', (e) => {
    const diff = currentY - startY;
    if (diff > 100) {
        sheet.classList.remove('open');
        sheet.style.transform = '';
        document.getElementById('pointInfo').style.display = 'none';
        if (currentAudio) {
            currentAudio.pause();
            isPlaying = false;
            document.getElementById('playBtn').textContent = '▶';
        }
    } else {
        sheet.style.transform = '';
    }
});

// Close bottom sheet on map click
document.getElementById('map').addEventListener('click', () => {
    sheet.classList.remove('open');
    document.getElementById('pointInfo').style.display = 'none';
    if (currentAudio) {
        currentAudio.pause();
        isPlaying = false;
        document.getElementById('playBtn').textContent = '▶';
    }
});

// Init app
async function initApp() {
    document.getElementById('loadingState').style.display = 'flex';
    
    const loadedPoints = await loadPoints();
    if (loadedPoints.length > 0) {
        points = loadedPoints;
        initMap();
        addPointsToMap(points);
        document.getElementById('loadingState').style.display = 'none';
    } else {
        // Use default demo points
        points = [
            {
                id: 1,
                number: 1,
                title: 'Театральная площадь',
                lat: 44.0433,
                lng: 42.8594,
                description: 'Центральная площадь города Ессентуки, где расположен драмтеатр и проводятся городские праздники.',
                image: 'https://via.placeholder.com/400x200',
                audio: 'data/audio/point1.mp3',
                status: 'not_visited'
            },
            {
                id: 2,
                number: 2,
                title: 'Вход в парк',
                lat: 44.0440,
                lng: 42.8620,
                description: 'Главный вход в Курортный парк Ессентуков с красивой аркой и аллеей.',
                image: 'https://via.placeholder.com/400x200',
                audio: 'data/audio/point2.mp3',
                status: 'not_visited'
            },
            {
                id: 3,
                number: 3,
                title: 'Театр-парк',
                lat: 44.0450,
                lng: 42.8640,
                description: 'Уникальный парковый комплекс с летним театром и фонтанами.',
                image: 'https://via.placeholder.com/400x200',
                audio: 'data/audio/point3.mp3',
                status: 'not_visited'
            },
            {
                id: 4,
                number: 4,
                title: 'Источник № 17',
                lat: 44.0460,
                lng: 42.8660,
                description: 'Знаменитый питьевой источник минеральной воды, известный своими лечебными свойствами.',
                image: 'https://via.placeholder.com/400x200',
                audio: 'data/audio/point4.mp3',
                status: 'not_visited'
            }
        ];
        initMap();
        addPointsToMap(points);
        document.getElementById('loadingState').style.display = 'none';
    }
}

// Start app
initApp();