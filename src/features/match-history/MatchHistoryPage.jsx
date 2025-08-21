// src/features/match-history/MatchHistoryPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getAllHistory } from "./matchHistoryService";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from "recharts";

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString();
}

export default function MatchHistoryPage({ uid }) {
  // uid: current logged in user's uid (pass from your auth context or props)
  const [dataByOpp, setDataByOpp] = useState({});

  useEffect(() => {
    async function load() {
      const res = await getAllHistory({ uid });
      setDataByOpp(res || {});
    }
    if (uid) load();
  }, [uid]);

  const flatRows = useMemo(() => {
    // Flatten: [{oppId, opportunityName, timestamp, date, score, delta}]
    const rows = [];
    Object.entries(dataByOpp).forEach(([oppId, entries]) => {
      entries.forEach(e => {
        rows.push({
          oppId,
          opportunityName: e.opportunityName || oppId,
          timestamp: e.timestamp,
          date: formatDate(e.timestamp),
          score: e.score,
          delta: e.delta
        });
      });
    });
    // sort by timestamp
    rows.sort((a, b) => a.timestamp - b.timestamp);
    return rows;
  }, [dataByOpp]);

  const opportunityNames = useMemo(() => {
    const map = {};
    flatRows.forEach(r => { map[r.oppId] = r.opportunityName; });
    return map;
  }, [flatRows]);

  const grouped = useMemo(() => {
    // { oppId: [{date, score}] }
    const g = {};
    flatRows.forEach(r => {
      if (!g[r.oppId]) g[r.oppId] = [];
      g[r.oppId].push({ date: r.date, score: r.score });
    });
    return g;
  }, [flatRows]);

  const firstOppId = Object.keys(grouped)[0];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Opportunity Match History</h1>
      <p className="text-sm opacity-80">
        Track how your FitScore changed over time for saved/applied opportunities.
      </p>

      {/* Chart per opportunity (simple MVP: show first; you can map them all if you want) */}
      {firstOppId ? (
        <div className="rounded-2xl p-4 shadow border">
          <div className="mb-3 font-medium">
            {opportunityNames[firstOppId]} – FitScore trend
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={grouped[firstOppId]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" name="FitScore (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-sm opacity-70">
          No history yet. Save an opportunity and record a FitScore first.
        </div>
      )}

      {/* Table of all entries */}
      <div className="rounded-2xl p-4 shadow border">
        <div className="mb-3 font-medium">All changes</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="py-2 pr-4">Opportunity</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">FitScore</th>
                <th className="py-2 pr-4">Δ Change</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-4">{r.opportunityName}</td>
                  <td className="py-2 pr-4">{r.date}</td>
                  <td className="py-2 pr-4">{r.score}%</td>
                  <td className="py-2 pr-4">{r.delta > 0 ? `+${r.delta}%` : `${r.delta}%`}</td>
                </tr>
              ))}
              {flatRows.length === 0 && (
                <tr>
                  <td className="py-2 pr-4" colSpan={4}>No entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
