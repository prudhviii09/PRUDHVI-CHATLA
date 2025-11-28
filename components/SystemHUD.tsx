import React, { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, Wifi, WifiOff, ShieldCheck, Terminal } from 'lucide-react';
import { SystemAction } from '../types';

interface SystemHUDProps {
  lastAction: SystemAction | null;
}

const SystemHUD: React.FC<SystemHUDProps> = ({ lastAction }) => {
  const [cpuUsage, setCpuUsage] = useState(12);
  const [ramUsage, setRamUsage] = useState(45);
  const [logs, setLogs] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Simulate system activity
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.max(5, Math.min(100, prev + (Math.random() * 10 - 5))));
      setRamUsage(prev => Math.max(30, Math.min(80, prev + (Math.random() * 4 - 2))));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update logs when actions happen
  useEffect(() => {
    if (lastAction) {
      const timestamp = new Date().toLocaleTimeString([], { hour12: false });
      const argsStr = JSON.stringify(lastAction.args).replace(/"/g, '');
      const logMsg = `[${timestamp}] EXEC: ${lastAction.toolName} ${argsStr}`;
      setLogs(prev => [logMsg, ...prev].slice(0, 5));
    }
  }, [lastAction]);

  return (
    <div className="absolute top-4 left-4 z-40 hidden lg:flex flex-col gap-2 font-mono text-[10px] pointer-events-none select-none">
      
      {/* System Stats Panel */}
      <div className="bg-black/40 backdrop-blur-md border border-cyan-500/30 p-3 rounded-lg w-48 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
        <div className="flex items-center gap-2 mb-2 text-cyan-400 border-b border-cyan-500/20 pb-1">
          <ShieldCheck size={12} />
          <span className="font-bold tracking-widest uppercase">Buddy System</span>
        </div>
        
        <div className="space-y-2 text-cyan-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Cpu size={10} /> <span>CPU</span>
            </div>
            <div className="w-16 h-1 bg-cyan-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-1000 ease-out" 
                style={{ width: `${cpuUsage}%` }} 
              />
            </div>
            <span className="w-6 text-right">{Math.round(cpuUsage)}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HardDrive size={10} /> <span>MEM</span>
            </div>
            <div className="w-16 h-1 bg-cyan-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-400 transition-all duration-1000 ease-out" 
                style={{ width: `${ramUsage}%` }} 
              />
            </div>
            <span className="w-6 text-right">{Math.round(ramUsage)}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity size={10} /> <span>NET</span>
            </div>
            {isOnline ? (
              <>
                <span className="text-green-400">ONLINE</span>
                <Wifi size={10} className="text-green-400" />
              </>
            ) : (
              <>
                <span className="text-red-400">OFFLINE</span>
                <WifiOff size={10} className="text-red-400" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Terminal/Log Panel */}
      <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-lg w-64 max-h-40 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 mb-2 text-gray-400 border-b border-white/10 pb-1">
          <Terminal size={12} />
          <span className="font-bold tracking-widest uppercase">Event Log</span>
        </div>
        <div className="flex flex-col gap-1 opacity-80">
          {logs.length === 0 && <span className="text-gray-600 italic">No recent commands...</span>}
          {logs.map((log, i) => (
            <div key={i} className="text-emerald-400 truncate animate-pulse-slow">
              <span className="text-gray-500 mr-1">{'>'}</span>
              {log}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default SystemHUD;