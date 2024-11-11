import React from 'react';
import { DashboardCard } from './DashboardCard';

export function Dashboard() {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard title="Total Patients" value="0" />
        <DashboardCard title="Today's Encounters" value="0" />
        <DashboardCard title="Active Queue" value="0" />
      </div>
    </div>
  );
}