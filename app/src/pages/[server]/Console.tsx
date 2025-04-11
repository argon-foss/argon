import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  SendIcon, Play, Square, RefreshCw,
  ChevronRight, AlertCircle, Globe, Hash, Terminal
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import AnsiParser from '../../components/AnsiParser';

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
  lastChecked: string;
}

interface ServerStatus {
  docker_id: string;
  name: string;
  image: string;
  state: string;
  memory_limit: number;
  cpu_limit: number;
  startup_command: string;
  allocation: string;
}

interface ServerDetails {
  id: string;
  internalId: string;
  name: string;
  memoryMiB: number;
  diskMiB: number;
  cpuPercent: number;
  state: string;
  createdAt: string;
  validationToken: string;
  node: Node;
  status: ServerStatus;
}

interface ConsoleMessage {
  event: string;
  data: {
    message?: string;
    status?: string;
    state?: string;
    logs?: string[];
    action?: string;
    cpu_percent?: number;
    memory?: {
      used: number;
      limit: number;
      percent: number;
    };
    network?: {
      rx_bytes: number;
      tx_bytes: number;
    };
  };
}

const formatBytes = (bytes: number | undefined, decimals = 2): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ServerConsolePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const [powerLoading, setPowerLoading] = useState(false);
  const [liveStats, setLiveStats] = useState<{
    cpuPercent: number;
    memory: { used: number; limit: number; percent: number };
    network: { rxBytes: number; txBytes: number };
  }>({
    cpuPercent: 0,
    memory: { used: 0, limit: 0, percent: 0 },
    network: { rxBytes: 0, txBytes: 0 }
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchServer = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/servers/${id}?include[node]=true&include[status]=true`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch server');
        const data = await response.json();
        
        if (!data.node?.fqdn || !data.node?.port) {
          throw new Error('Server node information is missing');
        }
        
        setServer(data);
        initWebSocket(data);


      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchServer();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [messages]);

  const initWebSocket = (serverData: ServerDetails) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token not found');
      return;
    }
  
    // Close any existing WebSocket connection before creating a new one
    if (wsRef.current) {
      wsRef.current.close();
    }
  
    const wsUrl = `ws://${serverData.node.fqdn}:${serverData.node.port}?server=${serverData.internalId}&token=${serverData.validationToken}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
  
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
    };
  
    ws.onmessage = (event) => {
      const message: ConsoleMessage = JSON.parse(event.data);
      
      switch (message.event) {
        case 'console_output':
          if (typeof message.data.message === 'string') {
            // @ts-ignore
            setMessages(prev => [...prev, message.data.message]);
          }
          break;
        
        case 'auth_success':
          if (message.data.logs) {
            setMessages(message.data.logs.map(log => log));
          }
          break;
        
        case 'stats':
          if (message.data.cpu_percent !== undefined) {
            setLiveStats({
              cpuPercent: message.data.cpu_percent || 0,
              memory: message.data.memory || { used: 0, limit: 0, percent: 0 },
              network: message.data.network 
                ? { rxBytes: message.data.network.rx_bytes, txBytes: message.data.network.tx_bytes }
                : { rxBytes: 0, txBytes: 0 }
            });
          }
          
          if (message.data.state) {
            setServer(prev => prev ? { ...prev, state: message.data.state || prev.state } : null);
          }
          break;
        
        case 'power_status':
          if (message.data.status !== undefined) {
            // @ts-ignore
            setMessages(prev => [...prev, message.data.status.toString()]);
          }
          setPowerLoading(false);
          break;
        
        case 'error':
          const errorMsg = message.data.message || 'An unknown error occurred';
          setError(errorMsg);
          setMessages(prev => [...prev, `Error: ${errorMsg}`]);
          setPowerLoading(false);
          break;
      }
    };
  
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          initWebSocket(serverData);
        }
      }, 5000);
    };
  
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('We\'re having trouble connecting to your server...');
    };
  };

  const sendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !wsRef.current) {
      // Add visual feedback for why command wasn't sent
      setMessages(prev => [...prev, '\x1b[33m[System] Cannot send command - WebSocket not connected or empty command\x1b[0m']);
      return;
    }
  
    if (!isServerActive) {
      setMessages(prev => [...prev, '\x1b[33m[System] Cannot send command - server is not running\x1b[0m']);
      return;
    }
  
    try {
      wsRef.current.send(JSON.stringify({
        event: 'send_command',
        data: command
      }));
  
      // Log successful send
      setMessages(prev => [...prev, '\x1b[32m$ \x1b[0m' + command + '\x1b[0m']);
      setCommand('');
    } catch (error) {
      // Log any errors
      setMessages(prev => [...prev, `\x1b[31m[System] Failed to send command: ${error}\x1b[0m`]);
    }
  };
  
  // Add this function to verify WebSocket state
  const checkWebSocketStatus = () => {
    if (!wsRef.current) {
      return 'No WebSocket connection';
    }
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING:
        return 'Connecting...';
      case WebSocket.OPEN:
        return 'Connected';
      case WebSocket.CLOSING:
        return 'Closing...';
      case WebSocket.CLOSED:
        return 'Closed';
      default:
        return 'Unknown';
    }
  };

  const handlePowerAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!server || powerLoading || !wsRef.current) return;
    
    setPowerLoading(true);
    try {
      wsRef.current.send(JSON.stringify({
        event: 'power_action',
        data: { action }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} server`);
      setPowerLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'running': return 'text-green-500';
      case 'stopped': return 'text-red-500';
      case 'installing': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) return <LoadingSpinner />;

  const isServerActive = server?.state?.toLowerCase() === 'running';
  let allocation = server?.status?.allocation ? JSON.parse(server.status.allocation) : null;

  return (
    <div className="min-h-screen px-8 py-8 bg-gray-50">
      <div className="max-w-[1500px] mx-auto p-4 space-y-6">
        {/* Header Section */}
        <div className="space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-600">
            <button
              onClick={() => navigate('/servers')}
              className="hover:text-gray-900"
            >
              Servers
            </button>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-gray-900 font-medium">{server?.name}</span>
          </div>

          {/* Title and Actions */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">{server?.name}</h1>
            <div className="flex items-center space-x-3">
              {error && (
                <div className="flex items-center px-3 py-1.5 text-xs text-red-700 bg-red-50 
                              border border-red-100 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                  {error}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePowerAction('start')}
                  disabled={powerLoading || isServerActive}
                  className="flex items-center px-4 py-4 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-xl 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <Play className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={() => handlePowerAction('restart')}
                  disabled={powerLoading || !isServerActive}
                  className="flex items-center px-4 py-4 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-xl 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <RefreshCw className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={() => handlePowerAction('stop')}
                  disabled={powerLoading || !isServerActive}
                  className="flex items-center px-4 py-4 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-xl 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <Square className="w-4 h-4 text-gray-700" />
                </button>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center text-gray-500">
              <Hash className="w-4 h-4 mr-1.5" />
              <span>{server?.internalId.split('-', 1)}</span>
            </div>
            <div className="flex items-center text-gray-500">
              <Globe className="w-4 h-4 mr-1.5" />
              {/* @ts-ignore */}
              <span>{server?.allocation.alias ? server?.allocation.alias : server?.allocation.bindAddress}:{allocation?.port || 'unknown'}</span>
            </div>
            <div className={`flex items-center ${getStateColor(server?.state || '')}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                server?.state?.toLowerCase() === 'running' ? 'bg-green-500' :
                server?.state?.toLowerCase() === 'stopped' ? 'bg-red-500' :
                server?.state?.toLowerCase() === 'installed' ? 'bg-gray-500' :
                'bg-yellow-500'
              }`} />
              <span>
                {/* @ts-ignore */}
                {(server?.state.charAt(0).toUpperCase() + server?.state.slice(1)).replace('Installed', 'Connecting...')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-6 border-t border-b border-gray-200/50 py-8">
          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">CPU Usage</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive ? `${liveStats.cpuPercent.toFixed(1)}%` : '-'}
              </p>
            </div>
          </div>

          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">Memory</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive ? formatBytes(liveStats.memory.used) : '-'}
              </p>
              {isServerActive && (
                <span className="ml-2 text-sm font-medium text-gray-500">
                  / {formatBytes(server?.status.memory_limit)}
                </span>
              )}
            </div>
          </div>

          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">Network I/O</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive ? formatBytes(liveStats.network.rxBytes) : '-'}
              </p>
              {isServerActive && (
                <span className="ml-2 text-sm font-medium text-gray-500">
                  /s in
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Disk Space</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {formatBytes((server?.diskMiB || 0) * 1024 * 1024)}
              </p>
              <span className="ml-2 text-sm font-medium text-gray-500">total</span>
            </div>
          </div>
        </div>

        {/* Console */}
        <div className="border-2 border-gray-50 rounded-2xl ring-2 ring-gray-50
                      ring-offset-1 ring-offset-gray-300 bg-[#191b25]">
          <div 
            ref={consoleRef}
            style={{
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            }}
            className="h-[400px] p-4 overflow-y-auto text-xs text-gray-300 relative"
          >
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <AnsiParser key={index} text={msg} />
              ))
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 mt-4">
                <Terminal className="w-12 h-12 mb-2 ring-2 ring-[#191b25] border-4 border-[#191b25] ring-offset-1 
                                 ring-offset-white/5 opacity-80 bg-white/5 rounded-xl p-3" />
                <p className="text-sm mt-4 text-gray-400/90 font-medium">No console output available</p>
                <p className="text-xs mt-1">Perform an action to see some logs here!</p>
              </div>
            )}
          </div>

          <div className="bg-[#30313a] p-2 m-2 rounded-b-xl rounded-t-md">
            <form onSubmit={sendCommand} className="flex items-center space-x-3">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="$ server~"
                className="flex-1 bg-[#30313a] text-gray-100 rounded-md text-sm transition px-3 py-2 
                         focus:outline-none focus:ring-1 focus:ring-transparent placeholder:text-gray-500"
              />
              <div className="flex items-center space-x-2">
                <span className="text-xs hidden text-gray-500">
                  {checkWebSocketStatus()}
                </span>
                <button
                  type="submit"
                  disabled={!connected || !isServerActive}
                  className="flex items-center px-3 py-2 cursor-pointer border border-white/5 text-xs font-medium 
                           text-indigo-100 bg-indigo-800/30 rounded-md hover:bg-indigo-800/50 disabled:opacity-50 
                           disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <SendIcon className="w-3.5 h-3.5 mr-1.5" />
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerConsolePage;