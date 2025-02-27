from django.urls import path
from .views import get_entries, end_game, get_player_stats, get_csrf_token, delete_player_data

urlpatterns = [
    path('entries/', get_entries, name='entries'),
    path('end_game/', end_game, name='end_game'),
    path('player/<str:player_name>/', get_player_stats, name='player_stats'),
    path('csrf/', get_csrf_token, name='csrf'),
    path('delete_player/', delete_player_data, name='delete_player'),
]