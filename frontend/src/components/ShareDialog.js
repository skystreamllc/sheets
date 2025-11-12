import React, { useState, useEffect, useCallback } from 'react';
import './ShareDialog.css';
import api from '../services/api';

function ShareDialog({ spreadsheet, onClose }) {
  const [username, setUsername] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSharedUsers = useCallback(async () => {
    if (!spreadsheet) return;
    try {
      const data = await api.getSharedUsers(spreadsheet.id);
      setSharedUsers(data.users || []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
    }
  }, [spreadsheet]);

  useEffect(() => {
    if (spreadsheet) {
      loadSharedUsers();
    }
  }, [spreadsheet, loadSharedUsers]);

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.shareSpreadsheet(spreadsheet.id, username);
      setUsername('');
      await loadSharedUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка предоставления доступа');
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (usernameToRemove) => {
    try {
      await api.unshareSpreadsheet(spreadsheet.id, usernameToRemove);
      await loadSharedUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка отзыва доступа');
    }
  };

  if (!spreadsheet) return null;

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h3>Предоставить доступ</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="share-dialog-content">
          <form onSubmit={handleShare} className="share-form">
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !username.trim()}>
              {loading ? 'Добавление...' : 'Предоставить доступ'}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          <div className="shared-users-list">
            <h4>Пользователи с доступом:</h4>
            {sharedUsers.length === 0 ? (
              <p className="no-users">Нет пользователей с доступом</p>
            ) : (
              <ul>
                {sharedUsers.map(user => (
                  <li key={user.id}>
                    <span>{user.username}</span>
                    <button
                      className="remove-btn"
                      onClick={() => handleUnshare(user.username)}
                      title="Отозвать доступ"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareDialog;

