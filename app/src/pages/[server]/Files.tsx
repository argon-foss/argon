import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { 
  ChevronRight, AlertCircle, Folder, File, 
  Upload, Download, Trash2, RefreshCw, Search,
  FolderPlus, ArrowLeft, Archive, 
  Check, X, Edit2, MoreVertical, Copy,
  FilePlus, Package, Code, FileText, Image, 
  Music, Video, PackageOpen, Save, Move
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Types
interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
}

interface ServerDetails {
  id: string;
  internalId: string;
  validationToken: string;
  name: string;
  node: Node;
}

interface FileEntry {
  name: string;
  mode: string;
  size: number;
  isFile: boolean;
  isSymlink: boolean;
  modifiedAt: number;
  createdAt: number;
  mime: string;
  hidden?: boolean;
  readonly?: boolean;
  noDelete?: boolean;
  isCargoFile?: boolean;
  customProperties?: Record<string, any>;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface FileAction {
  loading: boolean;
  type: string;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface Modal {
  type: 'new-folder' | 'new-file' | 'file-editor' | 'compress' | 'rename' | 'move' | 'chmod';
  data?: any;
  loading?: boolean;
}

interface FileTypeInfo {
  icon: LucideIcon;
  canEdit: boolean;
  editor?: 'monaco';
  viewable: boolean;
}

interface DiskUsage {
  bytes: number;
  files: number;
  human: string;
}

// Utility functions
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (date: number): string => {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
};

// File type configuration
const fileTypes: Record<string, FileTypeInfo> = {
  'text/': { icon: FileText, canEdit: true, editor: 'monaco', viewable: true },
  'application/json': { icon: Code, canEdit: true, editor: 'monaco', viewable: true },
  'application/javascript': { icon: Code, canEdit: true, editor: 'monaco', viewable: true },
  'application/x-yaml': { icon: Code, canEdit: true, editor: 'monaco', viewable: true },
  'image/': { icon: Image, canEdit: false, viewable: false },
  'audio/': { icon: Music, canEdit: false, viewable: false },
  'video/': { icon: Video, canEdit: false, viewable: false },
  'application/zip': { icon: Package, canEdit: false, viewable: false },
  'default': { icon: File, canEdit: false, viewable: true }
};

const getFileTypeInfo = (mime: string): FileTypeInfo => {
  const match = Object.entries(fileTypes).find(([key]) => mime.startsWith(key));
  return match ? match[1] : fileTypes.default;
};

const canExtractFile = (mime: string): boolean => {
  return [
    'application/zip',
    'application/x-tar',
    'application/x-gzip',
    'application/x-rar-compressed'
  ].includes(mime);
};

// Maximum size for viewable files (10MB)
const MAX_VIEWABLE_FILE_SIZE = 10 * 1024 * 1024;

// Toast component
const Toast: React.FC<{ toast: Toast }> = ({ toast }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 
      ${toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}
  >
    {toast.type === 'success' ? (
      <Check className="w-4 h-4" />
    ) : (
      <AlertCircle className="w-4 h-4" />
    )}
    <span className="text-sm font-medium">{toast.message}</span>
  </motion.div>
);

// Custom checkbox component
const Checkbox: React.FC<{
  checked: boolean;
  onChange: () => void;
  className?: string;
}> = ({ checked, onChange, className = '' }) => (
  <label className={`inline-flex items-center cursor-pointer ${className}`}>
    <div 
      className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
        checked 
          ? 'bg-indigo-600 border-indigo-600' 
          : 'border-gray-300 bg-white'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
  </label>
);

// Context menu
const ContextMenu: React.FC<{
    file: FileEntry;
    position: { x: number; y: number };
    onClose: () => void;
    onAction: (action: string) => Promise<void>;
  }> = ({ file, position, onClose, onAction }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState(position);
    const fileType = getFileTypeInfo(file.mime);
  
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
          onClose();
        }
      };
  
