import React from "react";

export default function AdminDashboard() {
  // Mock data representing the "Swarm" and "Headroom" metrics
  const recentLogs = [
    {
      id: "REQ-01",
      question: "TBK 49 nedir, örnek ver?",
      agent: "LAW_AGENT",
      compression: "84%",
      tokensSaved: 12400,
      status: "Success",
      time: "2 mins ago"
    },
    {
      id: "REQ-02",
      question: "Son yargıtay kararları nelerdir?",
      agent: "RESEARCH_AGENT",
      compression: "62%",
      tokensSaved: 4100,
      status: "Success",
      time: "15 mins ago"
    },
    {
      id: "REQ-03",
      question: "Bu metni özetle: ...",
      agent: "SUMMARY_AGENT",
      compression: "91%",
      tokensSaved: 32000,
      status: "Success",
      time: "1 hour ago"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans p-8">
      {/* Header */}
      <header className="mb-10 border-b border-gray-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI Swarm Dashboard
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Real-time monitoring for Headroom compression and Multi-Agent routing.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm text-gray-300">System Online</span>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-lg hover:border-gray-600 transition-all duration-300">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Tokens Saved</h3>
          <div className="text-4xl font-extrabold text-blue-400">1.2M</div>
          <p className="text-xs text-gray-500 mt-2">Via Headroom Proxy</p>
        </div>
        
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-lg hover:border-gray-600 transition-all duration-300">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Active Agents</h3>
          <div className="text-4xl font-extrabold text-purple-400">3</div>
          <p className="text-xs text-gray-500 mt-2">Law, Research, Summary</p>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-lg hover:border-gray-600 transition-all duration-300">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Avg. Compression Ratio</h3>
          <div className="text-4xl font-extrabold text-green-400">79%</div>
          <p className="text-xs text-gray-500 mt-2">Across all requests</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 bg-[#1c2128]">
          <h2 className="text-lg font-semibold text-gray-200">Recent Swarm Decisions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0d1117] text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Request ID</th>
                <th className="p-4 font-medium">Question Preview</th>
                <th className="p-4 font-medium">Assigned Agent</th>
                <th className="p-4 font-medium">Compression</th>
                <th className="p-4 font-medium">Tokens Saved</th>
                <th className="p-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300">
              {recentLogs.map((log, idx) => (
                <tr key={idx} className="border-b border-gray-800 hover:bg-[#1f242e] transition-colors">
                  <td className="p-4 font-mono text-xs text-gray-500">{log.id}</td>
                  <td className="p-4 truncate max-w-[200px]">{log.question}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
                      {log.agent}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-green-400 font-medium">{log.compression}</span>
                  </td>
                  <td className="p-4">{log.tokensSaved.toLocaleString()}</td>
                  <td className="p-4 text-gray-500 text-xs">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
