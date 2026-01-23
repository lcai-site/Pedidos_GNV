import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Logistics } from './pages/Logistics';
import { Sales, Subscriptions, Recovery } from './pages/OtherPages';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="logistics" element={<Logistics />} />
          <Route path="sales" element={<Sales />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="recovery" element={<Recovery />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
