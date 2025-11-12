from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpreadsheetViewSet, SheetViewSet, CellViewSet
from .auth_views import register, login, current_user

router = DefaultRouter()
router.register(r'spreadsheets', SpreadsheetViewSet, basename='spreadsheet')
router.register(r'sheets', SheetViewSet, basename='sheet')
router.register(r'cells', CellViewSet, basename='cell')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', register, name='register'),
    path('auth/login/', login, name='login'),
    path('auth/me/', current_user, name='current_user'),
]

