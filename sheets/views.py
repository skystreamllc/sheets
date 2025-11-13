from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models
from .models import Spreadsheet, Sheet, Cell
from .serializers import (
    SpreadsheetSerializer,
    SheetSerializer,
    CellSerializer,
    CellUpdateSerializer
)
from .formula_engine import FormulaEngine
from .cell_dependencies import find_dependent_cells


def _recalculate_dependent_cells(sheet, row, column):
    """
    Пересчитывает все ячейки с формулами, которые зависят от указанной ячейки.
    """
    dependent_cells = find_dependent_cells(sheet, row, column)
    
    if not dependent_cells:
        return
    
    engine = FormulaEngine(sheet)
    
    for cell in dependent_cells:
        try:
            cell.value = engine.evaluate(cell.formula)
            cell.save()
        except Exception as e:
            cell.value = f'#ОШИБКА: {str(e)}'
            cell.save()


class SpreadsheetViewSet(viewsets.ModelViewSet):
    queryset = Spreadsheet.objects.all()
    serializer_class = SpreadsheetSerializer
    pagination_class = None  # Отключаем пагинацию для списка таблиц
    
    def get_queryset(self):
        """Фильтруем таблицы по владельцу и общим"""
        user = self.request.user
        if user.is_authenticated:
            return Spreadsheet.objects.filter(
                models.Q(owner=user) | models.Q(shared_with=user)
            ).distinct()
        return Spreadsheet.objects.none()

    def create(self, request):
        """Создать новую таблицу"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        spreadsheet = serializer.save(owner=request.user if request.user.is_authenticated else None)
        
        # Создаем первый лист по умолчанию
        Sheet.objects.create(
            spreadsheet=spreadsheet,
            name='Лист1',
            order=0
        )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_sheet(self, request, pk=None):
        """Добавить новый лист в таблицу"""
        spreadsheet = self.get_object()
        sheet_name = request.data.get('name', f'Лист{spreadsheet.sheets.count() + 1}')
        
        sheet = Sheet.objects.create(
            spreadsheet=spreadsheet,
            name=sheet_name,
            order=spreadsheet.sheets.count()
        )
        
        serializer = SheetSerializer(sheet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        """Предоставить доступ к таблице другому пользователю"""
        spreadsheet = self.get_object()
        
        # Проверяем, что пользователь является владельцем
        if spreadsheet.owner != request.user:
            return Response(
                {'error': 'Только владелец может предоставлять доступ'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        username = request.data.get('username')
        if not username:
            return Response(
                {'error': 'Необходимо указать username'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth.models import User
            user = User.objects.get(username=username)
            if user == request.user:
                return Response(
                    {'error': 'Нельзя предоставить доступ самому себе'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            spreadsheet.shared_with.add(user)
            return Response({
                'message': f'Доступ предоставлен пользователю {username}',
                'username': username
            })
        except User.DoesNotExist:
            return Response(
                {'error': f'Пользователь {username} не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def unshare(self, request, pk=None):
        """Отозвать доступ к таблице"""
        spreadsheet = self.get_object()
        
        # Проверяем, что пользователь является владельцем
        if spreadsheet.owner != request.user:
            return Response(
                {'error': 'Только владелец может отзывать доступ'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        username = request.data.get('username')
        if not username:
            return Response(
                {'error': 'Необходимо указать username'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth.models import User
            user = User.objects.get(username=username)
            spreadsheet.shared_with.remove(user)
            return Response({
                'message': f'Доступ отозван у пользователя {username}',
                'username': username
            })
        except User.DoesNotExist:
            return Response(
                {'error': f'Пользователь {username} не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def shared_users(self, request, pk=None):
        """Получить список пользователей с доступом"""
        spreadsheet = self.get_object()
        shared_users = spreadsheet.shared_with.all()
        return Response({
            'users': [{'id': u.id, 'username': u.username} for u in shared_users]
        })


class SheetViewSet(viewsets.ModelViewSet):
    queryset = Sheet.objects.all()
    serializer_class = SheetSerializer
    pagination_class = None  # Отключаем пагинацию для списка листов

    def get_queryset(self):
        """Фильтрация по spreadsheet_id если указан"""
        queryset = Sheet.objects.all()
        spreadsheet_id = self.request.query_params.get('spreadsheet_id', None)
        if spreadsheet_id:
            queryset = queryset.filter(spreadsheet_id=spreadsheet_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        """Удаление листа с проверкой, что это не последний лист"""
        sheet = self.get_object()
        spreadsheet = sheet.spreadsheet
        
        # Проверяем, что это не последний лист
        if spreadsheet.sheets.count() <= 1:
            return Response(
                {'error': 'Нельзя удалить последний лист в таблице'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)


class CellViewSet(viewsets.ModelViewSet):
    queryset = Cell.objects.all()
    serializer_class = CellSerializer
    pagination_class = None  # Отключаем пагинацию для списка ячеек

    def get_queryset(self):
        """Фильтрация по sheet_id"""
        queryset = Cell.objects.all()
        sheet_id = self.request.query_params.get('sheet_id', None)
        if sheet_id:
            queryset = queryset.filter(sheet_id=sheet_id)
        return queryset

    def create(self, request):
        """Создать или обновить ячейку"""
        sheet_id = request.data.get('sheet_id')
        row = request.data.get('row')
        column = request.data.get('column')
        
        if not all([sheet_id, row is not None, column is not None]):
            return Response(
                {'error': 'sheet_id, row и column обязательны'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sheet = get_object_or_404(Sheet, id=sheet_id)
        
        # Получаем или создаем ячейку
        cell, created = Cell.objects.get_or_create(
            sheet=sheet,
            row=row,
            column=column,
            defaults={'value': '', 'formula': '', 'style': {}}
        )
        
        # Обновляем данные ячейки
        update_serializer = CellUpdateSerializer(cell, data=request.data, partial=True)
        update_serializer.is_valid(raise_exception=True)
        update_serializer.save()
        
        # Перезагружаем объект из БД
        cell.refresh_from_db()
        
        # Если есть формула, вычисляем значение
        if cell.formula:
            engine = FormulaEngine(sheet)
            try:
                cell.value = engine.evaluate(cell.formula)
                cell.save()
            except Exception as e:
                cell.value = f'#ОШИБКА: {str(e)}'
                cell.save()
        
        # Перезагружаем еще раз после вычисления
        cell.refresh_from_db()
        
        # Если ячейка была изменена (не формула, а значение), пересчитываем зависимые формулы
        # Проверяем, что это изменение значения, а не добавление/изменение формулы
        was_value_update = 'value' in request.data and not request.data.get('formula')
        if was_value_update or (not cell.formula and cell.value):
            _recalculate_dependent_cells(sheet, cell.row, cell.column)
        
        serializer = CellSerializer(cell)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def update(self, request, pk=None):
        """Обновить ячейку"""
        cell = self.get_object()
        update_serializer = CellUpdateSerializer(cell, data=request.data, partial=True)
        update_serializer.is_valid(raise_exception=True)
        update_serializer.save()
        
        # Перезагружаем объект из БД
        cell.refresh_from_db()
        
        # Если есть формула, вычисляем значение
        if cell.formula:
            engine = FormulaEngine(cell.sheet)
            try:
                cell.value = engine.evaluate(cell.formula)
                cell.save()
            except Exception as e:
                cell.value = f'#ОШИБКА: {str(e)}'
                cell.save()
        
        # Перезагружаем еще раз после вычисления
        cell.refresh_from_db()
        
        # Если ячейка была изменена (не формула, а значение), пересчитываем зависимые формулы
        # Проверяем, что это изменение значения, а не добавление/изменение формулы
        was_value_update = 'value' in request.data and not request.data.get('formula')
        if was_value_update or (not cell.formula and cell.value):
            _recalculate_dependent_cells(cell.sheet, cell.row, cell.column)
        
        serializer = CellSerializer(cell)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """Массовое обновление ячеек"""
        updates = request.data.get('updates', [])
        sheet_id = request.data.get('sheet_id')
        
        if not sheet_id:
            return Response(
                {'error': 'sheet_id обязателен'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sheet = get_object_or_404(Sheet, id=sheet_id)
        engine = FormulaEngine(sheet)
        results = []
        
        for update in updates:
            row = update.get('row')
            column = update.get('column')
            
            if row is None or column is None:
                continue
            
            cell, _ = Cell.objects.get_or_create(
                sheet=sheet,
                row=row,
                column=column,
                defaults={'value': '', 'formula': '', 'style': {}}
            )
            
            if 'value' in update:
                cell.value = update['value']
                cell.formula = ''
            if 'formula' in update:
                cell.formula = update['formula']
                try:
                    cell.value = engine.evaluate(cell.formula)
                except Exception as e:
                    cell.value = f'#ОШИБКА: {str(e)}'
            if 'style' in update:
                cell.style = update['style']
            
            cell.save()
            results.append(CellSerializer(cell).data)
            
            # Пересчитываем зависимые ячейки, если было изменение значения
            if 'value' in update and not update.get('formula'):
                _recalculate_dependent_cells(sheet, row, column)
        
        return Response(results, status=status.HTTP_200_OK)

