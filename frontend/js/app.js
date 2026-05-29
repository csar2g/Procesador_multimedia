// ── Constantes
const streamsActivos = {};

const statusLabel = {
    pendiente: 'Pendiente',
    en_proceso: 'En proceso...',
    completada: 'Completada',
    error: 'Error',
};

// ── Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
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
    Object.values(opcionesMap).forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    const seleccionado = opcionesMap[this.value];
    if (seleccionado) document.getElementById(seleccionado).classList.remove('hidden');
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

// ── Drag & Drop
const dropzone = document.getElementById('dropzone');
const inputArchivo = document.getElementById('img-archivo');

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const archivo = e.dataTransfer.files[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
        alert('Solo se aceptan imágenes');
        return;
    }
    cargarArchivo(archivo);
});

inputArchivo.addEventListener('change', function() {
    if (this.files[0]) cargarArchivo(this.files[0]);
});

function cargarArchivo(archivo) {
    document.getElementById('nombre-archivo').textContent = archivo.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('img-preview-src').src = e.target.result;
        document.getElementById('img-preview').style.display = 'block';
    };
    reader.readAsDataURL(archivo);
    const dt = new DataTransfer();
    dt.items.add(archivo);
    inputArchivo.files = dt.files;
}

// ── Signed POST a S3
async function subirArchivoS3(archivo) {
    try {
        const res = await fetch(`/s3/presigned-post?filename=${archivo.name}&content_type=${archivo.type}`);
        const data = await res.json();
        if (data.error) return null;
        const fd = new FormData();
        Object.entries(data.fields).forEach(([key, value]) => fd.append(key, value));
        fd.append('file', archivo);
        const uploadRes = await fetch(data.url, { method: 'POST', body: fd });
        if (uploadRes.ok) return `${data.url}${data.fields.key}`;
    } catch {
        console.warn('S3 no disponible');
    }
    return null;
}

// ── Enviar imagen
document.getElementById('btn-imagen').addEventListener('click', async function() {
    const archivo = document.getElementById('img-archivo').files[0];
    const operacion = document.getElementById('img-operacion').value;
    if (!archivo) return alert('Selecciona una imagen');
    if (!operacion) return alert('Selecciona una operación');

    const s3url = await subirArchivoS3(archivo);
    if (s3url) console.log('Subido a S3:', s3url);

    const fd = new FormData();
    fd.append('file', archivo);
    fd.append('operacion', operacion);
    if (operacion === 'convertir') {
        fd.append('formato', document.getElementById('img-formato').value);
    } else if (operacion === 'resize') {
        fd.append('ancho', document.getElementById('img-ancho').value);
        fd.append('alto', document.getElementById('img-alto').value);
    } else if (operacion === 'filtro') {
        fd.append('filtro', document.getElementById('img-filtro').value);
    }

    const res = await fetch('/imagen/procesar', { method: 'POST', body: fd });
    const data = await res.json();
    agregarTarea(data.task_id, 'imagen');
    watchTask(data.task_id, 'imagen');
});

// ── Enviar YouTube
document.getElementById('btn-youtube').addEventListener('click', async function() {
    const url = document.getElementById('yt-url').value.trim();
    const formato = document.getElementById('yt-formato').value;
    if (!url) return alert('Ingresa una URL');

    const fd = new FormData();
    fd.append('url', url);
    fd.append('formato', formato);

    const res = await fetch('/youtube/descargar', { method: 'POST', body: fd });
    const data = await res.json();
    agregarTarea(data.task_id, 'youtube');
    watchTask(data.task_id, 'youtube');
});

