import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Grid.css';

const ROWS = 100;
const COLS = 26;

function Grid({
  cells,
  onCellChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  remoteCursors = {},
  onCursorMove,
  currentSheet,
  allSheets = []
}) {
  const [selectedCell, setSelectedCell] = useState({ row: 1, column: 1 });
  const [selectionRange, setSelectionRange] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFormulaMenu, setShowFormulaMenu] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isEditingFromFormulaBar, setIsEditingFromFormulaBar] = useState(false);

  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const formulaBarRef = useRef(null);
  const editingSheetRef = useRef(null);
  const formulaMenuRef = useRef(null);
  const colorPickerRef = useRef(null);

  const colors = [
    '#FFFFFF', '#FFEBEE', '#FCE4EC', '#F3E5F5', '#E8EAF6',
    '#E3F2FD', '#E0F2F1', '#E8F5E9', '#FFF9C4', '#FFF3E0',
    '#EFEBE9', '#FAFAFA', '#ECEFF1', '#FFCDD2', '#F8BBD0',
    '#E1BEE7', '#C5CAE9', '#BBDEFB', '#B2DFDB', '#C8E6C9',
    '#DCEDC8', '#F0F4C3', '#FFE0B2', '#D7CCC8', '#CFD8DC',
    '#000000', '#424242', '#757575', '#BDBDBD', '#E0E0E0'
  ];

  const formulas = [
    { name: 'SUM', description: 'Сумма', template: '=SUM(A1:A10)' },
    { name: 'AVERAGE', description: 'Среднее', template: '=AVERAGE(A1:A10)' },
    { name: 'MAX', description: 'Максимум', template: '=MAX(A1:A10)' },
    { name: 'MIN', description: 'Минимум', template: '=MIN(A1:A10)' },
    { name: 'COUNT', description: 'Количество', template: '=COUNT(A1:A10)' },
    { name: 'Сложение', description: 'A1+B1', template: '=A1+B1' },
    { name: 'Вычитание', description: 'A1-B1', template: '=A1-B1' },
    { name: 'Умножение', description: 'A1*B1', template: '=A1*B1' },
    { name: 'Деление', description: 'A1/B1', template: '=A1/B1' },
  ];

  // Синхронизация строки формул
  useEffect(() => {
    if (!editingCell && selectedCell) {
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const value = cell?.formula || cell?.value || '';
      setFormulaBarValue(value);
      setEditValue(value);
    }
  }, [selectedCell, editingCell, cells]);

  // Восстановление фокуса при смене листа
  useEffect(() => {
    if (editingCell && currentSheet && !editingSheetRef.current) {
      editingSheetRef.current = currentSheet;
    }
    if (editingCell && inputRef.current && !isEditingFromFormulaBar) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editingCell, currentSheet, isEditingFromFormulaBar]);

  // Обработка клика вне строки формул / меню
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        editingCell &&
        isEditingFromFormulaBar &&
        formulaBarRef.current &&
        !formulaBarRef.current.contains(e.target)
      ) {
        commitEditFromFormulaBar();
      }

      if (showFormulaMenu && formulaMenuRef.current && !formulaMenuRef.current.contains(e.target)) {
        setShowFormulaMenu(false);
      }

      if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell, isEditingFromFormulaBar, showFormulaMenu, showColorPicker]);

  // Drag selection
  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const getCellKey = (row, column) => `${row}_${column}`;

  const getCellDisplay = (row, column) => {
    const key = getCellKey(row, column);
    const cell = cells[key];
    if (!cell) return '';
    if (cell.formula) {
      return cell.value?.startsWith('#ОШИБКА') ? cell.value : (cell.value || '');
    }
    return cell.value || '';
  };

  const getCellStyle = (row, column) => {
    const key = getCellKey(row, column);
    const cell = cells[key];
    if (!cell?.style) return {};
    const { backgroundColor, color } = cell.style;
    return { backgroundColor, color };
  };

  const isCellInSelection = (row, column) => {
    if (!selectionRange) return selectedCell.row === row && selectedCell.column === column;
    const { start, end } = selectionRange;
    const minRow = Math.min(start.row, end.row), maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.column, end.column), maxCol = Math.max(start.column, end.column);
    return row >= minRow && row <= maxRow && column >= minCol && column <= maxCol;
  };

  const columnToLetter = (col) => {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  };

  const getCellReference = (row, column) => `${columnToLetter(column)}${row}`;

  const commitEdit = useCallback((row, column, value) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '=') {
      const key = getCellKey(row, column);
      const cell = cells[key];
      onCellChange(row, column, '', '', cell?.style || {});
    } else if (trimmed.startsWith('=')) {
      onCellChange(row, column, '', trimmed);
    } else {
      onCellChange(row, column, trimmed, '');
    }
  }, [cells, onCellChange]);

  const commitEditFromFormulaBar = useCallback(() => {
    if (!editingCell) return;
    const { row, column } = editingCell;
    commitEdit(row, column, formulaBarValue);
    setEditingCell(null);
    setEditValue('');
    setFormulaBarValue('');
    setIsEditingFromFormulaBar(false);
    editingSheetRef.current = null;
  }, [editingCell, formulaBarValue, commitEdit]);

  const handleFormulaSelect = (template) => {
    let formula = template;
    if (selectionRange) {
      const { start, end } = selectionRange;
      const startRef = getCellReference(start.row, start.column);
      const endRef = getCellReference(end.row, end.column);
      formula = formula.replace(/A1:A10/g, `${startRef}:${endRef}`).replace(/A1/g, startRef).replace(/B1/g, endRef);
    } else if (selectedCell) {
      const ref = getCellReference(selectedCell.row, selectedCell.column);
      formula = formula.replace(/A1:A10/g, ref).replace(/A1/g, ref);
      if (selectedCell.column < COLS) {
        const nextRef = getCellReference(selectedCell.row, selectedCell.column + 1);
        formula = formula.replace(/B1/g, nextRef);
      }
    }

    setEditingCell({ row: selectedCell.row, column: selectedCell.column });
    editingSheetRef.current = currentSheet;
    setEditValue(formula);
    setFormulaBarValue(formula);
    setIsEditingFromFormulaBar(false);
    setShowFormulaMenu(false);

    setTimeout(() => {
      inputRef.current?.focus();
      const match = formula.match(/([A-Z]+\d+:[A-Z]+\d+)/);
      if (match && inputRef.current) {
        const start = formula.indexOf(match[1]);
        inputRef.current.setSelectionRange(start, start + match[1].length);
      }
    }, 10);
  };

  const handleColorSelect = (color) => {
    const applyToRange = (minRow, maxRow, minCol, maxCol) => {
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const key = getCellKey(r, c);
          const cell = cells[key];
          const style = { ...(cell?.style || {}), backgroundColor: color };
          onCellChange(r, c, cell?.value || '', cell?.formula || '', style);
        }
      }
    };

    if (selectionRange) {
      const { start, end } = selectionRange;
      applyToRange(
        Math.min(start.row, end.row), Math.max(start.row, end.row),
        Math.min(start.column, end.column), Math.max(start.column, end.column)
      );
    } else if (selectedCell) {
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const style = { ...(cell?.style || {}), backgroundColor: color };
      onCellChange(selectedCell.row, selectedCell.column, cell?.value || '', cell?.formula || '', style);
    }
    setShowColorPicker(false);
  };

  const handleCellMouseDown = (row, column, e) => {
    if (editingCell) {
      e.preventDefault();
      return;
    }
    gridRef.current?.focus();
    if (e.shiftKey && selectedCell) {
      setSelectionRange({ start: selectedCell, end: { row, column } });
    } else {
      setSelectedCell({ row, column });
      setSelectionRange({ start: { row, column }, end: { row, column } });
      setIsSelecting(true);
    }
  };

  const handleCellMouseEnter = (row, column) => {
    if (isSelecting && selectionRange) {
      setSelectionRange({ ...selectionRange, end: { row, column } });
      setSelectedCell({ row, column });
    }
  };

  const handleCellClick = (row, column, e) => {
    if (editingCell) {
      e.preventDefault();
      e.stopPropagation();

      if (!editingSheetRef.current) editingSheetRef.current = currentSheet;

      let ref = getCellReference(row, column);
      if (editingSheetRef.current.id !== currentSheet.id) {
        ref = `${currentSheet.name}!${ref}`;
      }

      const current = isEditingFromFormulaBar ? formulaBarValue : editValue;
      const newValue = current.startsWith('=') ? current + ref : '=' + ref;

      if (isEditingFromFormulaBar) {
        setFormulaBarValue(newValue);
        setEditValue(newValue);
        setTimeout(() => formulaBarRef.current?.focus(), 0);
      } else {
        setEditValue(newValue);
        setFormulaBarValue(newValue);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      setSelectedCell({ row, column });
      setSelectionRange(null);
      return;
    }

    setSelectedCell({ row, column });
    setSelectionRange(null);
  };

  const handleCellDoubleClick = (row, column) => {
    setSelectedCell({ row, column });
    setSelectionRange(null);
    const key = getCellKey(row, column);
    const cell = cells[key];
    const value = cell?.formula || cell?.value || '';
    setEditingCell({ row, column });
    editingSheetRef.current = currentSheet;
    setEditValue(value);
    setIsEditingFromFormulaBar(false);
  };

  const handleInputChange = (e) => setEditValue(e.target.value);

  const handleFormulaBarChange = (e) => {
    const value = e.target.value;
    setEditValue(value);
    setFormulaBarValue(value);
    setIsEditingFromFormulaBar(true);
    if (!editingCell && selectedCell) {
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
    }
  };

  const handleFormulaBarFocus = () => {
    setIsEditingFromFormulaBar(true);
    if (!editingCell && selectedCell) {
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const value = cell?.formula || cell?.value || '';
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
      setEditValue(value);
      setFormulaBarValue(value);
    }
  };

  const handleFormulaBarKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditFromFormulaBar();
      if (selectedCell.row < ROWS) {
        const newRow = selectedCell.row + 1;
        setSelectedCell({ row: newRow, column: selectedCell.column });
        onCursorMove?.(newRow, selectedCell.column);
      }
      gridRef.current?.focus();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      setFormulaBarValue('');
      setIsEditingFromFormulaBar(false);
      editingSheetRef.current = null;
      gridRef.current?.focusFocus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEditFromFormulaBar();
      if (selectedCell.column < COLS) {
        setSelectedCell({ row: selectedCell.row, column: selectedCell.column + 1 });
      }
      gridRef.current?.focus();
    }
  };

  const handleInputBlur = () => {
    if (editingCell) {
      commitEdit(editingCell.row, editingCell.column, editValue);
      setEditingCell(null);
      setEditValue('');
      setIsEditingFromFormulaBar(false);
      editingSheetRef.current = null;
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputBlur();
      if (selectedCell.row < ROWS) {
        setSelectedCell({ row: selectedCell.row + 1, column: selectedCell.column });
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      editingSheetRef.current = null;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleInputBlur();
      if (selectedCell.column < COLS) {
        setSelectedCell({ row: selectedCell.row, column: selectedCell.column + 1 });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (document.activeElement === formulaBarRef.current) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && canUndo) {
      e.preventDefault(); onUndo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z')) && canRedo) {
      e.preventDefault(); onRedo(); return;
    }

    if (editingCell) return;

    if (['Delete', 'Backspace'].includes(e.key)) {
      e.preventDefault();
      const applyClear = (minRow, maxRow, minCol, maxCol) => {
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const key = getCellKey(r, c);
            const cell = cells[key];
            onCellChange(r, c, '', '', cell?.style || {});
          }
        }
      };
      if (selectionRange) {
        const { start, end } = selectionRange;
        applyClear(
          Math.min(start.row, end.row), Math.max(start.row, end.row),
          Math.min(start.column, end.column), Math.max(start.column, end.column)
        );
      } else if (selectedCell) {
        const key = getCellKey(selectedCell.row, selectedCell.column);
        const cell = cells[key];
        onCellChange(selectedCell.row, selectedCell.column, '', '', cell?.style || {});
      }
      return;
    }

    let newRow = selectedCell.row, newCol = selectedCell.column;
    if (e.key === 'ArrowUp' && newRow > 1) newRow--;
    else if (e.key === 'ArrowDown' && newRow < ROWS) newRow++;
    else if (e.key === 'ArrowLeft' && newCol > 1) newCol--;
    else if (e.key === 'ArrowRight' && newCol < COLS) newCol++;
    else if (e.key === 'Enter') {
      e.preventDefault();
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
      setEditValue(cell?.formula || cell?.value || '');
      setIsEditingFromFormulaBar(false);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
      setEditValue(e.key);
      setIsEditingFromFormulaBar(false);
      return;
    } else return;

    e.preventDefault();
    setSelectedCell({ row: newRow, column: newCol });
    onCursorMove?.(newRow, newCol);
  };

  return (
    <div className="grid-wrapper-container">
      {/* Toolbar */}
      <div className="toolbar">
        <button className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`} onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
          ↶ Отменить
        </button>
        <button className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`} onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
          ↷ Повторить
        </button>
        <div className="toolbar-separator" />

        <div className="dropdown">
          <button className="toolbar-btn" onClick={() => { setShowFormulaMenu(!showFormulaMenu); setShowColorPicker(false); }}>
            ƒ Формулы
          </button>
          {showFormulaMenu && (
            <div ref={formulaMenuRef} className="formula-menu" onClick={e => e.stopPropagation()}>
              <div className="formula-menu-header">Выберите формулу</div>
              <div className="formula-list">
                {formulas.map((f, i) => (
                  <div key={i} className="formula-item" onClick={() => handleFormulaSelect(f.template)} title={f.template}>
                    <div className="formula-name">{f.name}</div>
                    <div className="formula-desc">{f.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dropdown">
          <button className="toolbar-btn" onClick={() => { setShowColorPicker(!showColorPicker); setShowFormulaMenu(false); }}>
            Цвет
          </button>
          {showColorPicker && (
            <div ref={colorPickerRef} className="color-picker" onClick={e => e.stopPropagation()}>
              <div className="color-picker-grid">
                {colors.map((c, i) => (
                  <div key={i} className="color-item" style={{ backgroundColor: c }} onClick={() => handleColorSelect(c)} title={c} />
                ))}
              </div>
              <button className="color-remove-btn" onClick={() => handleColorSelect('#FFFFFF')}>
                Убрать цвет
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formula Bar */}
      <div className="formula-bar">
        <div className="formula-bar-label">
          {selectedCell ? getCellReference(selectedCell.row, selectedCell.column) : ''}
        </div>
        <div className="formula-bar-separator" />
        <input
          ref={formulaBarRef}
          type="text"
          className="formula-bar-input"
          placeholder="Введите формулу или значение"
          value={editingCell ? (isEditingFromFormulaBar ? formulaBarValue : editValue) : formulaBarValue}
          onChange={handleFormulaBarChange}
          onFocus={handleFormulaBarFocus}
          onKeyDown={handleFormulaBarKeyDown}
        />
      </div>

      {/* Grid */}
      <div
        className="grid-container"
        ref={gridRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        onClick={() => { setShowColorPicker(false); setShowFormulaMenu(false); }}
      >
        <div className="grid-wrapper">
          <div className="grid-header">
            <div className="header-corner" />
            {Array.from({ length: COLS }, (_, i) => (
              <div key={i} className="header-cell">{columnToLetter(i + 1)}</div>
            ))}
          </div>

          {Array.from({ length: ROWS }, (_, ri) => {
            const row = ri + 1;
            return (
              <div key={row} className="grid-row">
                <div className="row-header">{row}</div>
                {Array.from({ length: COLS }, (_, ci) => {
                  const col = ci + 1;
                  const isEditing = editingCell?.row === row && editingCell?.column === col;
                  const showInput = isEditing && !isEditingFromFormulaBar;
                  const displayValue = isEditing
                    ? (isEditingFromFormulaBar ? formulaBarValue : editValue)
                    : getCellDisplay(row, col);

                  return (
                    <div
                      key={col}
                      className={`cell ${isCellInSelection(row, col) ? 'selected' : ''}`}
                      style={getCellStyle(row, col)}
                      onMouseDown={e => handleCellMouseDown(row, col, e)}
                      onMouseEnter={() => handleCellMouseEnter(row, col)}
                      onClick={e => { e.stopPropagation(); handleCellClick(row, col, e); }}
                      onDoubleClick={() => handleCellDoubleClick(row, col)}
                    >
                      {showInput ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className="cell-input"
                          value={editValue}
                          onChange={handleInputChange}
                          onBlur={handleInputBlur}
                          onKeyDown={handleInputKeyDown}
                          autoFocus
                        />
                      ) : (
                        <span className="cell-content">{displayValue}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Grid;