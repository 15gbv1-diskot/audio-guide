// Глобальные переменные
let points = [];
let map = null;
let markers = [];
let selectedLat = null;
let selectedLng = null;
let editingIndex = null;

// Инициализация карты
function initMap() {
    const defaultCoords = [44.0433, 42.8594]; // Ессентуки центр
    
    map = L.map('map').setView(defaultCoords, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Обработчик клика по карте
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Заполняем координаты в форме
        document.getElementById('pointLat').value = lat.toFixed(6);
        document.getElementById('pointLng').value = lng.toFixed(6);
        document.getElementById('displayLat').textContent = lat.toFixed(6);
        document.getElementById('displayLng').textContent = lng.toFixed(6);
        
        selectedLat = lat;
        selectedLng = lng;
        
        // Добавляем временный маркер
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
        }
        
        window.tempMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'temp-marker',
                html: '📍',
                iconSize: [32, 32]
            })
        }).addTo(map);
        
        showStatus(`Координаты установлены: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
        
        // Фокусируемся на поле названия
        document.getElementById('pointTitle').focus();
    });
    
    // Добавляем существующие точки
    updateMapMarkers();
}

// Обновление маркеров на карте
function updateMapMarkers() {
    // Удаляем старые маркеры
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Добавляем новые
    points.forEach((point, index) => {
        const color = point.status === 'not_visited' ? '#95a5a6' : 
                     point.status === 'current' ? '#3498db' : '#27ae60';
        
        const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                className: 'point-marker',
                html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px; cursor: pointer;">${point.number}</div>`,
                iconSize: [32, 32]
            })
        }).addTo(map);
        
        // Клик по маркеру - загрузить точку в форму
        marker.on('click', function() {
            loadPointToForm(index);
        });
        
        markers.push(marker);
    });
}

// Загрузка точки в форму для редактирования
function loadPointToForm(index) {
    const point = points[index];
    editingIndex = index;
    
    document.getElementById('pointNumber').value = point.number;
    document.getElementById('pointTitle').value = point.title;
    document.getElementById('pointLat').value = point.lat;
    document.getElementById('pointLng').value = point.lng;
    document.getElementById('displayLat').textContent = point.lat;
    document.getElementById('displayLng').textContent = point.lng;
    document.getElementById('pointDescription').value = point.description;
    document.getElementById('pointImage').value = point.image || '';
    document.getElementById('pointAudio').value = point.audio || '';
    document.getElementById('pointText').value = point.text || '';
    document.getElementById('pointDuration').value = point.duration || '';
    document.getElementById('pointStatus').value = point.status || 'not_visited';
    
    // Центрируем карту на точке
    map.setView([point.lat, point.lng], 17);
    
    // Подсвечиваем точку на карте
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
    }
    window.tempMarker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '📍',
            iconSize: [32, 32]
        })
    }).addTo(map);
    
    showStatus(`Редактирование: ${point.title}`, 'info');
    document.getElementById('pointTitle').focus();
}

// Load existing points
async function loadPoints() {
    try {
        const response = await fetch('data/points.json');
        if (response.ok) {
            points = await response.json();
            renderPointsList();
            updateMapMarkers();
        }
    } catch (error) {
        console.log('No existing points found, starting with empty list');
        points = [];
    }
}

// Render points list
function renderPointsList() {
    const container = document.getElementById('pointsList');
    const count = document.getElementById('pointCount');
    count.textContent = points.length;
    
    if (points.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Нет добавленных точек. Нажмите на карту, чтобы создать первую!</p>';
        return;
    }
    
    container.innerHTML = points.map((point, index) => `
        <div class="point-item" style="border-left-color: ${point.status === 'not_visited' ? '#95a5a6' : point.status === 'current' ? '#3498db' : '#27ae60'}">
            <div class="point-info">
                <h3>#${point.number} ${point.title}</h3>
                <p>${point.description.substring(0, 80)}${point.description.length > 80 ? '...' : ''}</p>
                <p style="font-size: 12px; color: #999;">📍 ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</p>
                <p style="font-size: 12px; color: #999;">🎵 ${point.audio ? 'Аудио есть' : 'Нет аудио'}</p>
            </div>
            <div class="point-actions">
                <button class="btn" onclick="loadPointToForm(${index})" style="padding: 4px 10px; font-size: 12px;">✏️</button>
                <button class="btn btn-danger" onclick="deletePoint(${index})" style="padding: 4px 10px; font-size: 12px;">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Add or update point
document.getElementById('pointForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const lat = parseFloat(document.getElementById('pointLat').value);
    const lng = parseFloat(document.getElementById('pointLng').value);
    
    if (isNaN(lat) || isNaN(lng)) {
        showStatus('❌ Пожалуйста, выберите координаты на карте или введите их вручную', 'error');
        return;
    }
    
    const point = {
        id: Date.now(),
        number: parseInt(document.getElementById('pointNumber').value),
        title: document.getElementById('pointTitle').value.trim(),
        lat: lat,
        lng: lng,
        description: document.getElementById('pointDescription').value.trim(),
        image: document.getElementById('pointImage').value || 'https://via.placeholder.com/400x300/3498db/ffffff?text=' + encodeURIComponent(document.getElementById('pointTitle').value),
        audio: document.getElementById('pointAudio').value || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        text: document.getElementById('pointText').value || '',
        duration: parseInt(document.getElementById('pointDuration').value) || 0,
        status: document.getElementById('pointStatus').value
    };
    
    // Проверка на дубликаты по номеру
    const existingIndex = points.findIndex(p => p.number === point.number);
    if (existingIndex !== -1 && editingIndex === null) {
        if (!confirm(`Точка #${point.number} уже существует. Обновить её?`)) {
            return;
        }
        points[existingIndex] = point;
        showStatus(`✅ Точка #${point.number} обновлена!`, 'success');
    } else if (editingIndex !== null) {
        points[editingIndex] = point;
        showStatus(`✅ Точка #${point.number} обновлена!`, 'success');
        editingIndex = null;
    } else {
        points.push(point);
        showStatus(`✅ Точка #${point.number} добавлена!`, 'success');
    }
    
    renderPointsList();
    updateMapMarkers();
    document.getElementById('pointForm').reset();
    document.getElementById('displayLat').textContent = '-';
    document.getElementById('displayLng').textContent = '-';
    
    // Убираем временный маркер
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    
    // Прокручиваем к списку
    document.querySelector('.points-list').scrollIntoView({ behavior: 'smooth' });
});

