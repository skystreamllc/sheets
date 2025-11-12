from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class Spreadsheet(models.Model):
    """Модель таблицы (документа)"""
    name = models.CharField(max_length=255, default='Новая таблица')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_spreadsheets', null=True, blank=True)
    shared_with = models.ManyToManyField(User, related_name='shared_spreadsheets', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name
    
    def can_edit(self, user):
        """Проверяет, может ли пользователь редактировать таблицу"""
        if not user or not user.is_authenticated:
            return False
        # Если нет владельца, разрешаем доступ всем авторизованным пользователям (для обратной совместимости)
        if self.owner is None:
            return True
        return self.owner == user or user in self.shared_with.all()


class Sheet(models.Model):
    """Модель листа в таблице"""
    spreadsheet = models.ForeignKey(Spreadsheet, on_delete=models.CASCADE, related_name='sheets')
    name = models.CharField(max_length=255, default='Лист1')
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = ['spreadsheet', 'name']

    def __str__(self):
        return f"{self.spreadsheet.name} - {self.name}"


class Cell(models.Model):
    """Модель ячейки"""
    sheet = models.ForeignKey(Sheet, on_delete=models.CASCADE, related_name='cells')
    row = models.IntegerField()
    column = models.IntegerField()
    value = models.TextField(blank=True, default='')
    formula = models.TextField(blank=True, default='')
    style = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['sheet', 'row', 'column']
        indexes = [
            models.Index(fields=['sheet', 'row', 'column']),
        ]

    def __str__(self):
        return f"{self.sheet.name}[{self.row},{self.column}]"

