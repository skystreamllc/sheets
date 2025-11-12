import re
from .models import Cell


def find_dependent_cells(sheet, row, column):
    """
    Находит все ячейки с формулами, которые ссылаются на указанную ячейку.
    Возвращает список ячеек, которые нужно пересчитать.
    """
    # Получаем ссылку на ячейку (например, A1, B2)
    cell_ref = _get_cell_reference(row, column)
    
    # Находим все ячейки с формулами на этом листе
    cells_with_formulas = Cell.objects.filter(
        sheet=sheet,
        formula__isnull=False
    ).exclude(formula='')
    
    dependent_cells = []
    
    for cell in cells_with_formulas:
        if _cell_depends_on(cell.formula, cell_ref, row, column):
            dependent_cells.append(cell)
    
    return dependent_cells


def _get_cell_reference(row, column):
    """Преобразует координаты в ссылку на ячейку (A1, B2, etc.)"""
    col_str = ''
    col = column
    while col > 0:
        col -= 1
        col_str = chr(65 + (col % 26)) + col_str
        col = col // 26
    return f"{col_str}{row}"


def _cell_depends_on(formula, cell_ref, target_row, target_column):
    """
    Проверяет, зависит ли формула от указанной ячейки.
    Учитывает прямые ссылки (A1) и ссылки в диапазонах (A1:A5).
    """
    if not formula or not formula.startswith('='):
        return False
    
    formula = formula[1:].strip().upper()
    cell_ref_upper = cell_ref.upper()
    
    # Проверяем прямые ссылки на ячейку
    # Паттерн для ссылок на ячейки: A1, B2, AA123, etc.
    pattern = r'[A-Z]+[0-9]+'
    matches = re.findall(pattern, formula, re.IGNORECASE)
    
    for match in matches:
        if match.upper() == cell_ref_upper:
            return True
    
    # Проверяем ссылки в диапазонах (A1:A5)
    range_pattern = r'([A-Z]+[0-9]+):([A-Z]+[0-9]+)'
    range_matches = re.findall(range_pattern, formula, re.IGNORECASE)
    
    for start_ref, end_ref in range_matches:
        start_row, start_col = _parse_cell_ref(start_ref)
        end_row, end_col = _parse_cell_ref(end_ref)
        
        # Проверяем, попадает ли целевая ячейка в диапазон
        if (start_row <= target_row <= end_row and 
            start_col <= target_column <= end_col):
            return True
    
    return False


def _parse_cell_ref(ref):
    """Парсит ссылку на ячейку (A1) в координаты (row, column)"""
    ref = ref.upper()
    match = re.match(r'([A-Z]+)([0-9]+)', ref)
    if not match:
        return None, None
    
    col_str = match.group(1)
    row = int(match.group(2))
    
    # Преобразование колонки (A=1, B=2, ..., Z=26, AA=27, etc.)
    column = 0
    for char in col_str:
        column = column * 26 + (ord(char) - ord('A') + 1)
    
    return row, column