// Delete point
function deletePoint(index) {
    if (confirm(`Удалить точку #${points[index].number} "${points[index].title}"?`)) {
        points.splice(index, 1);
        renderPointsList();
        updateMapMarkers();
        showStatus('🗑️ Точка удалена', 'success');
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
        editingIndex = null;
        document.getElementById('pointForm').reset();
    }
}

// Clear form
document.getElementById('clearFormBtn').addEventListener('click', () => {
    document.getElementById('pointForm').reset();
    document.getElementById('displayLat').textContent = '-';
    document.getElementById('displayLng').textContent = '-';
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    editingIndex = null;
    showStatus('🔄 Форма очищена', 'info');
});

// Center map on Essentuki
document.getElementById('centerMapBtn').addEventListener('click', () => {
    map.setView([44.0433, 42.8594], 15);
    showStatus('🎯 Карта центрирована на Ессентуках', 'info');
});

// Clear all points
document.getElementById('clearPointsBtn').addEventListener('click', () => {
    if (points.length === 0) {
        showStatus('Нет точек для удаления', 'info');
        return;
    }
    if (confirm(`Удалить все ${points.length} точек? Это действие нельзя отменить!`)) {
        points = [];
        renderPointsList();
        updateMapMarkers();
        document.getElementById('pointForm').reset();
        editingIndex = null;
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
        showStatus('🗑️ Все точки удалены', 'success');
    }
});

// Export to JSON
document.getElementById('exportBtn').addEventListener('click', () => {
    if (points.length === 0) {
        showStatus('❌ Нет точек для экспорта', 'error');
        return;
    }
    
    const json = JSON.stringify(points, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'points.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus(`✅ Экспортировано ${points.length} точек в points.json`, 'success');
});

// Import from JSON
document.getElementById('importBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedPoints = JSON.parse(event.target.result);
                if (Array.isArray(importedPoints) && importedPoints.length > 0) {
                    if (confirm(`Импортировать ${importedPoints.length} точек? Текущие точки будут заменены.`)) {
                        points = importedPoints;
                        renderPointsList();
                        updateMapMarkers();
                        showStatus(`✅ Импортировано ${points.length} точек`, 'success');
                    }
                } else {
                    showStatus('❌ Файл не содержит точек', 'error');
                }
            } catch (error) {
                showStatus('❌ Ошибка при чтении файла. Проверьте формат JSON.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// Download all audio files
document.getElementById('downloadAudioBtn').addEventListener('click', async () => {
    if (points.length === 0) {
        showStatus('❌ Нет точек с аудио', 'error');
        return;
    }
    
    const audioUrls = points.filter(p => p.audio).map(p => p.audio);
    if (audioUrls.length === 0) {
        showStatus('❌ Нет аудиофайлов для скачивания', 'error');
        return;
    }
    
    showStatus(`📦 Скачивание ${audioUrls.length} аудиофайлов...`, 'info');
    
    for (const url of audioUrls) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const filename = url.split('/').pop() || 'audio.mp3';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            // Небольшая задержка между скачиваниями
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to download ${url}:`, error);
        }
    }
    
    showStatus('✅ Все аудиофайлы скачаны', 'success');
});

// Show status message
function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.style.display = 'block';
    
    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Проверка, что карта инициализирована
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация карты с небольшой задержкой для рендеринга
    setTimeout(() => {
        initMap();
        loadPoints();
    }, 100);
});