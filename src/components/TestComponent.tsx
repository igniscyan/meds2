import React from 'react';

export function TestComponent() {
  return (
    <div className="p-4">
      <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold">Tailwind Test</h2>
        <p className="mt-2">If you see this in white text on a blue background, Tailwind is working!</p>
      </div>
    </div>
  );
}