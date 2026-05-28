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

// ── Enviar imagen 
document.getElementById('btn-imagen').addEventListener('click', async function() {
    const archivo = document.getElementById('img-archivo').files[0];
    const operacion = document.getElementById('img-operacion').value;

    if (!archivo) return alert('Selecciona una imagen');
    if (!operacion) return alert('Selecciona una operación');

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
});

// ── Tarjetas de tareas 
function agregarTarea(taskId, tipo) {

	guardarTarea(taskId, tipo);
    const seccion = document.getElementById('tareas');

    const card = document.createElement('div');
    card.className = 'tarea-card';
    card.id = `tarea-${taskId}`;
    card.innerHTML = `
        <div class="tarea-preview" id="preview-${taskId}"></div>
        <div class="tarea-info">
            <div class="tarea-id">ID: ${taskId.slice(0, 8)}...</div>
            <div class="tarea-tipo">${tipo === 'imagen' ? '🖼 Imagen' : '▶ YouTube'}</div>
            <div class="tarea-status status-pendiente" id="status-${taskId}">Pendiente</div>
        </div>
        <div id="accion-${taskId}"></div>
    `;

    seccion.prepend(card);

    // Abrir SSE
    const ruta = tipo === 'imagen' ? 'imagen' : 'youtube';
    const es = new EventSource(`/${ruta}/stream/${taskId}`);

    es.onmessage = function(e) {
        const tarea = JSON.parse(e.data);
        actualizarTarea(taskId, tarea, tipo);

        if (['completada', 'error'].includes(tarea.status)) {
            es.close();
        }
    };
}

async function actualizarTarea(taskId, tarea, tipo) {
    const statusEl = document.getElementById(`status-${taskId}`);
    const accionEl = document.getElementById(`accion-${taskId}`);
    const previewEl = document.getElementById(`preview-${taskId}`);

    const labels = {
        pendiente: 'Pendiente',
        en_proceso: 'En proceso...',
        completada: 'Completada',
        error: 'Error',
    };

    statusEl.textContent = labels[tarea.status] || tarea.status;
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
}

// ── Drag & Drop ────────────────────────────────────────────────
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
    // Mostrar nombre
    document.getElementById('nombre-archivo').textContent = archivo.name;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('img-preview-src').src = e.target.result;
        document.getElementById('img-preview').style.display = 'block';
    };
    reader.readAsDataURL(archivo);
    
    // Guardar en el input para enviarlo después
    const dt = new DataTransfer();
    dt.items.add(archivo);
    inputArchivo.files = dt.files;
}

function guardarTarea(taskId, tipo, nombre) {
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    historial.unshift({ taskId, tipo, nombre, fecha: new Date().toLocaleString() });
    localStorage.setItem('historial', JSON.stringify(historial));
}

function cargarHistorial() {
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    historial.forEach(t => {
        agregarTarea(t.taskId, t.tipo);
    });
}

// Cargar historial al iniciar
cargarHistorial();
