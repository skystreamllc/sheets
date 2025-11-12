import React, { useState } from 'react';
import './SheetTabs.css';
import api from '../services/api';

function SheetTabs({ sheets, currentSheet, onSelect, onAdd, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (e, sheet) => {
    e.stopPropagation();
    setEditingId(sheet.id);
    setEditValue(sheet.name);
  };

  const handleBlur = async (sheet) => {
    const newName = editValue.trim();
    if (newName && newName !== sheet.name) {
      try {
        await api.updateSheet(sheet.id, { name: newName });
        if (onUpdate) {
          onUpdate();
        }
      } catch (error) {
        console.error('Ошибка обновления названия листа:', error);
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e, sheet) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur(sheet);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  return (
    <div className="sheet-tabs">
      <div className="tabs-container">
        {sheets.map(sheet => (
          <div
            key={sheet.id}
            className={`tab ${currentSheet?.id === sheet.id ? 'active' : ''}`}
            onClick={() => {
              if (editingId !== sheet.id) {
                onSelect(sheet);
              }
            }}
            onDoubleClick={(e) => handleDoubleClick(e, sheet)}
          >
            {editingId === sheet.id ? (
              <input
                type="text"
                className="tab-name-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleBlur(sheet)}
                onKeyDown={(e) => handleKeyDown(e, sheet)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="tab-name">{sheet.name}</span>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={onAdd}>
          +
        </button>
      </div>
    </div>
  );
}

export default SheetTabs;

