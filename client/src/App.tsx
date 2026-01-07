import { useState, useEffect, useCallback } from 'react';
import { TreeSidebar } from './components/TreeSidebar/TreeSidebar';
import { BudgetTable } from './components/BudgetTable/BudgetTable';
import { EditDrawer } from './components/EditDrawer/EditDrawer';
import { YearSelector } from './components/YearSelector/YearSelector';
import { getSections, getBudgetValues } from './api/client';
import type { Section, BudgetValues, Component } from './types';
import './App.css';

function App() {
  const [sections, setSections] = useState<Section[]>([]);
  const [budgetValues, setBudgetValues] = useState<BudgetValues>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sectionsData, valuesData] = await Promise.all([
        getSections(),
        getBudgetValues(selectedYear),
      ]);
      setSections(sectionsData);
      setBudgetValues(valuesData);
    } catch (err) {
      setError('Failed to load data. Make sure the server is running.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComponentSelect = (component: Component, section: Section) => {
    setEditingComponent(component);
    setEditingSection(section);
  };

  const handleCloseDrawer = () => {
    setEditingComponent(null);
    setEditingSection(null);
  };

  const handleValuesChange = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (loading && sections.length === 0) {
    return (
      <div className="app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (error && sections.length === 0) {
    return (
      <div className="app-error">
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Mattoni</h1>
        <YearSelector year={selectedYear} onYearChange={setSelectedYear} />
      </header>
      <div className="app-content">
        <TreeSidebar
          sections={sections}
          onDataChange={fetchData}
          onComponentSelect={handleComponentSelect}
          selectedComponentId={editingComponent?.id ?? null}
        />
        <EditDrawer
          component={editingComponent}
          section={editingSection}
          year={selectedYear}
          onClose={handleCloseDrawer}
          onValuesChange={handleValuesChange}
        />
        <main className="app-main">
          <BudgetTable
            sections={sections}
            budgetValues={budgetValues}
            year={selectedYear}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
