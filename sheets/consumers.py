import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Spreadsheet, Cell, Sheet


class SpreadsheetConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.spreadsheet_id = self.scope['url_route']['kwargs']['spreadsheet_id']
        self.room_group_name = f'spreadsheet_{self.spreadsheet_id}'
        
        # Получаем пользователя из токена или сессии
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        if 'token=' in query_string:
            token = query_string.split('token=')[1].split('&')[0]
        
        if token:
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                access_token = AccessToken(token)
                user_id = access_token['user_id']
                self.user = await self.get_user(user_id)
            except:
                self.user = AnonymousUser()
        else:
            self.user = self.scope.get('user', AnonymousUser())

        # Проверяем доступ к таблице
        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        # Проверяем, существует ли таблица и есть ли доступ
        has_access = await self.check_access()
        if not has_access:
            await self.close()
            return

        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Отправляем информацию о новом пользователе
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_id': self.user.id,
                'username': self.user.username,
            }
        )

    async def disconnect(self, close_code):
        # Покидаем группу
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Отправляем информацию об уходе пользователя
        if not isinstance(self.user, AnonymousUser):
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left',
                    'user_id': self.user.id,
                    'username': self.user.username,
                }
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'cell_update':
            # Обрабатываем обновление ячейки
            await self.handle_cell_update(data)
        elif message_type == 'cursor_move':
            # Обрабатываем перемещение курсора
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'cursor_update',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'row': data.get('row'),
                    'column': data.get('column'),
                }
            )

    async def handle_cell_update(self, data):
        """Обрабатывает обновление ячейки и рассылает другим пользователям"""
        sheet_id = data.get('sheet_id')
        row = data.get('row')
        column = data.get('column')
        value = data.get('value', '')
        formula = data.get('formula', '')
        style = data.get('style', {})

        # Сохраняем изменения в БД
        await self.save_cell_update(sheet_id, row, column, value, formula, style)

        # Рассылаем обновление всем пользователям в группе
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'cell_updated',
                'user_id': self.user.id,
                'username': self.user.username,
                'sheet_id': sheet_id,
                'row': row,
                'column': column,
                'value': value,
                'formula': formula,
                'style': style,
            }
        )

    @database_sync_to_async
    def get_user(self, user_id):
        """Получает пользователя по ID"""
        from django.contrib.auth.models import User
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()

    @database_sync_to_async
    def check_access(self):
        """Проверяет доступ пользователя к таблице"""
        try:
            spreadsheet = Spreadsheet.objects.get(id=self.spreadsheet_id)
            return spreadsheet.can_edit(self.user)
        except Spreadsheet.DoesNotExist:
            return False

    @database_sync_to_async
    def save_cell_update(self, sheet_id, row, column, value, formula, style):
        """Сохраняет обновление ячейки в БД"""
        try:
            sheet = Sheet.objects.get(id=sheet_id)
            cell, created = Cell.objects.get_or_create(
                sheet=sheet,
                row=row,
                column=column,
                defaults={'value': '', 'formula': '', 'style': {}}
            )
            
            if formula:
                cell.formula = formula
                cell.value = ''  # Значение будет вычислено формулой
            else:
                cell.value = value
                cell.formula = ''
            
            if style:
                cell.style = style
            
            cell.save()
            
            # Если есть формула, вычисляем значение
            if cell.formula:
                from .formula_engine import FormulaEngine
                engine = FormulaEngine(sheet)
                try:
                    cell.value = engine.evaluate(cell.formula)
                    cell.save()
                except Exception as e:
                    cell.value = f'#ОШИБКА: {str(e)}'
                    cell.save()
            
            return cell
        except Exception as e:
            print(f"Error saving cell update: {e}")
            return None

    # Обработчики сообщений для группы

    async def cell_updated(self, event):
        """Отправляет обновление ячейки клиенту"""
        # Не отправляем обновление тому, кто его сделал
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'cell_update',
                'sheet_id': event['sheet_id'],
                'row': event['row'],
                'column': event['column'],
                'value': event['value'],
                'formula': event['formula'],
                'style': event['style'],
            }))

    async def user_joined(self, event):
        """Отправляет информацию о присоединении пользователя"""
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'user_id': event['user_id'],
                'username': event['username'],
            }))

    async def user_left(self, event):
        """Отправляет информацию об уходе пользователя"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def cursor_update(self, event):
        """Отправляет обновление курсора другого пользователя"""
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'cursor_update',
                'user_id': event['user_id'],
                'username': event['username'],
                'row': event['row'],
                'column': event['column'],
            }))

