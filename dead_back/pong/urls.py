from django.urls import path
from .views import end_game

urlpatterns = [
    path('end_game/', end_game, name="end_game"),
]
