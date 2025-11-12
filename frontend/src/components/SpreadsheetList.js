import React, { useState } from 'react';
import './SpreadsheetList.css';
import api from '../services/api';

function SpreadsheetList({ spreadsheets, currentSpreadsheet, onSelect, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (e, spreadsheet) => {
    e.stopPropagation();
    setEditingId(spreadsheet.id);
    setEditValue(spreadsheet.name);
  };

  const handleBlur = async (spreadsheet) => {
    const newName = editValue.trim();
    if (newName && newName !== spreadsheet.name) {
      try {
        await api.updateSpreadsheet(spreadsheet.id, { name: newName });
        if (onUpdate) {
          onUpdate();
        }
      } catch (error) {
        console.error('Ошибка обновления названия таблицы:', error);
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e, spreadsheet) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur(spreadsheet);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  return (
    <div className="spreadsheet-list">
      <h2>Таблицы</h2>
      <ul>
        {spreadsheets.map(spreadsheet => (
          <li
            key={spreadsheet.id}
            className={currentSpreadsheet?.id === spreadsheet.id ? 'active' : ''}
            onClick={() => {
              if (editingId !== spreadsheet.id) {
                onSelect(spreadsheet);
              }
            }}
          >
            {editingId === spreadsheet.id ? (
              <input
                type="text"
                className="spreadsheet-name-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleBlur(spreadsheet)}
                onKeyDown={(e) => handleKeyDown(e, spreadsheet)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span 
                className="spreadsheet-name"
                onDoubleClick={(e) => handleDoubleClick(e, spreadsheet)}
              >
                {spreadsheet.name}
              </span>
            )}
            <button
              className="btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Удалить "${spreadsheet.name}"?`)) {
                  onDelete(spreadsheet.id);
                }
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SpreadsheetList;

