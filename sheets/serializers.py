from rest_framework import serializers
from .models import Spreadsheet, Sheet, Cell


class CellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cell
        fields = ['id', 'row', 'column', 'value', 'formula', 'style']


class SheetSerializer(serializers.ModelSerializer):
    cells = CellSerializer(many=True, read_only=True)

    class Meta:
        model = Sheet
        fields = ['id', 'name', 'order', 'cells']


class SpreadsheetSerializer(serializers.ModelSerializer):
    sheets = SheetSerializer(many=True, read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    shared_with_usernames = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = ['id', 'name', 'created_at', 'updated_at', 'sheets', 'owner', 'owner_username', 'shared_with_usernames']
    
    def get_shared_with_usernames(self, obj):
        return [user.username for user in obj.shared_with.all()]


class CellUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cell
        fields = ['value', 'formula', 'style']

