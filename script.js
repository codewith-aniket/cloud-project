let supabase = null;
let currentPath = '/';
let files = [];

document.getElementById('connectBtn').addEventListener('click', connectSupabase);
document.getElementById('createFolderBtn').addEventListener('createFolder');
document.getElementById('uploadBtn').addEventListener('click', uploadFiles);

// Connect to Supabase
async function connectSupabase() {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();
    
    if (!url || !key) {
        showStatus('Please enter both URL and Key', 'error');
        return;
    }

    try {
        supabase = supabase.createClient(url, key);
        showStatus('✅ Connected to Supabase successfully!', 'success');
        document.getElementById('createFolderBtn').disabled = false;
        document.getElementById('uploadBtn').disabled = false;
        document.getElementById('fileInput').disabled = false;
        document.getElementById('currentPath').textContent = currentPath;
        await loadFiles();
    } catch (error) {
        showStatus('❌ Connection failed: ' + error.message, 'error');
    }
}

// Create folder
document.getElementById('createFolderBtn').addEventListener('click', async () => {
    const folderName = document.getElementById('folderName').value.trim();
    if (!folderName || !supabase) return;

    try {
        const folderPath = currentPath === '/' ? `folder/${folderName}/` : `${currentPath}${folderName}/`;
        const { error } = await supabase.storage.from('files').createSignedUploadUrl(folderPath);
        
        // Create empty folder by uploading empty file
        const { data, error: uploadError } = await supabase.storage
            .from('files')
            .upload(folderPath + '.keep', new Blob(['']));
            
        if (uploadError) throw uploadError;
        
        document.getElementById('folderName').value = '';
        showStatus(`📁 Created folder: ${folderName}`, 'success');
        await loadFiles();
    } catch (error) {
        showStatus('❌ Failed to create folder: ' + error.message, 'error');
    }
});

// Upload files
document.getElementById('uploadBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files);
    
    if (!files.length || !supabase) return;

    for (let file of files) {
        const filePath = currentPath === '/' ? `files/${file.name}` : `${currentPath}${file.name}`;
        
        const { error } = await supabase.storage
            .from('files')
            .upload(filePath, file, { upsert: true });
            
        if (error) {
            showStatus(`❌ Upload failed: ${file.name}`, 'error');
        }
    }
    
    fileInput.value = '';
    showStatus(`✅ Uploaded ${files.length} files`, 'success');
    await loadFiles();
});

// Load files and folders
async function loadFiles() {
    if (!supabase) return;
    
    try {
        const { data, error } = await supabase.storage.from('files').list(currentPath, {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
        });
        
        if (error) throw error;
        
        files = data || [];
        renderFileGrid();
        updatePathDisplay();
    } catch (error) {
        showStatus('❌ Failed to load files: ' + error.message, 'error');
    }
}

// Render file grid
function renderFileGrid() {
    const grid = document.getElementById('fileGrid');
    grid.innerHTML = '';
    
    files.forEach(file => {
        const isFolder = file.name.endsWith('/') || file.name.endsWith('.keep');
        const displayName = isFolder ? file.name.replace(/\/$|\.keep$/, '') : file.name;
        const safeName = displayName.replace(/['"]/g, '');
        
        const div = document.createElement('div');
        div.className = `file-item ${isFolder ? 'folder' : 'file'}`;
        div.onclick = () => {
            if (isFolder) {
                currentPath = currentPath === '/' ? `/${safeName}/` : `${currentPath}${safeName}/`;
                loadFiles();
            }
        };
        
        div.innerHTML = `
            <div class="icon">${isFolder ? '📁' : '📄'}</div>
            <div class="name">${displayName}</div>
            <div class="actions">
                ${!isFolder ? `<button class="btn-download" onclick="downloadFile('${safeName}')">⬇️ Download</button>` : ''}
                <button class="btn-delete" onclick="deleteItem('${safeName}', ${isFolder})">🗑️ Delete</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// Download file
async function downloadFile(filename) {
    if (!supabase) return;
    
    const filePath = currentPath === '/' ? `files/${filename}` : `${currentPath}${filename}`;
    const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(filePath);
    
    const a = document.createElement('a');
    a.href = publicUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Delete file/folder
async function deleteItem(name, isFolder) {
    if (!supabase || !confirm(`Delete ${isFolder ? 'folder' : 'file'} "${name}"?`)) return;
    
    const path = currentPath === '/' ? `files/${name}` : `${currentPath}${name}`;
    const deletePath = isFolder ? `${path}/` : path;
    
    const { error } = await supabase.storage.from('files').remove([deletePath]);
    
    if (error) {
        showStatus('❌ Delete failed: ' + error.message, 'error');
    } else {
        showStatus('✅ Deleted successfully', 'success');
        await loadFiles();
    }
}

// Update path display with navigation
function updatePathDisplay() {
    document.getElementById('currentPath').textContent = currentPath;
}

// Status helper
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
}

// Auto-load files on connect
document.getElementById('fileInput').addEventListener('change', () => {
    if (document.getElementById('fileInput').files.length > 0) {
        document.getElementById('uploadBtn').style.background = '#28a745';
    }
});
