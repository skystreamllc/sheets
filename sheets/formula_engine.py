import re
from .models import Cell


class FormulaEngine:
    """Движок для вычисления формул"""
    
    def __init__(self, sheet):
        self.sheet = sheet
        self.cache = {}
    
    def get_cell_value(self, row, column):
        """Получить значение ячейки по координатам"""
        cache_key = f"{row}_{column}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            cell = Cell.objects.get(sheet=self.sheet, row=row, column=column)
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
    
    def evaluate(self, formula):
        """Вычислить формулу"""
        if not formula or not formula.startswith('='):
            return formula
        
        formula = formula[1:].strip()  # Убираем '='
        
        # Обработка функций с диапазонами (SUM(A1:A5), etc.)
        formula = self._process_ranges(formula)
        
        # Обработка ссылок на ячейки (A1, B2, etc.)
        formula = self._replace_cell_references(formula)
        
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
        """Обрабатывает диапазоны ячеек (A1:A5) в функциях"""
        def get_range_values(start_ref, end_ref):
            """Получить значения из диапазона"""
            start_row, start_col = self._parse_cell_ref(start_ref)
            end_row, end_col = self._parse_cell_ref(end_ref)
            
            values = []
            for row in range(start_row, end_row + 1):
                for col in range(start_col, end_col + 1):
                    value = self.get_cell_value(row, col)
                    try:
                        values.append(float(value))
                    except (ValueError, TypeError):
                        if value:
                            values.append(value)
            return values
        
        def replace_range(match):
            range_str = match.group(0)
            # Извлекаем функцию и диапазон
            func_match = re.match(r'([A-Z]+)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)', range_str, re.IGNORECASE)
            if not func_match:
                return range_str
            
            func_name = func_match.group(1).upper()
            start_ref = func_match.group(2)
            end_ref = func_match.group(3)
            
            values = get_range_values(start_ref, end_ref)
            
            # Вызываем соответствующую функцию
            if func_name == 'SUM':
                return str(self._sum(*values))
            elif func_name == 'AVERAGE':
                return str(self._average(*values))
            elif func_name == 'MAX':
                return str(self._max(*values))
            elif func_name == 'MIN':
                return str(self._min(*values))
            elif func_name == 'COUNT':
                return str(self._count(*values))
            
            return range_str
        
        # Паттерн для функций с диапазонами: SUM(A1:A5), AVERAGE(B2:B10), etc.
        pattern = r'[A-Z]+\([A-Z]+[0-9]+:[A-Z]+[0-9]+\)'
        return re.sub(pattern, replace_range, formula, flags=re.IGNORECASE)
    
    def _replace_cell_references(self, formula):
        """Заменяет ссылки на ячейки (A1, B2) на их значения"""
        def replace_ref(match):
            ref = match.group(0)
            row, column = self._parse_cell_ref(ref)
            
            try:
                cell = Cell.objects.get(sheet=self.sheet, row=row, column=column)
                # Если ячейка содержит ошибку, выбрасываем исключение
                if cell.value and cell.value.startswith('#ОШИБКА'):
                    raise ValueError(f"Ячейка {ref} содержит ошибку")
            except Cell.DoesNotExist:
                pass
            
            value = self.get_cell_value(row, column)
            
            # Если значение пустое, возвращаем 0
            if not value or value == '':
                return '0'
            
            # Если значение содержит ошибку, выбрасываем исключение
            if isinstance(value, str) and value.startswith('#ОШИБКА'):
                raise ValueError(f"Ячейка {ref} содержит ошибку")
            
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
        
        # Паттерн для ссылок на ячейки (A1, AA123, etc.)
        # Исключаем ссылки внутри функций с диапазонами
        pattern = r'(?<!:)[A-Z]+[0-9]+(?![0-9:])'
        return re.sub(pattern, replace_ref, formula, flags=re.IGNORECASE)
    
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

