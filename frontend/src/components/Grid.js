import React, { useState, useRef, useEffect } from 'react';
import './Grid.css';

const ROWS = 100;
const COLS = 26;

function Grid({ cells, onCellChange, onUndo, onRedo, canUndo, canRedo, remoteCursors = {}, onCursorMove }) {
  const [selectedCell, setSelectedCell] = useState({ row: 1, column: 1 });
  const [selectionRange, setSelectionRange] = useState(null); // { start: {row, column}, end: {row, column} }
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFormulaMenu, setShowFormulaMenu] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const isClickingCell = useRef(false);
  
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
    { name: 'Процент от числа', description: '100*20%', template: '=100*20%' },
    { name: 'Процент от ячейки', description: 'A1*15%', template: '=A1*15%' },
  ];

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getCellKey = (row, column) => `${row}_${column}`;

  const getCellDisplay = (row, column) => {
    const key = getCellKey(row, column);
    const cell = cells[key];
    if (!cell) return '';
    
    // Если есть формула, показываем вычисленное значение
    if (cell.formula) {
      // Если значение начинается с #ОШИБКА, показываем его полностью
      if (cell.value && cell.value.startsWith('#ОШИБКА')) {
        return cell.value;
      }
      return cell.value || '';
    }
    
    // Если нет формулы, показываем просто значение
    return cell.value || '';
  };

  const getCellStyle = (row, column) => {
    const key = getCellKey(row, column);
    const cell = cells[key];
    if (!cell || !cell.style) return {};
    
    const style = {};
    if (cell.style.backgroundColor) {
      style.backgroundColor = cell.style.backgroundColor;
    }
    if (cell.style.color) {
      style.color = cell.style.color;
    }
    return style;
  };

  const isCellInSelection = (row, column) => {
    if (!selectionRange) {
      return selectedCell.row === row && selectedCell.column === column;
    }
    
    const { start, end } = selectionRange;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.column, end.column);
    const maxCol = Math.max(start.column, end.column);
    
    return row >= minRow && row <= maxRow && column >= minCol && column <= maxCol;
  };

  const handleFormulaSelect = (formulaTemplate) => {
    // Если есть выделенный диапазон, заменяем A1:A10 на реальный диапазон
    let formula = formulaTemplate;
    
    if (selectionRange) {
      const { start, end } = selectionRange;
      const startRef = getCellReference(start.row, start.column);
      const endRef = getCellReference(end.row, end.column);
      
      // Заменяем примеры диапазонов на реальные
      formula = formula.replace(/A1:A10/g, `${startRef}:${endRef}`);
      formula = formula.replace(/A1/g, startRef);
      formula = formula.replace(/B1/g, endRef);
    } else if (selectedCell) {
      const cellRef = getCellReference(selectedCell.row, selectedCell.column);
      // Для одиночной ячейки заменяем примеры
      formula = formula.replace(/A1:A10/g, cellRef);
      formula = formula.replace(/A1/g, cellRef);
      
      // Для B1 используем соседнюю ячейку
      if (selectedCell.column < COLS) {
        const nextCellRef = getCellReference(selectedCell.row, selectedCell.column + 1);
        formula = formula.replace(/B1/g, nextCellRef);
      }
    }
    
    // Переходим в режим редактирования выбранной ячейки
    if (selectedCell) {
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      setEditValue(formula);
      setShowFormulaMenu(false);
      
      // Фокусируемся на поле ввода
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Выделяем диапазон в формуле для удобного редактирования
          const rangeMatch = formula.match(/([A-Z]+\d+:[A-Z]+\d+)/);
          if (rangeMatch) {
            const startPos = formula.indexOf(rangeMatch[1]);
            const endPos = startPos + rangeMatch[1].length;
            inputRef.current.setSelectionRange(startPos, endPos);
          }
        }
      }, 10);
    }
  };

  const handleColorSelect = (color) => {
    if (selectionRange) {
      // Применяем цвет ко всем ячейкам в диапазоне
      const { start, end } = selectionRange;
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.column, end.column);
      const maxCol = Math.max(start.column, end.column);
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const cell = cells[key];
          const currentStyle = cell?.style || {};
          
          onCellChange(
            row,
            col,
            cell?.value || '',
            cell?.formula || '',
            { ...currentStyle, backgroundColor: color }
          );
        }
      }
    } else if (selectedCell) {
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const currentStyle = cell?.style || {};
      
      onCellChange(
        selectedCell.row,
        selectedCell.column,
        cell?.value || '',
        cell?.formula || '',
        { ...currentStyle, backgroundColor: color }
      );
    }
    setShowColorPicker(false);
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

  const getCellReference = (row, column) => {
    // Преобразуем координаты в ссылку на ячейку (например, A1, B2)
    return `${columnToLetter(column)}${row}`;
  };

  const handleCellMouseDown = (row, column, e) => {
    // Если мы в режиме редактирования, предотвращаем blur
    if (editingCell) {
      isClickingCell.current = true;
      e.preventDefault();
      // Небольшая задержка, чтобы blur не сработал
      setTimeout(() => {
        isClickingCell.current = false;
      }, 100);
      return;
    }
    
    // Начинаем выделение диапазона
    if (e.shiftKey && selectedCell) {
      // Shift+Click - расширяем выделение
      setSelectionRange({
        start: selectedCell,
        end: { row, column }
      });
    } else {
      // Обычный клик - начинаем новое выделение
      setSelectedCell({ row, column });
      setSelectionRange({
        start: { row, column },
        end: { row, column }
      });
      setIsSelecting(true);
    }
  };

  const handleCellMouseEnter = (row, column) => {
    if (isSelecting && selectionRange) {
      // Обновляем конец диапазона при перетаскивании
      setSelectionRange({
        start: selectionRange.start,
        end: { row, column }
      });
      setSelectedCell({ row, column });
    }
  };

  const handleCellClick = (row, column, e) => {
    // Если мы в режиме редактирования, добавляем ссылку на ячейку в формулу
    if (editingCell) {
      const cellRef = getCellReference(row, column);
      // Добавляем ссылку на ячейку в текущее значение формулы
      const currentValue = editValue || '';
      // Если формула уже начинается с =, просто добавляем ссылку
      if (currentValue.startsWith('=')) {
        setEditValue(currentValue + cellRef);
      } else {
        // Если нет =, добавляем = и ссылку
        setEditValue('=' + cellRef);
      }
      // Обновляем выделение, но остаемся в режиме редактирования
      setSelectedCell({ row, column });
      setSelectionRange(null);
      // Фокусируемся обратно на поле ввода
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Перемещаем курсор в конец
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 10);
      return;
    }
    
    // Если не в режиме редактирования, просто выделяем ячейку
    if (!e || !e.shiftKey) {
      setSelectedCell({ row, column });
      setSelectionRange(null);
    }
  };

  const handleCellDoubleClick = (row, column) => {
    // При двойном клике переходим в режим редактирования
    setSelectedCell({ row, column });
    setSelectionRange(null);
    setIsSelecting(false);
    const key = getCellKey(row, column);
    const cell = cells[key];
    setEditingCell({ row, column });
    // Показываем формулу, если она есть, иначе значение
    setEditValue(cell?.formula || cell?.value || '');
  };

  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleInputBlur = (e) => {
    // Если кликнули на ячейку, не выходим из режима редактирования
    if (isClickingCell.current) {
      return;
    }
    
    if (editingCell) {
      const { row, column } = editingCell;
      const value = editValue.trim();
      
      if (value.startsWith('=')) {
        onCellChange(row, column, '', value);
      } else {
        onCellChange(row, column, value, '');
      }
      
      setEditingCell(null);
      setEditValue('');
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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleInputBlur();
      if (selectedCell.column < COLS) {
        setSelectedCell({ row: selectedCell.row, column: selectedCell.column + 1 });
      }
    }
  };

  const handleKeyDown = (e) => {
    // Обработка Ctrl+Z (Undo) и Ctrl+Y/Ctrl+Shift+Z (Redo)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (onUndo && canUndo) {
        onUndo();
      }
      return;
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      if (onRedo && canRedo) {
        onRedo();
      }
      return;
    }
    
    if (editingCell) return;

    // Обработка Delete и Backspace для очистки ячеек
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      
      if (selectionRange) {
        // Очищаем все ячейки в диапазоне
        const { start, end } = selectionRange;
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.column, end.column);
        const maxCol = Math.max(start.column, end.column);
        
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            onCellChange(row, col, '', '', {});
          }
        }
      } else if (selectedCell) {
        // Очищаем одну ячейку
        onCellChange(selectedCell.row, selectedCell.column, '', '', {});
      }
      return;
    }

    let newRow = selectedCell.row;
    let newColumn = selectedCell.column;

    if (e.key === 'ArrowUp' && newRow > 1) {
      newRow--;
    } else if (e.key === 'ArrowDown' && newRow < ROWS) {
      newRow++;
    } else if (e.key === 'ArrowLeft' && newColumn > 1) {
      newColumn--;
    } else if (e.key === 'ArrowRight' && newColumn < COLS) {
      newColumn++;
    } else if (e.key === 'Enter') {
      // При нажатии Enter переходим в режим редактирования
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      setEditValue(cell?.formula || cell?.value || '');
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // При вводе символа переходим в режим редактирования
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      setEditValue(e.key);
      return;
    } else {
      return;
    }

    e.preventDefault();
    setSelectedCell({ row: newRow, column: newColumn });
    
    // Отправляем информацию о перемещении курсора
    if (onCursorMove) {
      onCursorMove(newRow, newColumn);
    }
  };

  return (
    <div className="grid-wrapper-container">
      {/* Панель инструментов */}
      <div className="toolbar">
        <button
          className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onUndo && canUndo) {
              onUndo();
            }
          }}
          title="Отменить (Ctrl+Z)"
          disabled={!canUndo}
        >
          ↶ Отменить
        </button>
        <button
          className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onRedo && canRedo) {
              onRedo();
            }
          }}
          title="Повторить (Ctrl+Y)"
          disabled={!canRedo}
        >
          ↷ Повторить
        </button>
        
        <div className="toolbar-separator"></div>
        
        <button
          className="toolbar-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowFormulaMenu(!showFormulaMenu);
            setShowColorPicker(false);
          }}
          title="Вставить формулу"
        >
          ƒ Формулы
        </button>
        {showFormulaMenu && (
          <div className="formula-menu" onClick={(e) => e.stopPropagation()}>
            <div className="formula-menu-header">Выберите формулу</div>
            <div className="formula-list">
              {formulas.map((formula, index) => (
                <div
                  key={index}
                  className="formula-item"
                  onClick={() => handleFormulaSelect(formula.template)}
                  title={formula.template}
                >
                  <div className="formula-name">{formula.name}</div>
                  <div className="formula-desc">{formula.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <button
          className="toolbar-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker(!showColorPicker);
            setShowFormulaMenu(false);
          }}
          title="Изменить цвет фона"
        >
          🎨 Цвет
        </button>
        {showColorPicker && (
          <div className="color-picker" onClick={(e) => e.stopPropagation()}>
            <div className="color-picker-grid">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className="color-item"
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  title={color}
                />
              ))}
            </div>
            <button
              className="color-remove-btn"
              onClick={() => handleColorSelect('#FFFFFF')}
            >
              Убрать цвет
            </button>
          </div>
        )}
      </div>
      
      <div
        className="grid-container"
        ref={gridRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        onClick={() => {
          setShowColorPicker(false);
          setShowFormulaMenu(false);
        }}
      >
        <div className="grid-wrapper">
        {/* Заголовки колонок */}
        <div className="grid-header">
          <div className="header-corner"></div>
          {Array.from({ length: COLS }, (_, i) => (
            <div key={i} className="header-cell">
              {columnToLetter(i + 1)}
            </div>
          ))}
        </div>

        {/* Строки */}
        {Array.from({ length: ROWS }, (_, rowIndex) => {
          const row = rowIndex + 1;
          return (
            <div key={row} className="grid-row">
              <div className="row-header">{row}</div>
              {Array.from({ length: COLS }, (_, colIndex) => {
                const column = colIndex + 1;
                const cellStyle = getCellStyle(row, column);
                const isInSelection = isCellInSelection(row, column);
                const isEditing = editingCell?.row === row && editingCell?.column === column;
                const displayValue = getCellDisplay(row, column);

                return (
                  <div
                    key={column}
                    className={`cell ${isInSelection ? 'selected' : ''}`}
                    style={cellStyle}
                    onMouseDown={(e) => handleCellMouseDown(row, column, e)}
                    onMouseEnter={() => handleCellMouseEnter(row, column)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(row, column, e);
                    }}
                    onDoubleClick={() => handleCellDoubleClick(row, column)}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="cell-input"
                        value={editValue}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        onKeyDown={handleInputKeyDown}
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

