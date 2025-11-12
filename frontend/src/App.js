import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import SpreadsheetList from './components/SpreadsheetList';
import SpreadsheetEditor from './components/SpreadsheetEditor';
import Login from './components/Login';
import api from './services/api';

function App() {
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [currentSpreadsheet, setCurrentSpreadsheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Проверяем, есть ли сохраненный токен
    const token = api.getAuthToken();
    if (token) {
      api.setAuthToken(token);
      api.getCurrentUser()
        .then(userData => {
          setUser(userData);
        })
        .catch(() => {
          api.setAuthToken(null);
        })
        .finally(() => {
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const loadSpreadsheets = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await api.getSpreadsheets();
      // Обрабатываем случай, если API возвращает объект с пагинацией
      const spreadsheetsList = Array.isArray(data) ? data : (data.results || []);
      setSpreadsheets(spreadsheetsList);
      setCurrentSpreadsheet(prev => {
        if (prev === null && spreadsheetsList.length > 0) {
          return spreadsheetsList[0];
        }
        return prev;
      });
    } catch (error) {
      console.error('Ошибка загрузки таблиц:', error);
      setSpreadsheets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSpreadsheets();
    }
  }, [user, loadSpreadsheets]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('current_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    api.setAuthToken(null);
    setUser(null);
    setSpreadsheets([]);
    setCurrentSpreadsheet(null);
  };

  if (checkingAuth) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const createSpreadsheet = async (name) => {
    try {
      const newSpreadsheet = await api.createSpreadsheet({ name });
      setSpreadsheets([...spreadsheets, newSpreadsheet]);
      setCurrentSpreadsheet(newSpreadsheet);
    } catch (error) {
      console.error('Ошибка создания таблицы:', error);
    }
  };

  const deleteSpreadsheet = async (id) => {
    try {
      await api.deleteSpreadsheet(id);
      setSpreadsheets(spreadsheets.filter(s => s.id !== id));
      if (currentSpreadsheet?.id === id) {
        setCurrentSpreadsheet(spreadsheets.find(s => s.id !== id) || null);
      }
    } catch (error) {
      console.error('Ошибка удаления таблицы:', error);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button
            className="btn btn-icon"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            title={sidebarVisible ? 'Скрыть панель таблиц' : 'Показать панель таблиц'}
          >
            ☰
          </button>
          <h1>📊 Sheets</h1>
        </div>
        <div className="header-right">
          <span className="user-name">{user.username}</span>
          <button 
            className="btn btn-secondary"
            onClick={handleLogout}
          >
            Выйти
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => createSpreadsheet('Новая таблица')}
          >
            + Создать таблицу
          </button>
        </div>
      </header>
      
      <div className="app-content">
        <div className={`sidebar-container ${sidebarVisible ? '' : 'collapsed'}`}>
          <SpreadsheetList
            spreadsheets={spreadsheets}
            currentSpreadsheet={currentSpreadsheet}
            onSelect={setCurrentSpreadsheet}
            onDelete={deleteSpreadsheet}
            onUpdate={loadSpreadsheets}
          />
        </div>
        
        {currentSpreadsheet && (
          <SpreadsheetEditor
            spreadsheet={currentSpreadsheet}
            onUpdate={loadSpreadsheets}
          />
        )}
      </div>
    </div>
  );
}

export default App;

