import { useState, useEffect, useCallback } from 'react';
import { TreeSidebar } from './components/TreeSidebar/TreeSidebar';
import { BudgetTable } from './components/BudgetTable/BudgetTable';
import { EditDrawer } from './components/EditDrawer/EditDrawer';
import { YearSelector } from './components/YearSelector/YearSelector';
import { WelcomeScreen } from './components/WelcomeScreen/WelcomeScreen';
import { getSections, getBudgetValues, getNotes, getBudgets, selectBudget, deselectBudget } from './api/client';
import type { Section, BudgetValues, Component, Notes, BudgetMetadata } from './types';
import './App.css';

type AppView = 'loading' | 'welcome' | 'budget';

function App() {
  const [view, setView] = useState<AppView>('loading');
  const [currentBudget, setCurrentBudget] = useState<BudgetMetadata | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [budgetValues, setBudgetValues] = useState<BudgetValues>({});
  const [notes, setNotes] = useState<Notes>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  // Initial load: check for last selected budget
  useEffect(() => {
    async function init() {
      try {
        const response = await getBudgets();

        if (response.lastSelectedBudgetId) {
          // Try to select the last used budget
          const budget = response.budgets.find((b) => b.id === response.lastSelectedBudgetId);
          if (budget) {
            try {
              await selectBudget(budget.id);
              setCurrentBudget(budget);
              setView('budget');
              return;
            } catch {
              // Budget selection failed, show welcome
            }
          }
        }

        // No last selected or selection failed, show welcome
        setView('welcome');
      } catch (err) {
        console.error('Failed to initialize:', err);
        setView('welcome');
      }
    }

    init();
  }, []);

  const fetchData = useCallback(async () => {
    if (view !== 'budget') return;

    try {
      setDataLoading(true);
      setError(null);
      const [sectionsData, valuesData, notesData] = await Promise.all([
        getSections(),
        getBudgetValues(selectedYear),
        getNotes(selectedYear),
      ]);
      setSections(sectionsData);
      setBudgetValues(valuesData);
      setNotes(notesData);
    } catch (err) {
      setError('Failed to load data.');
      console.error('Error fetching data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [selectedYear, view]);

  useEffect(() => {
    if (view === 'budget') {
      fetchData();
    }
  }, [fetchData, view]);

  const handleBudgetSelect = (budget: BudgetMetadata) => {
    setCurrentBudget(budget);
    setView('budget');
  };

  const handleSwitchBudget = async () => {
    try {
      await deselectBudget();
      setCurrentBudget(null);
      setSections([]);
      setBudgetValues({});
      setNotes({});
      setEditingComponent(null);
      setEditingSection(null);
      setView('welcome');
    } catch (err) {
      console.error('Failed to switch budget:', err);
    }
  };

  const handleComponentSelect = (component: Component, section: Section) => {
    setEditingComponent(component);
    setEditingSection(section);
    // Persist selected component ID
    if (currentBudget) {
      localStorage.setItem(`mattoni:${currentBudget.id}:selectedComponentId`, String(component.id));
    }
  };

  const handleCloseDrawer = () => {
    setEditingComponent(null);
    setEditingSection(null);
    // Clear persisted selection
    if (currentBudget) {
      localStorage.removeItem(`mattoni:${currentBudget.id}:selectedComponentId`);
    }
  };

  // Restore selected component after sections load
  useEffect(() => {
    if (!currentBudget || sections.length === 0 || editingComponent) return;

    const savedId = localStorage.getItem(`mattoni:${currentBudget.id}:selectedComponentId`);
    if (savedId) {
      const componentId = parseInt(savedId, 10);
      // Find component and its section
      for (const section of sections) {
        for (const group of section.groups) {
          const component = group.components.find((c) => c.id === componentId);
          if (component) {
            setEditingComponent(component);
            setEditingSection(section);
            return;
          }
        }
      }
      // Component not found, clear saved ID
      localStorage.removeItem(`mattoni:${currentBudget.id}:selectedComponentId`);
    }
  }, [currentBudget, sections]);

  const handleValuesChange = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Loading view
  if (view === 'loading') {
    return (
      <div className="app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Welcome view
  if (view === 'welcome') {
    return <WelcomeScreen onBudgetSelect={handleBudgetSelect} />;
  }

  // Budget view
  if (dataLoading && sections.length === 0) {
    return (
      <div className="app-loading">
        <p>Loading budget data...</p>
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
        {currentBudget && (
          <span className="current-budget-name">{currentBudget.name}</span>
        )}
        <button className="switch-budget-btn" onClick={handleSwitchBudget}>
          Switch Budget
        </button>
        <YearSelector year={selectedYear} onYearChange={setSelectedYear} />
      </header>
      <div className="app-content">
        <TreeSidebar
          sections={sections}
          budgetId={currentBudget?.id ?? null}
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
            notes={notes}
            year={selectedYear}
            budgetId={currentBudget?.id ?? null}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
