/**
 * KNOUX ONE — Network & DNS Optimizer View
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { INITIAL_LOCAL_PORTS } from '../../data/mockSystemData';
import { Wifi, Zap, Activity, CheckCircle2, RefreshCw, XCircle, Terminal } from 'lucide-react';

export const NetworkOptimizerView: React.FC = () => {
  const { addLog, requestElevation, t } = useKnoux();

  const [ports, setPorts] = useState(INITIAL_LOCAL_PORTS);
  const [dnsLatency, setDnsLatency] = useState<{ name: string; ip: string; pingMs: number }[]>([
    { name: 'Cloudflare DNS', ip: '1.1.1.1', pingMs: 12 },
    { name: 'Google Public DNS', ip: '8.8.8.8', pingMs: 18 },
    { name: 'Quad9 DNS', ip: '9.9.9.9', pingMs: 24 },
    { name: 'OpenDNS', ip: '208.67.222.222', pingMs: 29 }
  ]);
  const [isFlushingDns, setIsFlushingDns] = useState(false);

  const handleFlushDns = () => {
    setIsFlushingDns(true);
    setTimeout(() => {
      setIsFlushingDns(false);
      addLog('m10_s01', 'Flush DNS Resolver Cache', 'completed', 'Successfully purged Windows DNS Resolver Cache (ipconfig /flushdns).');
    }, 500);
  };

  const killPortProcess = (portNumber: number) => {
    requestElevation(
      `Kill Process on Port ${portNumber}`,
      `إنهاء العملية على المنفذ ${portNumber}`,
      `Terminating process bound to local port ${portNumber} requires elevated permissions.`,
      `إنهاء العملية المرتبطة بالمنفذ ${portNumber} يتطلب صلاحيات المسؤول.`,
      'moderate',
      () => {
        setPorts(prev => prev.filter(p => p.port !== portNumber));
        addLog('m10_s03', 'Kill Local Port Process', 'completed', `Killed listening process on port ${portNumber}`);
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Wifi className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 10 • NETWORK STACK & LOCAL PORTS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Network & DNS Stack Optimizer', 'محسن الشبكة وذاكرة الـ DNS والمنافذ')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Flush DNS resolver cache, benchmark public DNS servers, reset TCP/IP Winsock stack, and manage local dev ports.',
              'تصفية ذاكرة الـ DNS، مقارنة أداء خوادم DNS العالمية، وإدارة واستكشاف المنافذ المحلية النشطة.'
            )}
          </p>
        </div>

        <button
          onClick={handleFlushDns}
          disabled={isFlushingDns}
          className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFlushingDns ? 'animate-spin' : ''}`} />
          <span>{isFlushingDns ? t('Flushing DNS...', 'جاري التصفية...') : t('Flush DNS Cache', 'تفرغ ذاكرة DNS')}</span>
        </button>
      </div>

      {/* Grid: DNS Benchmarking & Local Port Auditor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DNS Benchmarks */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{t('Public DNS Benchmark & Latency', 'مقارنة استجابة خوادم DNS العالمية')}</span>
          </h3>

          <div className="space-y-2">
            {dnsLatency.map((server, i) => (
              <div key={i} className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="font-bold text-white block">{server.name}</span>
                  <span className="text-[10px] text-gray-400">{server.ip}</span>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className="text-emerald-400 font-bold">{server.pingMs} ms</span>
                  <button className="px-2 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-[10px] text-purple-200">
                    {t('Set DNS', 'تعيين')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Open Dev Ports */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>{t('Active Local Ports & Processes', 'المنافذ المحلية النشطة (Dev Ports)')}</span>
          </h3>

          <div className="space-y-2">
            {ports.map(p => (
              <div key={p.port} className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="font-bold text-white">Port {p.port}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-300">
                      PID: {p.pid}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-0.5 truncate max-w-[200px]">{p.processName}</p>
                </div>

                <button
                  onClick={() => killPortProcess(p.port)}
                  className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-300 text-[10px] flex items-center space-x-1 rtl:space-x-reverse transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  <span>{t('Kill Process', 'إنهاء')}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
