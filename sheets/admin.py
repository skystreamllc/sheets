from django.contrib import admin
from .models import Spreadsheet, Sheet, Cell


@admin.register(Spreadsheet)
class SpreadsheetAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'updated_at']


@admin.register(Sheet)
class SheetAdmin(admin.ModelAdmin):
    list_display = ['name', 'spreadsheet', 'order']


@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    list_display = ['sheet', 'row', 'column', 'value', 'formula']
    list_filter = ['sheet']

