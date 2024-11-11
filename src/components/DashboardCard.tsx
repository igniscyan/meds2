import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
}

export function DashboardCard({ title, value }: DashboardCardProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="text-3xl font-bold text-blue-600">{value}</p>
    </div>
  );
}