// ── Tarjetas
function agregarTarea(taskId, tipo, statusInicial = 'pendiente', guardar = true) {
    if (document.getElementById(`tarea-${taskId}`)) return;
    if (guardar) guardarTarea(taskId, tipo);

    const seccion = document.getElementById('tareas');
    const label = statusLabel[statusInicial] || 'Pendiente';
    const card = document.createElement('div');
    card.className = `tarea-card`;
    card.id = `tarea-${taskId}`;
    card.innerHTML = `
        <div class="tarea-preview" id="preview-${taskId}"></div>
        <div class="tarea-info">
            <div class="tarea-id">ID: ${taskId.slice(0, 8)}...</div>
            <div class="tarea-tipo">${tipo === 'imagen' ? '🖼 Imagen' : '▶ YouTube'}</div>
            <div class="tarea-status status-${statusInicial}" id="status-${taskId}">${label}</div>
        </div>
        <div id="accion-${taskId}"></div>
    `;
    seccion.prepend(card);
}

async function actualizarTarea(taskId, tarea, tipo) {
    const statusEl = document.getElementById(`status-${taskId}`);
    const accionEl = document.getElementById(`accion-${taskId}`);
    const previewEl = document.getElementById(`preview-${taskId}`);
    if (!statusEl) return;

    statusEl.textContent = statusLabel[tarea.status] || tarea.status;
    statusEl.className = `tarea-status status-${tarea.status}`;

    if (tarea.status === 'completada') {
        const ruta = tipo === 'imagen' ? 'imagen' : 'youtube';
        const res = await fetch(`/${ruta}/descargar/${taskId}`);
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            accionEl.innerHTML = `<a class="btn-descargar" href="${data.url}" target="_blank" download>Descargar</a>`;
        } else {
            accionEl.innerHTML = `<a class="btn-descargar" href="/${ruta}/descargar/${taskId}" download>Descargar</a>`;
        }
        if (tipo === 'imagen') {
            previewEl.innerHTML = `<img src="/${ruta}/descargar/${taskId}" alt="Resultado" />`;
        }
    }

    if (tarea.status === 'error') {
        accionEl.innerHTML = `<span style="color:var(--error);font-size:0.8rem;">${tarea.error || 'Error desconocido'}</span>`;
    }
}

// ── SSE
function watchTask(taskId, tipo) {

    // Evitar múltiples conexiones
    if (streamsActivos[taskId]) return;

    const ruta = tipo === 'imagen' ? 'imagen' : 'youtube';

    const es = new EventSource(`/${ruta}/stream/${taskId}`);

    streamsActivos[taskId] = es;

    es.onmessage = async function(e) {

        const tarea = JSON.parse(e.data);

        await actualizarTarea(taskId, tarea, tipo);

        if (['completada', 'error'].includes(tarea.status)) {
            es.close();
            delete streamsActivos[taskId];
        }
    };

    es.onerror = () => {
        es.close();
        delete streamsActivos[taskId];
    };
}

// ── Storage
function guardarTarea(taskId, tipo) {
    let historial = JSON.parse(localStorage.getItem('historial') || '[]');
    if (historial.find(t => t.taskId === taskId)) return;
    historial.unshift({ taskId, tipo, fecha: new Date().toLocaleString() });
    historial = historial.slice(0, 4); // solo las últimas 4
    localStorage.setItem('historial', JSON.stringify(historial));
}

async function cargarHistorial() {
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    for (const t of historial) {
        const ruta = t.tipo === 'imagen' ? 'imagen' : 'youtube';
        try {
            const res = await fetch(`/${ruta}/status/${t.taskId}`);
            const tarea = await res.json();
            if (!tarea.error) {
                agregarTarea(t.taskId, t.tipo, tarea.status, false);
                if (['pendiente', 'en_proceso'].includes(tarea.status)) {
                    watchTask(t.taskId, t.tipo);
                } else {
                    await actualizarTarea(t.taskId, tarea, t.tipo);
                }
            }
        } catch {
            console.warn('Error cargando tarea', t.taskId);
        }
    }
}

// ── Limpiar historial
document.getElementById('btn-limpiar').addEventListener('click', () => {
    localStorage.removeItem('historial');
    document.getElementById('tareas').innerHTML = '';
});

// ── Inicio
cargarHistorial();