      // Adjust position to keep menu in viewport
      const adjustPosition = () => {
        if (menuRef.current) {
          const rect = menuRef.current.getBoundingClientRect();
          const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
          };
  
          let x = position.x;
          let y = position.y;
  
          // Adjust horizontal position if menu would overflow
          if (x + rect.width > viewport.width) {
            x = Math.max(0, viewport.width - rect.width - 16); // 16px padding from edge
          }
  
          // Adjust vertical position if menu would overflow
          if (y + rect.height > viewport.height) {
            y = Math.max(0, viewport.height - rect.height - 16); // 16px padding from edge
          }
  
          setMenuPosition({ x, y });
        }
      };
  
      document.addEventListener('mousedown', handleClickOutside);
      
      // Use a small delay to ensure the menu has been rendered
      const timer = setTimeout(adjustPosition, 10);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        clearTimeout(timer);
      };
    }, [onClose, position]);

    const isViewable = fileType.viewable || file.size < MAX_VIEWABLE_FILE_SIZE;
    const isReadOnly = file.readonly === true;
    const isNoDelete = file.noDelete === true;

    const actions = [
      ...(fileType.canEdit || isViewable ? [{ label: 'Edit/View', icon: Edit2, action: 'edit' }] : []),
      ...(canExtractFile(file.mime) ? [{ label: 'Extract', icon: PackageOpen, action: 'extract' }] : []),
      { label: 'Download', icon: Download, action: 'download' },
      { label: 'Copy', icon: Copy, action: 'copy' },
      { label: 'Rename', icon: Edit2, action: 'rename', disabled: isReadOnly || isNoDelete },
      { label: 'Move', icon: Move, action: 'move', disabled: isReadOnly || isNoDelete },
      { label: 'Delete', icon: Trash2, action: 'delete', destructive: true, disabled: isNoDelete }
    ];

    return (
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
        style={{ top: menuPosition.y, left: menuPosition.x }}
      >
        {actions.map(({ label, icon: Icon, action, destructive, disabled }) => (
          <button
            key={action}
            onClick={() => {
              if (!disabled) {
                onAction(action);
              }
            }}
            disabled={disabled}
            className={`w-full px-3 py-2 text-left flex items-center space-x-2 text-sm 
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${destructive 
                ? 'text-red-600 hover:bg-red-50' 
                : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </motion.div>
    );
};

// Main component
const FileManager: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Core state
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [operationLoading, setOperationLoading] = useState<{[key: string]: boolean}>({});

  // UI state
  const [modal, setModal] = useState<Modal | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    file: FileEntry;
    position: { x: number; y: number };
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [search, setSearch] = useState('');
  const [fileActions, setFileActions] = useState<Record<string, FileAction>>({});
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Refs
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Computed values
  const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

  // Toast handler
  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // API calls
  const fetchServer = useCallback(async () => {
    try {
      const response = await fetch(`/api/servers/${id}?include[node]=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch server details');
      const data = await response.json();
      setServer(data);
    } catch (err) {
      setError('Failed to fetch server details');
      showToast('Failed to fetch server details', 'error');
    }
  }, [id, token, showToast]);

  const fetchFiles = useCallback(async () => {
    if (!server) return;

    try {
      setLoading(true);
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/list/${currentFullPath}?showHidden=${showHidden}`,
        { headers: { Authorization: `Bearer ${server?.validationToken}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch directory contents');
      const data = await response.json();
      setFiles(data.contents);
      setError(null);
    } catch (err) {
      setError('Failed to fetch files');
      showToast('Failed to fetch files', 'error');
    } finally {
      setLoading(false);
    }
  }, [server, currentFullPath, showHidden, showToast]);

  const fetchDiskUsage = useCallback(async () => {
    if (!server) return;

    try {
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/disk-usage`,
        { headers: { Authorization: `Bearer ${server?.validationToken}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch disk usage');
      const data = await response.json();
      setDiskUsage(data);
    } catch (err) {
      console.error('Failed to fetch disk usage:', err);
    }
  }, [server]);

  const getFileContents = useCallback(async (file: FileEntry): Promise<string> => {
    if (!server) return '';

    try {
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/contents/${currentFullPath}/${file.name}`,
        { headers: { Authorization: `Bearer ${server?.validationToken}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch file contents');
      return await response.text();
    } catch (err) {
      showToast('Failed to load file contents', 'error');
      return '';
    }
  }, [server, currentFullPath, showToast]);

  const searchFiles = useCallback(async (query: string) => {
    if (!server || !query) return;

    try {
      setLoading(true);
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(currentFullPath)}&showHidden=${showHidden}`,
        { headers: { Authorization: `Bearer ${server?.validationToken}` } }
      );

      if (!response.ok) throw new Error('Failed to search files');
      const data = await response.json();
      setFiles(data.results);
    } catch (err) {
      showToast('Failed to search files', 'error');
    } finally {
      setLoading(false);
    }
  }, [server, currentFullPath, showHidden, showToast]);

  // File operations
  const handleFileAction = useCallback(async (action: string, file: FileEntry) => {
    if (!server) return;

    try {
      setFileActions(prev => ({
        ...prev,
        [file.name]: { loading: true, type: action }
      }));

      switch (action) {
        case 'edit': {
          const content = await getFileContents(file);
          setModal({ type: 'file-editor', data: { file, content } });
          break;
        }
        
        case 'extract': {
          setOperationLoading(prev => ({ ...prev, extract: true }));
          const response = await fetch(
            `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/extract/${currentFullPath}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${server?.validationToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ file: file.name })
            }
          );

          if (!response.ok) throw new Error('Failed to extract archive');
          showToast(`Extracted ${file.name}`);
          await fetchFiles();
          setOperationLoading(prev => ({ ...prev, extract: false }));
          break;
        }

        case 'delete': {
          if (file.noDelete) {
            showToast(`Cannot delete protected file: ${file.name}`, 'error');
            break;
          }
          
          setOperationLoading(prev => ({ ...prev, delete: true }));
          const response = await fetch(
            `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/delete/${currentFullPath}/${file.name}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${server?.validationToken}` }
            }
          );

          if (!response.ok) throw new Error('Failed to delete file');
          showToast(`Deleted ${file.name}`);
          await fetchFiles();
          await fetchDiskUsage();
          setOperationLoading(prev => ({ ...prev, delete: false }));
          break;
        }

        case 'download': {
          window.open(
            `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/download/${currentFullPath}/${file.name}?token=${server?.validationToken}`,
            '_blank'
          );
          break;
        }

        case 'rename': {
          if (file.readonly || file.noDelete) {
            showToast(`Cannot rename protected file: ${file.name}`, 'error');
            break;
          }
          
          setModal({ type: 'rename', data: { file } });
          break;
        }

        case 'move': {
          if (file.readonly || file.noDelete) {
            showToast(`Cannot move protected file: ${file.name}`, 'error');
            break;
          }
          
          setModal({ type: 'move', data: { file } });
          break;
        }

        case 'copy': {
          setModal({ type: 'move', data: { file, isCopy: true } });
          break;
        }
      }
    } catch (err) {
      showToast(`Failed to ${action} ${file.name}`, 'error');
    } finally {
      setFileActions(prev => ({
        ...prev,
        [file.name]: { loading: false, type: action }
      }));
      setContextMenu(null);
    }
  }, [server, currentFullPath, getFileContents, fetchFiles, fetchDiskUsage, showToast]);

  const handleCreateFile = useCallback(async (name: string) => {
    if (!server) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/write/${currentFullPath}/${name}`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${server?.validationToken}`,
            'Content-Type': 'application/octet-stream'
          },
          body: ''
        }
      );

      if (!response.ok) throw new Error('Failed to create file');
      
      showToast(`Created file ${name}`);
      setModal(null);
      await fetchFiles();
      await fetchDiskUsage();
    } catch (err) {
      showToast('Failed to create file', 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, fetchFiles, fetchDiskUsage, showToast]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!server) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/create-directory/${currentFullPath}/${name}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${server?.validationToken}` }
        }
      );

      if (!response.ok) throw new Error('Failed to create folder');
      
      showToast(`Created folder ${name}`);
      setModal(null);
      await fetchFiles();
    } catch (err) {
      showToast('Failed to create folder', 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, fetchFiles, showToast]);

  const handleRenameFile = useCallback(async (file: FileEntry, newName: string) => {
    if (!server) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const oldPath = `${currentFullPath}/${file.name}`;
      const newPath = `${currentFullPath}/${newName}`;
      
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/rename`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${server?.validationToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ from: oldPath, to: newPath })
        }
      );

      if (!response.ok) throw new Error('Failed to rename file');
      
      showToast(`Renamed ${file.name} to ${newName}`);
      setModal(null);
      await fetchFiles();
    } catch (err) {
      showToast('Failed to rename file', 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, fetchFiles, showToast]);

  const handleMoveFile = useCallback(async (file: FileEntry, targetPath: string, isCopy: boolean = false) => {
    if (!server) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const fromPath = `${currentFullPath}/${file.name}`;
      const toPath = `${targetPath}/${file.name}`;
      
      if (isCopy) {
        const response = await fetch(
          `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/copy`,
          {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${server?.validationToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: fromPath, to: toPath })
          }
        );

        if (!response.ok) throw new Error('Failed to copy file');
        showToast(`Copied ${file.name} to ${targetPath}`);
      } else {
        const response = await fetch(
          `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/rename`,
          {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${server?.validationToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: fromPath, to: toPath })
          }
        );

        if (!response.ok) throw new Error('Failed to move file');
        showToast(`Moved ${file.name} to ${targetPath}`);
      }
      
      setModal(null);
      await fetchFiles();
      await fetchDiskUsage();
    } catch (err) {
      showToast(`Failed to ${isCopy ? 'copy' : 'move'} file`, 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, fetchFiles, fetchDiskUsage, showToast]);

  const handleChmodFile = useCallback(async (file: FileEntry, mode: string) => {
    if (!server) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const filePath = `${currentFullPath}/${file.name}`;
      
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/chmod`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${server?.validationToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ path: filePath, mode })
        }
      );

      if (!response.ok) throw new Error('Failed to change permissions');
      
      showToast(`Changed permissions for ${file.name}`);
      setModal(null);
      await fetchFiles();
    } catch (err) {
      showToast('Failed to change permissions', 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, fetchFiles, showToast]);

  const handleMassDelete = useCallback(async () => {
    if (!server || selectedFiles.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedFiles.size} items?`)) {
      return;
    }

    setOperationLoading(prev => ({ ...prev, massDelete: true }));
    let success = true;
    for (const fileName of selectedFiles) {
      try {
        const response = await fetch(
          `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/delete/${currentFullPath}/${fileName}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${server?.validationToken}` }
          }
        );

        if (!response.ok) {
          success = false;
          showToast(`Failed to delete ${fileName}`, 'error');
        }
      } catch (err) {
        success = false;
        showToast(`Failed to delete ${fileName}`, 'error');
      }
    }

    if (success) {
      showToast(`Deleted ${selectedFiles.size} items`);
    }
    setSelectedFiles(new Set());
    await fetchFiles();
    await fetchDiskUsage();
    setOperationLoading(prev => ({ ...prev, massDelete: false }));
  }, [server, currentFullPath, selectedFiles, fetchFiles, fetchDiskUsage, showToast]);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!server) return;

    const newUploads: UploadProgress[] = Array.from(files).map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));

    setUploads(prev => [...prev, ...newUploads]);

    for (const upload of newUploads) {
      const formData = new FormData();
      formData.append('files', upload.file);

      try {
        setUploads(prev => 
          prev.map(u => 
            u.file === upload.file 
              ? { ...u, status: 'uploading', progress: 10 } 
              : u
          )
        );
        
        const response = await fetch(
          `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/upload/${currentFullPath}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${server?.validationToken}` },
            body: formData
          }
        );

        if (!response.ok) throw new Error('Upload failed');

        setUploads(prev => 
          prev.map(u => 
            u.file === upload.file 
              ? { ...u, status: 'complete', progress: 100 } 
              : u
          )
        );
        showToast(`Uploaded ${upload.file.name}`);
      } catch (err) {
        setUploads(prev => 
          prev.map(u => 
            u.file === upload.file 
              ? { ...u, status: 'error', error: 'Upload failed' } 
              : u
          )
        );
        showToast(`Failed to upload ${upload.file.name}`, 'error');
      }
    }

    await fetchFiles();
    await fetchDiskUsage();
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status === 'pending' || u.status === 'uploading'));
    }, 3000);
  }, [server, currentFullPath, fetchFiles, fetchDiskUsage, showToast]);

  const handleCompress = useCallback(async (name: string) => {
    if (!server || selectedFiles.size === 0) return;

    try {
      setModal(prev => prev ? { ...prev, loading: true } : null);
      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/compress`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${server?.validationToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: Array.from(selectedFiles).map(f => `${currentFullPath}/${f}`),
            destination: `${currentFullPath}/${name}.zip`
          })
        }
      );

      if (!response.ok) throw new Error('Failed to create archive');
      
      showToast('Archive created successfully');
      setModal(null);
      setSelectedFiles(new Set());
      await fetchFiles();
      await fetchDiskUsage();
    } catch (err) {
      showToast('Failed to create archive', 'error');
      setModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [server, currentFullPath, selectedFiles, fetchFiles, fetchDiskUsage, showToast]);

  const handleSaveFile = useCallback(async (file: FileEntry, content: string): Promise<boolean> => {
    if (!server) return false;

    try {
      setFileActions(prev => ({
        ...prev,
        [file.name]: { loading: true, type: 'save' }
      }));

      const response = await fetch(
        `http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/write/${currentFullPath}/${file.name}`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${server?.validationToken}`,
            'Content-Type': 'application/octet-stream'
          },
          body: content
        }
      );

      if (!response.ok) throw new Error('Failed to save file');
      
      showToast('File saved successfully');
      return true;
    } catch (err) {
      showToast('Failed to save file', 'error');
      return false;
    } finally {
      setFileActions(prev => ({
        ...prev,
        [file.name]: { loading: false, type: 'save' }
      }));
    }
  }, [server, currentFullPath, showToast]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter') {
      dragCounterRef.current += 1;
    } else if (e.type === 'dragleave') {
      dragCounterRef.current -= 1;
    }
    
    if (e.type === 'dragenter' && dragCounterRef.current === 1) {
      setDropZoneActive(true);
    } else if (e.type === 'dragleave' && dragCounterRef.current === 0) {
      setDropZoneActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDropZoneActive(false);

    const { files } = e.dataTransfer;
    if (files?.length) {
      handleUpload(files);
    }
  }, [handleUpload]);

  // Select all files
  const toggleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.name)));
    }
  }, [files, selectedFiles.size]);

  // Handle toggle single file selection
  const toggleFileSelection = useCallback((fileName: string) => {
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(fileName)) {
        newSelected.delete(fileName);
      } else {
        newSelected.add(fileName);
      }
      return newSelected;
    });
  }, []);

  // Effect hooks
  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  useEffect(() => {
    if (server) {
      fetchFiles();
      fetchDiskUsage();
    }
  }, [server, fetchFiles, fetchDiskUsage]);

  useEffect(() => {
    // If search is not empty, execute search
    if (search.trim().length > 2) {
      const debounce = setTimeout(() => {
        searchFiles(search);
      }, 500);
      return () => clearTimeout(debounce);
    } else if (server && search.trim().length === 0) {
      // If search is cleared, fetch regular files
      fetchFiles();
    }
  }, [search, server, searchFiles, fetchFiles]);

  // Sort and filter files
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      // Folders first
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  return (
    <div 
      className="min-h-screen px-8 py-8 bg-gray-50"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {/* Toast Messages */}
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>

      {/* Drop Zone Overlay */}
      <AnimatePresence>
        {dropZoneActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-8 text-center"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Drop files to upload</h3>
              <p className="text-sm text-gray-500 mt-1">Files will be uploaded to current directory</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Files Action Bar */}
      <AnimatePresence>
        {selectedFiles.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3"
          >
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-900">
                {selectedFiles.size} {selectedFiles.size === 1 ? 'item' : 'items'} selected
              </span>
              <button
                onClick={() => setModal({ type: 'compress' })}
                disabled={operationLoading.compress}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Archive className="w-4 h-4 mr-1.5" />
                {operationLoading.compress ? 'Creating...' : 'Create Archive'}
              </button>
              <button
                onClick={handleMassDelete}
                disabled={operationLoading.massDelete}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                {operationLoading.massDelete ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setSelectedFiles(new Set())}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-1.5" />
                Clear Selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1500px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-600">
            <button
              onClick={() => navigate('/servers')}
              className="hover:text-gray-900 transition-colors duration-100"
            >
              Servers
            </button>
            <ChevronRight className="w-4 h-4 mx-1" />
            <button
              onClick={() => navigate(`/servers/${id}`)}
              className="hover:text-gray-900 transition-colors duration-100"
            >
              {server?.name}
            </button>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-gray-900 font-medium">Files</span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">File Manager</h1>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center px-3 py-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-md"
              >
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                {error}
              </motion.div>
            )}
          </div>
        </div>

        {/* Disk Usage */}
        {diskUsage && (
          <div className="flex items-center justify-end space-x-6 text-sm">
            <div className="flex items-center text-gray-500">
              <Save className="w-4 h-4 mr-1.5" />
              <span>{diskUsage.human} used</span>
            </div>
            <div className="flex items-center text-gray-500">
              <File className="w-4 h-4 mr-1.5" />
              <span>{diskUsage.files.toLocaleString()} files</span>
            </div>
          </div>
        )}

        {/* Path Navigation & Actions */}
        <div className="flex items-center justify-between">
          {/* Path */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPath(prev => prev.slice(0, -1))}
              disabled={currentPath.length === 0}
              className={`p-2 text-gray-500 transition-colors duration-100
                ${currentPath.length === 0 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:text-gray-900'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPath([])}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              home
            </button>

            {currentPath.map((segment, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => setCurrentPath(prev => prev.slice(0, index + 1))}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  {segment}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-40 px-3 py-1 pl-9 text-sm border border-gray-200 bg-white rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>

            {/* Show Hidden Files */}
            <button
              onClick={() => setShowHidden(prev => !prev)}
              className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${
                showHidden 
                  ? 'text-blue-700 bg-blue-50 border border-blue-200' 
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showHidden ? 'Hide Hidden Files' : 'Show Hidden Files'}
            </button>

            {/* New File */}
            <button
              onClick={() => setModal({ type: 'new-file' })}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <FilePlus className="w-4 h-4 mr-1.5" />
              New File
            </button>

            {/* New Folder */}
            <button
              onClick={() => setModal({ type: 'new-folder' })}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <FolderPlus className="w-4 h-4 mr-1.5" />
              New Folder
            </button>

            {/* Upload */}
            <label className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                onChange={e => {
                  if (e.target.files?.length) {
                    handleUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
            </label>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchFiles();
                fetchDiskUsage();
              }}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Upload Progress */}
        <AnimatePresence>
          {uploads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-2"
            >
              {uploads.map((upload, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-md">
                  <div className="flex items-center space-x-3">
                    <File className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{upload.file.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {upload.error ? (
                      <span className="text-xs text-red-600">{upload.error}</span>
                    ) : upload.status === 'complete' ? (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        <Check className="w-4 h-4 text-green-500" />
                      </motion.div>
                    ) : (
                      <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gray-900"
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* File List */}
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <LoadingSpinner />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-gray-200/50 rounded-xl overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="w-12 px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {sortedFiles.map(file => {
                  const fileType = getFileTypeInfo(file.mime);
                  const FileIcon = file.isFile ? fileType.icon : Folder;
                  const isViewable = fileType.canEdit || (!fileType.canEdit && file.size < MAX_VIEWABLE_FILE_SIZE);

                  return (
                    <motion.tr
                      key={file.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`${isViewable || !file.isFile ? 'cursor-pointer' : ''} 
                      hover:bg-gray-50 transition-colors duration-100 ${file.hidden ? 'bg-gray-50/70' : ''}`}
                      onClick={() => {
                        if (isViewable && file.isFile) {
                          handleFileAction('edit', file);
                        } else if (!file.isFile) {
                          setCurrentPath([...currentPath, file.name]);
                        }
                      }}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedFiles.has(file.name)}
                          onChange={() => toggleFileSelection(file.name)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <FileIcon 
                            className={`w-4 h-4 ${
                              !file.isFile 
                                ? 'text-[#8146ab]'  // Folder icon color - Argon Purple
                                : file.mime.startsWith('image/') 
                                ? 'text-amber-600'  // Image files
                                : file.mime.startsWith('text/') || file.mime.includes('javascript') || file.mime.includes('json')
                                ? 'text-blue-600'  // Text/code files
                                : file.mime.includes('pdf')
                                ? 'text-red-600'  // PDF files
                                : file.mime.startsWith('audio/')
                                ? 'text-yellow-600'  // Audio files
                                : file.mime.startsWith('video/')
                                ? 'text-pink-600'  // Video files
                                : file.mime.includes('zip') || file.mime.includes('tar') || file.mime.includes('compress')
                                ? 'text-orange-600'  // Archive files
                                : 'text-gray-600'  // Default
                            }`}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">
                              {file.name}
                              {file.hidden && <span className="ml-2 text-xs text-gray-500">(hidden)</span>}
                            </span>
                            {(file.readonly || file.noDelete) && (
                              <span className="text-xs text-gray-500">
                                {file.readonly && 'Read-only'}
                                {file.readonly && file.noDelete && ' • '}
                                {file.noDelete && 'Protected'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(file.modifiedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {file.mode}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({
                              file,
                              position: { x: e.clientX, y: e.clientY }
                            });
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}

                {sortedFiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Folder className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="text-sm">
                          {search ? (
                            <>No files matching "<span className="font-medium">{search}</span>"</>
                          ) : (
                            'This folder is empty'
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Modals */}
        <AnimatePresence>
          {modal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.1 }}
                className={`bg-white rounded-xl shadow-xl ${
                  modal.type === 'file-editor' ? 'w-[900px] h-[600px]' : 'w-[400px]'
                }`}
              >
                {/* File Editor Modal */}
                {modal.type === 'file-editor' && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {modal.data.file.name}
                        </h3>
                        {modal.data.file.readonly && (
                          <span className="text-xs text-red-600">Read-only file</span>
                        )}
                      </div>
                      <button
                        onClick={() => setModal(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <Editor
                        value={modal.data.content}
                        language={modal.data.file.mime.split('/')[1] || 'plaintext'}
                        theme="vs"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          padding: { top: 20 },
                          readOnly: modal.data.file.readonly === true
                        }}
                        onChange={content => {
                          setModal(prev => prev ? {
                            ...prev,
                            data: { ...prev.data, content }
                          } : null);
                        }}
                      />
                    </div>
                    <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                      <button
                        onClick={() => setModal(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        Close
                      </button>
                      {!modal.data.file.readonly && (
                        <button
                          onClick={async () => {
                            if (await handleSaveFile(modal.data.file, modal.data.content)) {
                              setModal(null);
                            }
                          }}
                          disabled={fileActions[modal.data.file.name]?.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md 
                                  hover:bg-gray-800 transition-colors duration-100 flex items-center 
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {fileActions[modal.data.file.name]?.loading ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* New File Modal */}
                {modal.type === 'new-file' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create New File</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleCreateFile(formData.get('name') as string);
                    }}>
                      <input
                        type="text"
                        name="name"
                        placeholder="File name"
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* New Folder Modal */}
                {modal.type === 'new-folder' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Folder</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleCreateFolder(formData.get('name') as string);
                    }}>
                      <input
                        type="text"
                        name="name"
                        placeholder="Folder name"
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? 'Creating...' : 'Create'}
                          </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Rename Modal */}
                {modal.type === 'rename' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Rename File</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleRenameFile(modal.data.file, formData.get('name') as string);
                    }}>
                      <input
                        type="text"
                        name="name"
                        defaultValue={modal.data.file.name}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? 'Renaming...' : 'Rename'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Move Modal */}
                {modal.type === 'move' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {modal.data.isCopy ? 'Copy' : 'Move'} {modal.data.file.name}
                    </h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleMoveFile(
                        modal.data.file, 
                        formData.get('path') as string, 
                        modal.data.isCopy
                      );
                    }}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Destination Path
                      </label>
                      <input
                        type="text"
                        name="path"
                        defaultValue={currentPath.length > 0 ? currentPath.join('/') : '/'}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? (modal.data.isCopy ? 'Copying...' : 'Moving...') : (modal.data.isCopy ? 'Copy' : 'Move')}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Change Permissions Modal */}
                {modal.type === 'chmod' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Change Permissions</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleChmodFile(modal.data.file, formData.get('mode') as string);
                    }}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Permission Mode (Octal)
                      </label>
                      <input
                        type="text"
                        name="mode"
                        defaultValue={modal.data.file.mode}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Examples: 644 (rw-r--r--), 755 (rwxr-xr-x), 777 (rwxrwxrwx)
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? 'Updating...' : 'Save'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Compress Modal */}
                {modal.type === 'compress' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create Archive</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await handleCompress(formData.get('name') as string);
                    }}>
                      <input
                        type="text"
                        name="name"
                        placeholder="Archive name (without .zip)"
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 
                                rounded-md bg-white text-gray-900
                                focus:outline-none focus:ring-2 focus:ring-gray-200
                                placeholder:text-gray-500"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        Selected items: {Array.from(selectedFiles).join(', ')}
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setModal(null)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 
                                  hover:text-gray-900 transition-colors duration-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modal.loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 
                                  rounded-md hover:bg-gray-800 
                                  transition-colors duration-100
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {modal.loading ? 'Creating...' : 'Create Archive'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context Menu */}
        <AnimatePresence>
          {contextMenu && (
            <ContextMenu 
              file={contextMenu.file}
              position={contextMenu.position}
              onClose={() => setContextMenu(null)}
              onAction={action => handleFileAction(action, contextMenu.file)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FileManager;