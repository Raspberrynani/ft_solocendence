from django.urls import path
from .views import get_entries, end_game

urlpatterns = [
    path('entries/', get_entries, name='entries'),
    path('end_game/', end_game, name='end_game'),
]
