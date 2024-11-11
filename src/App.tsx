import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PocketBase from 'pocketbase';
import { Dashboard } from './components/Dashboard';
import { Patients } from './components/Patients';
import { Encounters } from './components/Encounters';
import { DrugInventory } from './components/DrugInventory';
import { TestComponent } from './components/TestComponent';

const pb = new PocketBase('http://127.0.0.1:8090');

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-blue-600">Medical Records System</h1>
                </div>
                
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link to="/" className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600">
                    Dashboard
                  </Link>
                  <Link to="/patients" className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600">
                    Patients
                  </Link>
                  <Link to="/encounters" className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600">
                    Encounters
                  </Link>
                  <Link to="/drugs" className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600">
                    Drug Inventory
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/encounters" element={<Encounters />} />
            <Route path="/drugs" element={<DrugInventory />} />
            <Route path="/test" element={<TestComponent />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;