from django.urls import path
from .views import get_entries, end_game, get_player_stats, get_csrf_token, delete_player_data, check_player_exists

urlpatterns = [
    path('entries/', get_entries, name='entries'),
    path('end_game/', end_game, name='end_game'),
    path('player/<str:player_name>/', get_player_stats, name='player_stats'),
    path('csrf/', get_csrf_token, name='csrf'),
    path('check_player/', check_player_exists, name='check_player'),
    path('delete_player/', delete_player_data, name='delete_player'),
]