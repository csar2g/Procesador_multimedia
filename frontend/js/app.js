// ── Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Quitar active de todos los tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Ocultar todos los contenidos
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        // Activar el tab clickeado
        tab.classList.add('active');
        // Mostrar el contenido correspondiente
        document.getElementById(tab.dataset.tab).classList.remove('hidden');
    });
});

// ── Operaciones de imagen
const opcionesMap = {
    'convertir': 'opts-convertir',
    'resize': 'opts-resize',
    'filtro': 'opts-filtro',
};

document.getElementById('img-operacion').addEventListener('change', function() {
    // Ocultar todos los campos de operación
    Object.values(opcionesMap).forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Mostrar solo el seleccionado
    const seleccionado = opcionesMap[this.value];
    if (seleccionado) {
        document.getElementById(seleccionado).classList.remove('hidden');
    }
});

// ── Preview de imagen 
document.getElementById('img-archivo').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('img-preview-src').src = e.target.result;
        document.getElementById('img-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
});

// ── Preview de YouTube
document.getElementById('yt-url').addEventListener('input', function() {
    const url = this.value;
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
        const videoId = match[1];
        document.getElementById('yt-preview-src').src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
        document.getElementById('yt-preview').style.display = 'block';
    } else {
        document.getElementById('yt-preview').style.display = 'none';
    }
});
