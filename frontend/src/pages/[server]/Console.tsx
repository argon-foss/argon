import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  SendIcon, Play, Square, RefreshCw,
  ChevronRight, AlertCircle, Globe, Hash, Terminal,
  WifiOff
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
  unit?: {
    features?: string;
    startup?: {
      stopCommand?: string;
      readyRegex?: string;
      userEditable?: boolean;
    };
  };
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
  const [nodeDown, setNodeDown] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [stopCommandSent, setStopCommandSent] = useState(false); // New state to track stop command
  const MAX_CONNECTION_ATTEMPTS = 3;
  const [liveStats, setLiveStats] = useState<{
    cpuPercent: number;
    memory: { used: number; limit: number; percent: number };
    network: { rxBytes: number; txBytes: number };
  }>({
    cpuPercent: 0,
    memory: { used: 0, limit: 0, percent: 0 },
    network: { rxBytes: 0, txBytes: 0 }
  });
  const [showEulaModal, setShowEulaModal] = useState(false);
  const [eulaAccepting, setEulaAccepting] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Parse features from server unit data
  const getServerFeatures = () => {
    try {
      return server?.unit?.features ? JSON.parse(server.unit.features) : [];
    } catch (error) {
      console.error('Failed to parse server features:', error);
      return [];
    }
  };

  // Check if EULA acceptance is required
  const requiresEulaAcceptance = () => {
    const features = getServerFeatures();
    return features.some((feature: any) => feature.name === 'eula-agreement' && feature.type === 'required');
  };

  // Handle EULA acceptance
  const handleEulaAcceptance = async () => {
    if (!server || eulaAccepting) return;
    
    setEulaAccepting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Write eula=true to eula.txt using the filesystem API
      const response = await fetch(`http://${server.node.fqdn}:${server.node.port}/api/v1/filesystem/${server.internalId}/write/eula.txt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${server.validationToken}`,
          'Content-Type': 'text/plain'
        },
        body: 'eula=true'
      });

      // Kill the server
      if (wsRef.current) {
        // Send kill power action
        wsRef.current.send(JSON.stringify({
          event: 'power_action',
          data: { action: 'kill' }
        }));
      }

      if (!response.ok) {
        throw new Error(`Failed to write EULA file: ${response.status}`);
      }

      setMessages(prev => [...prev, '\x1b[32m[System] EULA accepted successfully. You can now start the server.\x1b[0m']);
      setShowEulaModal(false);
    } catch (error) {
      console.error('Failed to accept EULA:', error);
      setMessages(prev => [
        ...prev,
        `\x1b[31m[System] Failed to accept EULA: ${
          error instanceof Error ? error.message : String(error)
        }\x1b[0m`
      ]);
    } finally {
      setEulaAccepting(false);
    }
  };

  useEffect(() => {
    const fetchServer = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication token not found');
        }
        
        // Set a timeout to handle slow API responses
        const timeoutId = setTimeout(() => {
          if (loading) {
            setError('Server request is taking longer than expected...');
          }
        }, 3000);
        
        const response = await fetch(`/api/servers/${id}?include[node]=true&include[status]=true`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch server: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.node?.fqdn || !data.node?.port) {
          throw new Error('Server node information is missing');
        }
        
        setServer(data);
        initWebSocket(data);

      } catch (err) {
        console.error('Error fetching server:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
        setNodeDown(true); // Show node down state for any critical error
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
      setLoading(false);
      setNodeDown(true); // Immediately show node down state
      return;
    }
  
    // Close any existing WebSocket connection before creating a new one
    if (wsRef.current) {
      wsRef.current.close();
    }
  
    const wsUrl = `ws://${serverData.node.fqdn}:${serverData.node.port}?server=${serverData.internalId}&token=${serverData.validationToken}`;
    
    // Set a very short initial timeout to catch immediate connection failures
    const immediateTimeout = setTimeout(() => {
      // If we're still loading after this timeout, show a temporary message
      if (loading) {
        setError('Attempting to connect to Krypton node...');
      }
    }, 500);
    
    try {
      console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Set connection timeout - shorter to provide faster feedback
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout after 3 seconds');
          clearTimeout(immediateTimeout);
          ws.close();
          handleConnectionFailure();
        }
      }, 3000); // 3 seconds timeout - reduced for faster feedback
    
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        clearTimeout(immediateTimeout);
        console.log('WebSocket connected successfully');
        setConnected(true);
        setNodeDown(false);
        setError(null);
        setConnectionAttempts(0);
        setLoading(false);
      };
    
      ws.onmessage = (event) => {
        // Connection is working if we're getting messages
        setLoading(false);
        
        const message: ConsoleMessage = JSON.parse(event.data);
        
        switch (message.event) {
          case 'console_output':
            if (typeof message.data.message === 'string') {
              // Check for EULA requirement message
              const hasEulaMessage = message.data.message.includes('You need to agree to the EULA in order to run the server');
              const requiresEula = true; // requiresEulaAcceptance();
              const modalNotShown = !showEulaModal;
              
              console.log('EULA Check:', { 
                hasEulaMessage, 
                requiresEula, 
                modalNotShown, 
                features: getServerFeatures(),
                message: message.data.message 
              });
              
              if (hasEulaMessage && requiresEula && modalNotShown) {
                console.log('Showing EULA modal');
                setShowEulaModal(true);
              }
              
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
              const newState = message.data.state;
              setServer(prev => prev ? { ...prev, state: newState || prev.state } : null);
              
              // Reset stopCommandSent when server reaches stopped state
              if (newState?.toLowerCase() === 'stopped') {
                setStopCommandSent(false);
              }
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
    
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        clearTimeout(immediateTimeout);
        console.log(`WebSocket disconnected with code: ${event.code}, reason: ${event.reason}`);
        setConnected(false);
        
        // Only attempt to reconnect if the node is not marked as down
        if (!nodeDown) {
          // Increment connection attempts on close
          const newAttemptCount = connectionAttempts + 1;
          setConnectionAttempts(newAttemptCount);
          
          // If we've reached max attempts, mark node as down
          if (newAttemptCount >= MAX_CONNECTION_ATTEMPTS) {
            console.log(`Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Marking node as down.`);
            handleConnectionFailure();
          } else {
            console.log(`Connection attempt ${newAttemptCount} of ${MAX_CONNECTION_ATTEMPTS} failed. Retrying...`);
            // Otherwise try to reconnect after a short delay
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                initWebSocket(serverData);
              }
            }, 2000); // Shorter retry delay for faster feedback
          }
        }
      };
    
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        clearTimeout(immediateTimeout);
        console.error('WebSocket error:', error);
        // Don't immediately mark as failed on first error
        // The onclose handler will increment the attempt counter
      };
    } catch (error) {
      clearTimeout(immediateTimeout);
      console.error('Failed to create WebSocket:', error);
      handleConnectionFailure();
    }
  };

  const handleConnectionFailure = () => {
    // Ensure we immediately show the node down state
    setNodeDown(true);
    setConnected(false);
    setLoading(false);
    setError('Failed to connect to Krypton. The node may be down or experiencing issues.');
    
    console.log('Connection to Krypton failed. Node marked as down.');
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
  
  // Handle stop command (using server's configured stop command)
  const handleStopCommand = () => {
    if (!server || !wsRef.current || !isServerActive) return;
    
    const stopCommand = server.unit?.startup?.stopCommand || 'stop';
    
    try {
      wsRef.current.send(JSON.stringify({
        event: 'send_command',
        data: stopCommand
      }));

      // Set the flag to show kill button during stop process
      setStopCommandSent(true);

      // Log the stop command
      setMessages(prev => [...prev, `\x1b[33m[System] Sending stop command: ${stopCommand}\x1b[0m`]);
    } catch (error) {
      setMessages(prev => [...prev, `\x1b[31m[System] Failed to send stop command: ${error}\x1b[0m`]);
      // Reset the flag if there was an error
      setStopCommandSent(false);
    }
  };

  const handlePowerAction = async (action: 'start' | 'restart' | 'kill') => {
    if (!server || powerLoading || !wsRef.current) return;
    
    setPowerLoading(true);
    
    // Reset stop command sent flag when performing any power action
    if (action === 'kill' || action === 'start') {
      setStopCommandSent(false);
    }
    
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

  const handleRetryConnection = () => {
    setNodeDown(false);
    setConnectionAttempts(0);
    setLoading(true);
    
    if (server) {
      initWebSocket(server);
    } else {
      // Re-fetch the server if we don't have it
      window.location.reload();
    }
  };

  if (loading) return <LoadingSpinner />;

  // Show the node down state if the connection failed
  if (nodeDown) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="border border-gray-200 rounded-lg p-8">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-lg mb-6">
            <WifiOff className="w-8 h-8 text-gray-500" />
          </div>
          
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-2">Node connection failed</h2>
          
          <p className="text-gray-600 text-xs mb-6">
            We're unable to connect to your server. Please contact an administrator.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={handleRetryConnection}
              className="w-48 text-xs mr-2 py-2 px-4 bg-indigo-700 hover:bg-indigo-800 text-white rounded-md transition duration-200"
            >
              Retry Connection
            </button>
            
            <button
              onClick={() => navigate('/servers')}
              className="w-48 text-xs py-2 px-4 border border-gray-200 hover:bg-gray-100 text-gray-800 rounded-md transition duration-200"
            >
              Back to Servers
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isServerActive = server?.state?.toLowerCase() === 'running';
  let allocation = server?.status?.allocation ? JSON.parse(server.status.allocation) : null;

  return (
    <div className="min-h-screen bg-gray-50">
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
              {error && !nodeDown && (
                <div className="flex items-center px-3 py-1.5 text-xs text-red-700 bg-red-50 
                              border border-red-100 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                  {error}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePowerAction('start')}
                  disabled={powerLoading || isServerActive || !connected}
                  className="flex items-center px-3 py-2 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-lg 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <Play className="w-4 h-4 text-gray-700 mr-2" />
                  Start
                </button>
                <button
                  onClick={() => handlePowerAction('restart')}
                  disabled={powerLoading || !isServerActive || !connected}
                  className="flex items-center px-3 py-2 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-lg 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <RefreshCw className="w-4 h-4 text-gray-700 mr-2" />
                  Restart
                </button>
                <button
                  onClick={handleStopCommand}
                  disabled={!isServerActive || !connected}
                  className="flex items-center px-3 py-2 cursor-pointer text-xs font-medium text-gray-700
                           bg-white border border-gray-200 rounded-lg 
                           hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                >
                  <Square className="w-4 h-4 text-gray-700 mr-2" />
                  Stop
                </button>
                {/* Kill button - shown during power operations, restarting state, or when stop command has been sent */}
                {(powerLoading || 
                  server?.state?.toLowerCase() === 'restarting' || 
                  (stopCommandSent && isServerActive)) && (
                  <button
                    onClick={() => handlePowerAction('kill')}
                    className="flex items-center px-3 py-2 cursor-pointer text-xs font-medium text-white
                             bg-red-600 border border-red-600 rounded-lg 
                             hover:bg-red-700 transition-all duration-200"
                  >
                    <Square className="w-4 h-4 text-white mr-2" />
                    Kill
                  </button>
                )}
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
              <span>{allocation?.alias ? allocation.alias : allocation?.bindAddress}:{allocation?.port || 'unknown'}</span>
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
                {(server?.state?.charAt(0).toUpperCase() + server?.state?.slice(1) || '').replace('Installed', 'Connecting...')}
              </span>
            </div>
            {!connected && !nodeDown && (
              <div className="flex items-center text-yellow-600">
                <AlertCircle className="w-4 h-4 mr-1.5" />
                <span>Reconnecting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-6 border-t border-b border-gray-200/50 py-8">
          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">CPU Usage</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive && connected ? `${liveStats.cpuPercent.toFixed(1)}%` : '-'}
              </p>
            </div>
          </div>

          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">Memory</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive && connected ? formatBytes(liveStats.memory.used) : '-'}
              </p>
              {isServerActive && connected && (
                <span className="ml-2 text-sm font-medium text-gray-500">
                  / {formatBytes(server?.status?.memory_limit)}
                </span>
              )}
            </div>
          </div>

          <div className="border-r border-gray-200">
            <p className="text-sm font-medium text-gray-500">Network I/O</p>
            <div className="flex items-baseline mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {isServerActive && connected ? formatBytes(liveStats.network.rxBytes) : '-'}
              </p>
              {isServerActive && connected && (
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
                disabled={!connected || !isServerActive}
                className="flex-1 bg-[#30313a] text-gray-100 rounded-md text-sm transition px-3 py-2 
                         focus:outline-none focus:ring-1 focus:ring-transparent placeholder:text-gray-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex items-center space-x-2">
                <span className="text-xs hidden text-gray-500">
                  {connected ? 'Connected' : 'Disconnected'}
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

        {/* EULA Acceptance Modal */}
        {showEulaModal && (
          <div className="fixed inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-50">
            <div className="p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">EULA Agreement Required</h3>
              </div>
              
              <p className="text-gray-600 text-sm mb-6 mt-2">
                Your server requires acceptance of the Minecraft End User License Agreement (EULA) before it can start.
              </p>
              
              <div className="bg-gray-50 rounded-md p-3 mb-4">
                <p className="text-xs text-gray-700 leading-relaxed">
                  By accepting, you agree to the{' '}
                  <a 
                    href="https://www.minecraft.net/en-us/eula" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Minecraft End User License Agreement&nbsp;
                  </a>
                    and acknowledge that you have read and understood it.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowEulaModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 
                           border cursor-pointer border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEulaAcceptance}
                  disabled={eulaAccepting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 
                           cursor-pointer border border-gray-800 rounded-md hover:bg-gray-700 
                           disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {eulaAccepting ? 'Accepting...' : 'Accept EULA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerConsolePage;