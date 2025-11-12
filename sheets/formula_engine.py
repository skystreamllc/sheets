import re
from .models import Cell, Sheet


class FormulaEngine:
    """Движок для вычисления формул"""
    
    def __init__(self, sheet):
        self.sheet = sheet
        self.spreadsheet = sheet.spreadsheet
        self.cache = {}
    
    def get_cell_value(self, row, column, sheet=None):
        """Получить значение ячейки по координатам
        
        Args:
            row: номер строки
            column: номер колонки
            sheet: лист, из которого получать значение (по умолчанию self.sheet)
        """
        target_sheet = sheet or self.sheet
        cache_key = f"{target_sheet.id}_{row}_{column}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            cell = Cell.objects.get(sheet=target_sheet, row=row, column=column)
            value = cell.value
            
            # Если ячейка содержит формулу, возвращаем вычисленное значение
            if cell.formula and value:
                # Пытаемся преобразовать вычисленное значение в число
                try:
                    if not value.startswith('#ОШИБКА'):
                        return float(value)
                except (ValueError, AttributeError):
                    pass
            
            # Пытаемся преобразовать в число
            try:
                if value and not value.startswith('=') and not value.startswith('#ОШИБКА'):
                    return float(value)
            except (ValueError, AttributeError):
                pass
            
            return value or ''
        except Cell.DoesNotExist:
            return ''
    
    def get_sheet_by_name(self, sheet_name):
        """Получить лист по имени в рамках текущей таблицы"""
        try:
            return Sheet.objects.get(spreadsheet=self.spreadsheet, name=sheet_name)
        except Sheet.DoesNotExist:
            return None
    
    def evaluate(self, formula):
        """Вычислить формулу"""
        if not formula or not formula.startswith('='):
            return formula
        
        formula = formula[1:].strip()  # Убираем '='
        
        # Обработка функций с диапазонами (SUM(A1:A5), etc.)
        formula = self._process_ranges(formula)
        
        # Обработка ссылок на ячейки (A1, B2, etc.)
        formula = self._replace_cell_references(formula)
        
        # Обработка процентов (20% -> 0.2, 100 * 20% -> 100 * 0.2)
        formula = self._process_percentages(formula)
        
        # Базовые математические операции
        try:
            # Безопасное вычисление
            result = eval(formula, {"__builtins__": {}}, {
                'SUM': self._sum,
                'AVERAGE': self._average,
                'MAX': self._max,
                'MIN': self._min,
                'COUNT': self._count,
            })
            # Форматируем результат: убираем лишние нули после запятой для целых чисел
            if isinstance(result, float) and result.is_integer():
                return str(int(result))
            return str(result) if result is not None else ''
        except ZeroDivisionError:
            raise Exception("Деление на ноль")
        except SyntaxError as e:
            raise Exception(f"Синтаксическая ошибка в формуле: {str(e)}")
        except Exception as e:
            error_msg = str(e)
            # Упрощаем сообщения об ошибках
            if "invalid syntax" in error_msg.lower():
                raise Exception("Неверный синтаксис формулы")
            raise Exception(f"Ошибка вычисления: {error_msg}")
    
    def _process_ranges(self, formula):
        """Обрабатывает диапазоны ячеек (A1:A5) в функциях, включая ссылки на другие листы (Sheet1!A1:A5)"""
        def get_range_values(start_ref, end_ref, sheet=None):
            """Получить значения из диапазона"""
            start_row, start_col = self._parse_cell_ref(start_ref)
            end_row, end_col = self._parse_cell_ref(end_ref)
            
            values = []
            for row in range(start_row, end_row + 1):
                for col in range(start_col, end_col + 1):
                    value = self.get_cell_value(row, col, sheet=sheet)
                    try:
                        values.append(float(value))
                    except (ValueError, TypeError):
                        if value:
                            values.append(value)
            return values
        
        def parse_range(range_str):
            """Парсит диапазон вида SheetName!A1:A5 или A1:A5"""
            # Проверяем, есть ли ссылка на лист (поддерживаем кириллицу в именах листов)
            sheet_match = re.match(r'([А-Яа-яA-Za-z0-9_]+)!([A-Z]+[0-9]+):([A-Z]+[0-9]+)', range_str, re.IGNORECASE)
            if sheet_match:
                sheet_name = sheet_match.group(1).strip()
                start_ref = sheet_match.group(2)
                end_ref = sheet_match.group(3)
                sheet = self.get_sheet_by_name(sheet_name)
                if not sheet:
                    raise ValueError(f"Лист '{sheet_name}' не найден")
                return start_ref, end_ref, sheet
            else:
                # Обычный диапазон без ссылки на лист
                range_match = re.match(r'([A-Z]+[0-9]+):([A-Z]+[0-9]+)', range_str, re.IGNORECASE)
                if range_match:
                    return range_match.group(1), range_match.group(2), None
                return None, None, None
        
        def replace_function(match):
            func_str = match.group(0)
            # Извлекаем имя функции
            func_match = re.match(r'([A-Z]+)\((.+)\)', func_str, re.IGNORECASE)
            if not func_match:
                return func_str
            
            func_name = func_match.group(1).upper()
            args_str = func_match.group(2)
            
            # Разбиваем аргументы по запятым, учитывая вложенные скобки
            args = []
            current_arg = ''
            paren_depth = 0
            
            for char in args_str:
                if char == '(':
                    paren_depth += 1
                    current_arg += char
                elif char == ')':
                    paren_depth -= 1
                    current_arg += char
                elif char == ',' and paren_depth == 0:
                    args.append(current_arg.strip())
                    current_arg = ''
                else:
                    current_arg += char
            
            if current_arg:
                args.append(current_arg.strip())
            
            # Обрабатываем каждый аргумент
            all_values = []
            for arg in args:
                arg = arg.strip()
                # Проверяем, является ли аргумент диапазоном
                if ':' in arg and re.search(r'[A-Z]+[0-9]+:[A-Z]+[0-9]+', arg, re.IGNORECASE):
                    start_ref, end_ref, sheet = parse_range(arg)
                    if start_ref and end_ref:
                        range_values = get_range_values(start_ref, end_ref, sheet=sheet)
                        all_values.extend(range_values)
                else:
                    # Это не диапазон, будет обработан позже в _replace_cell_references
                    # Пока просто пропускаем
                    pass
            
            # Вызываем соответствующую функцию
            if func_name == 'SUM':
                return str(self._sum(*all_values))
            elif func_name == 'AVERAGE':
                return str(self._average(*all_values))
            elif func_name == 'MAX':
                return str(self._max(*all_values))
            elif func_name == 'MIN':
                return str(self._min(*all_values))
            elif func_name == 'COUNT':
                return str(self._count(*all_values))
            
            return func_str
        
        # Паттерн для функций: SUM(...), AVERAGE(...), etc.
        # Обрабатываем функции, которые могут содержать диапазоны
        pattern = r'(SUM|AVERAGE|MAX|MIN|COUNT)\([^)]+\)'
        return re.sub(pattern, replace_function, formula, flags=re.IGNORECASE)
    
    def _replace_cell_references(self, formula):
        """Заменяет ссылки на ячейки (A1, B2, Sheet1!A1) на их значения"""
        def replace_ref(match):
            ref_with_sheet = match.group(0)
            
            # Проверяем, есть ли ссылка на лист (SheetName!A1)
            sheet_match = re.match(r'([^!]+)!([A-Z]+[0-9]+)', ref_with_sheet, re.IGNORECASE)
            if sheet_match:
                sheet_name = sheet_match.group(1).strip()
                cell_ref = sheet_match.group(2)
                sheet = self.get_sheet_by_name(sheet_name)
                if not sheet:
                    raise ValueError(f"Лист '{sheet_name}' не найден")
            else:
                cell_ref = ref_with_sheet
                sheet = None
            
            row, column = self._parse_cell_ref(cell_ref)
            target_sheet = sheet or self.sheet
            
            try:
                cell = Cell.objects.get(sheet=target_sheet, row=row, column=column)
                # Если ячейка содержит ошибку, выбрасываем исключение
                if cell.value and cell.value.startswith('#ОШИБКА'):
                    raise ValueError(f"Ячейка {ref_with_sheet} содержит ошибку")
            except Cell.DoesNotExist:
                pass
            
            value = self.get_cell_value(row, column, sheet=target_sheet)
            
            # Если значение пустое, возвращаем 0
            if not value or value == '':
                return '0'
            
            # Если значение содержит ошибку, выбрасываем исключение
            if isinstance(value, str) and value.startswith('#ОШИБКА'):
                raise ValueError(f"Ячейка {ref_with_sheet} содержит ошибку")
            
            # Пытаемся преобразовать в число
            try:
                # Если это уже число (float), возвращаем строковое представление
                if isinstance(value, (int, float)):
                    return str(value)
                # Пытаемся преобразовать строку в число
                return str(float(value))
            except (ValueError, TypeError):
                # Если не число, возвращаем 0 для математических операций
                return '0'
        
        # Паттерн для ссылок на ячейки:
        # 1. Ссылки на другие листы: SheetName!A1, Sheet1!B2, Лист2!A1, etc.
        # 2. Обычные ссылки: A1, AA123, etc.
        # Исключаем ссылки внутри функций с диапазонами (уже обработанных)
        # Сначала обрабатываем ссылки с листами, потом обычные
        # Паттерн для ссылок с листами: имя листа (может содержать кириллицу, латиницу, цифры, подчеркивания)![A-Z]+[0-9]+
        # Имя листа может содержать буквы (включая кириллицу), цифры, подчеркивания, но не пробелы и операторы
        pattern_with_sheet = r'([А-Яа-яA-Za-z0-9_]+)![A-Z]+[0-9]+(?![0-9:])'
        formula = re.sub(pattern_with_sheet, replace_ref, formula, flags=re.IGNORECASE)
        
        # Паттерн для обычных ссылок на ячейки (A1, AA123, etc.)
        # Исключаем ссылки внутри функций с диапазонами
        pattern = r'(?<!:)(?<!!)[A-Z]+[0-9]+(?![0-9:])'
        formula = re.sub(pattern, replace_ref, formula, flags=re.IGNORECASE)
        
        return formula
    
    def _process_percentages(self, formula):
        """Обрабатывает проценты в формуле (20% -> 0.2, 100 * 20% -> 100 * 0.2)"""
        def replace_percent(match):
            """Заменяет число% на число/100"""
            number_str = match.group(1)
            try:
                number = float(number_str)
                return f"({number} / 100)"
            except ValueError:
                return match.group(0)  # Если не число, возвращаем как есть
        
        # Паттерн для процентов: число% (может быть с десятичной точкой, может быть отрицательным)
        # Примеры: 20%, 15.5%, -10%, 0.5%
        # Исключаем случаи, когда % уже обработан или является частью другого выражения
        pattern = r'([-+]?\d+\.?\d*)\s*%'
        return re.sub(pattern, replace_percent, formula)
    
    def _parse_cell_ref(self, ref):
        """Парсит ссылку на ячейку (A1) в координаты (row, column)"""
        ref = ref.upper()
        match = re.match(r'([A-Z]+)([0-9]+)', ref)
        if not match:
            raise ValueError(f"Неверная ссылка на ячейку: {ref}")
        
        col_str = match.group(1)
        row = int(match.group(2))
        
        # Преобразование колонки (A=1, B=2, ..., Z=26, AA=27, etc.)
        column = 0
        for char in col_str:
            column = column * 26 + (ord(char) - ord('A') + 1)
        
        return row, column
    
    def _sum(self, *args):
        """Функция SUM"""
        total = 0
        for arg in args:
            try:
                total += float(arg)
            except (ValueError, TypeError):
                pass
        return total
    
    def _average(self, *args):
        """Функция AVERAGE"""
        values = []
        for arg in args:
            try:
                values.append(float(arg))
            except (ValueError, TypeError):
                pass
        return sum(values) / len(values) if values else 0
    
    def _max(self, *args):
        """Функция MAX"""
        values = []
        for arg in args:
            try:
                values.append(float(arg))
            except (ValueError, TypeError):
                pass
        return max(values) if values else 0
    
    def _min(self, *args):
        """Функция MIN"""
        values = []
        for arg in args:
            try:
                values.append(float(arg))
            except (ValueError, TypeError):
                pass
        return min(values) if values else 0
    
    def _count(self, *args):
        """Функция COUNT"""
        count = 0
        for arg in args:
            try:
                float(arg)
                count += 1
            except (ValueError, TypeError):
                pass
        return count

