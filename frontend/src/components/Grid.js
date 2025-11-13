import React, { useState, useRef, useEffect } from 'react';
import './Grid.css';

const ROWS = 100;
const COLS = 26;

function Grid({ cells, onCellChange, onUndo, onRedo, canUndo, canRedo, remoteCursors = {}, onCursorMove, currentSheet, allSheets = [] }) {
  const [selectedCell, setSelectedCell] = useState({ row: 1, column: 1 });
  const [selectionRange, setSelectionRange] = useState(null); // { start: {row, column}, end: {row, column} }
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
  const isClickingCell = useRef(false);
  const editingSheetRef = useRef(null); // Сохраняем лист, на котором началось редактирование
  const editingFromFormulaBarRef = useRef(false);
  const isClickingFormulaBarRef = useRef(false);
  const blurTimeoutRef = useRef(null);
  
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
    if (!editingCell) {
      // Синхронизируем строку формул при изменении выбранной ячейки (только если не редактируем)
      if (selectedCell && !editingFromFormulaBarRef.current) {
        const key = getCellKey(selectedCell.row, selectedCell.column);
        const cell = cells[key];
        const value = cell?.formula || cell?.value || '';
        setFormulaBarValue(value);
        setEditValue(value);
        setIsEditingFromFormulaBar(false);
      }
      return;
    }
    
    // Устанавливаем фокус с небольшой задержкой, чтобы избежать конфликтов
    // Но только если фокус действительно потерян
    const timeoutId = setTimeout(() => {
      if (editingFromFormulaBarRef.current) {
        if (formulaBarRef.current) {
          // Проверяем, что фокус действительно не на строке формул
          const activeElement = document.activeElement;
          if (activeElement !== formulaBarRef.current && 
              !(activeElement?.closest && activeElement.closest('.formula-bar'))) {
            formulaBarRef.current.focus();
            const length = formulaBarRef.current.value.length;
            formulaBarRef.current.setSelectionRange(length, length);
          }
        }
      } else if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);
    
    return () => clearTimeout(timeoutId);
  }, [editingCell, selectedCell]);

  // При смене листа во время редактирования сохраняем режим редактирования
  // но обновляем editingSheetRef, если он еще не установлен
  // ВАЖНО: не перезаписываем editingSheetRef, если он уже установлен,
  // чтобы сохранить информацию о листе, где началось редактирование
  useEffect(() => {
    if (editingCell && currentSheet && !editingSheetRef.current) {
      editingSheetRef.current = currentSheet;
    }
    // Восстанавливаем фокус на поле ввода при смене листа, если редактирование активно
    if (editingCell && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [editingCell, currentSheet]);

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
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
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
    
    // Устанавливаем фокус на контейнер для обработки клавиатуры
    if (gridRef.current) {
      gridRef.current.focus();
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
    // Устанавливаем фокус на контейнер для обработки клавиатуры
    if (gridRef.current && !editingCell) {
      gridRef.current.focus();
    }
    
    // Если мы в режиме редактирования И редактируем не через строку формул, добавляем ссылку на ячейку в формулу
    if (editingCell && !editingFromFormulaBarRef.current) {
      e.preventDefault();
      e.stopPropagation();
      
      // Убеждаемся, что editingSheetRef установлен
      if (!editingSheetRef.current && currentSheet) {
        editingSheetRef.current = currentSheet;
      }
      
      let cellRef = getCellReference(row, column);
      
      // Проверяем, находится ли кликнутая ячейка на другом листе
      // Если редактирование началось на другом листе, добавляем имя текущего листа
      if (editingSheetRef.current && currentSheet) {
        // Если редактирование началось на другом листе, добавляем имя текущего листа
        if (editingSheetRef.current.id !== currentSheet.id) {
          // Ячейка на другом листе - добавляем имя листа
          cellRef = `${currentSheet.name}!${cellRef}`;
        }
        // Если редактирование и клик на одном листе, просто добавляем ссылку без имени листа
      }
      
      // Добавляем ссылку на ячейку в текущее значение формулы
      const currentValue = editValue || '';
      let newValue;
      // Если формула уже начинается с =, просто добавляем ссылку
      if (currentValue.startsWith('=')) {
        newValue = currentValue + cellRef;
      } else {
        // Если нет =, добавляем = и ссылку
        newValue = '=' + cellRef;
      }
      
      setEditValue(newValue);
      setFormulaBarValue(newValue);
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
    
    // Если редактируем через строку формул и кликаем на ячейку, выходим из режима редактирования
    if (editingCell && editingFromFormulaBarRef.current) {
      // Сохраняем значение из строки формул
      const value = (formulaBarRef.current?.value || '').trim();
      if (value && value !== '=') {
        const { row: editRow, column: editColumn } = editingCell;
        if (value.startsWith('=')) {
          onCellChange(editRow, editColumn, '', value);
        } else {
          onCellChange(editRow, editColumn, value, '');
        }
      }
      setEditingCell(null);
      setEditValue('');
      editingSheetRef.current = null;
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
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
    const value = cell?.formula || cell?.value || '';
    editingFromFormulaBarRef.current = false;
    setIsEditingFromFormulaBar(false);
    setEditingCell({ row, column });
    // Сохраняем лист, на котором началось редактирование
    editingSheetRef.current = currentSheet;
    // Показываем формулу, если она есть, иначе значение
    setEditValue(value);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setEditValue(value);
  };

  const handleFormulaBarChange = (e) => {
    const value = e.target.value;
    // При изменении строки формул всегда обновляем editValue
    // и переводим ячейку в режим редактирования, если еще не в нем
    editingFromFormulaBarRef.current = true;
    setIsEditingFromFormulaBar(true);
    setIsEditingFromFormulaBar(true);
    if (!editingCell && selectedCell) {
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
    }
    setEditValue(value);
    setFormulaBarValue(value);
    // Синхронизируем с input в ячейке
    if (inputRef.current && editingCell) {
      inputRef.current.value = value;
    }
  };

  const handleFormulaBarFocus = (e) => {
    // Предотвращаем всплытие события
    e.stopPropagation();
    
    // При фокусе на строке формул переходим в режим редактирования выбранной ячейки
    editingFromFormulaBarRef.current = true;
    
    if (!editingCell && selectedCell) {
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const value = cell?.formula || cell?.value || '';
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
      setEditValue(value);
      setFormulaBarValue(value);
      
      // Устанавливаем фокус после обновления состояния
      setTimeout(() => {
        if (formulaBarRef.current) {
          formulaBarRef.current.focus();
          const length = formulaBarRef.current.value.length;
          formulaBarRef.current.setSelectionRange(length, length);
        }
      }, 0);
    } else if (editingCell) {
      // Если уже редактируем, синхронизируем значение
      setFormulaBarValue(editValue);
      // Убеждаемся, что фокус остается на строке формул
      setTimeout(() => {
        if (formulaBarRef.current && document.activeElement !== formulaBarRef.current) {
          formulaBarRef.current.focus();
        }
      }, 0);
    }
  };

  const handleFormulaBarBlur = (event) => {
    const e = event || {};
    // Очищаем предыдущий timeout, если он есть
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    
    // Если кликнули на ячейку, не выходим из режима редактирования
    if (isClickingCell.current) {
      return;
    }
    
    // Если кликнули на строку формул, полностью игнорируем blur
    if (isClickingFormulaBarRef.current) {
      // Восстанавливаем фокус немедленно
      setTimeout(() => {
        if (formulaBarRef.current && document.activeElement !== formulaBarRef.current) {
          formulaBarRef.current.focus();
        }
      }, 0);
      return;
    }
    
    // Если фокус перешел на другой элемент внутри строки формул, не выходим из режима редактирования
    const relatedTarget = e.relatedTarget;
    if (relatedTarget?.closest?.('.formula-bar')) {
      return;
    }
    
    // Если фокус потерян из-за клика на саму строку формул, не выходим
    const target = e.target || formulaBarRef.current;
    if (relatedTarget === formulaBarRef.current || 
        (relatedTarget && relatedTarget === target)) {
      return;
    }
    
    // Откладываем blur, чтобы дать время для обработки кликов
    blurTimeoutRef.current = setTimeout(() => {
      // Проверяем, что фокус действительно потерян и не был восстановлен
      if (document.activeElement !== formulaBarRef.current && !isClickingFormulaBarRef.current) {
        editingFromFormulaBarRef.current = false;
        setIsEditingFromFormulaBar(false);
        
        // Сохраняем значение из строки формул
        if (editingCell) {
          const { row, column } = editingCell;
          const value = (formulaBarRef.current?.value || '').trim();
          
          // Не сохраняем пустую или неполную формулу
          if (value && value !== '=') {
            if (value.startsWith('=')) {
              onCellChange(row, column, '', value);
            } else {
              onCellChange(row, column, value, '');
            }
          }
          
          setEditingCell(null);
          setEditValue('');
          editingSheetRef.current = null;
        }
      }
    }, 200);
  };

  const handleFormulaBarKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFormulaBarBlur();
      setIsEditingFromFormulaBar(false);
      if (selectedCell.row < ROWS) {
        setSelectedCell({ row: selectedCell.row + 1, column: selectedCell.column });
      }
      // Фокусируемся обратно на таблицу
      if (gridRef.current) {
        gridRef.current.focus();
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      editingSheetRef.current = null;
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
      // Фокусируемся обратно на таблицу
      if (gridRef.current) {
        gridRef.current.focus();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleFormulaBarBlur();
      setIsEditingFromFormulaBar(false);
      if (selectedCell.column < COLS) {
        setSelectedCell({ row: selectedCell.row, column: selectedCell.column + 1 });
      }
      // Фокусируемся обратно на таблицу
      if (gridRef.current) {
        gridRef.current.focus();
      }
    }
  };

  const handleInputBlur = (e) => {
    // Если кликнули на ячейку, не выходим из режима редактирования
    if (isClickingCell.current) {
      return;
    }
    
    // Если фокус потерян из-за переключения листа, не сохраняем
    // (состояние редактирования должно сохраниться)
    if (editingCell && e && e.relatedTarget) {
      // Проверяем, не произошел ли blur из-за переключения листа
      const relatedTarget = e.relatedTarget;
      if (relatedTarget.closest && relatedTarget.closest('.sheet-tabs')) {
        // Если клик был на вкладке листа, не выходим из режима редактирования
        setTimeout(() => {
          if (inputRef.current && editingCell) {
            inputRef.current.focus();
          }
        }, 100);
        return;
      }
    }
    
    if (editingCell) {
      const { row, column } = editingCell;
      const value = editValue.trim();
      
      // Не сохраняем пустую или неполную формулу (которая начинается с = но не завершена)
      if (value && value !== '=') {
        if (value.startsWith('=')) {
          onCellChange(row, column, '', value);
        } else {
          onCellChange(row, column, value, '');
        }
      }
      
      setEditingCell(null);
      setEditValue('');
      editingSheetRef.current = null;
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
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
    // Не обрабатываем события, если фокус в строке формул
    if (formulaBarRef.current && document.activeElement === formulaBarRef.current) {
      return;
    }
    
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
            // Очищаем значение и формулу, но сохраняем стили
            onCellChange(row, col, '', '', null);
          }
        }
      } else if (selectedCell) {
        // Очищаем одну ячейку
        // Очищаем значение и формулу, но сохраняем стили
        onCellChange(selectedCell.row, selectedCell.column, '', '', null);
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
      e.preventDefault();
      const key = getCellKey(selectedCell.row, selectedCell.column);
      const cell = cells[key];
      const value = cell?.formula || cell?.value || '';
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
      setEditValue(value);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // При вводе символа переходим в режим редактирования
      e.preventDefault();
      editingFromFormulaBarRef.current = false;
      setIsEditingFromFormulaBar(false);
      setEditingCell({ row: selectedCell.row, column: selectedCell.column });
      editingSheetRef.current = currentSheet;
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
      
      {/* Строка формул */}
      <div className="formula-bar">
        <div className="formula-bar-label">
          {selectedCell ? getCellReference(selectedCell.row, selectedCell.column) : ''}
        </div>
        <div className="formula-bar-separator"></div>
        <input
          ref={formulaBarRef}
          type="text"
          className="formula-bar-input"
          placeholder="Введите формулу или значение"
          value={editingCell ? (isEditingFromFormulaBar ? formulaBarValue : editValue) : (() => {
            if (!selectedCell) return '';
            const key = getCellKey(selectedCell.row, selectedCell.column);
            const cell = cells[key];
            return cell?.formula || cell?.value || '';
          })()}
          onChange={handleFormulaBarChange}
          onFocus={handleFormulaBarFocus}
          onBlur={handleFormulaBarBlur}
          onKeyDown={handleFormulaBarKeyDown}
          onMouseDown={(e) => {
            e.stopPropagation();
            // Отмечаем, что кликнули на строку формул
            isClickingFormulaBarRef.current = true;
            // Предотвращаем blur
            e.preventDefault();
            // Устанавливаем фокус сразу при mousedown
            if (formulaBarRef.current) {
              formulaBarRef.current.focus();
            }
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            // Убеждаемся, что фокус остается после mouseup
            if (formulaBarRef.current) {
              formulaBarRef.current.focus();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Убеждаемся, что при клике фокус устанавливается
            if (formulaBarRef.current) {
              formulaBarRef.current.focus();
            }
            // Сбрасываем флаг после задержки, чтобы blur не сработал
            setTimeout(() => {
              isClickingFormulaBarRef.current = false;
            }, 300);
          }}
        />
      </div>
      
      <div
        className="grid-container"
        ref={gridRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        onClick={(e) => {
          // Не обрабатываем клики на строке формул
          if (e.target.closest && e.target.closest('.formula-bar')) {
            return;
          }
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
                const showCellInput = isEditing && !isEditingFromFormulaBar;
                const displayValue = getCellDisplay(row, column);
                const editingDisplayValue = isEditingFromFormulaBar ? formulaBarValue : editValue;

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
                      showCellInput ? (
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
                        <span className="cell-content">{editingDisplayValue}</span>
                      )
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

