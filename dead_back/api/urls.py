# backend/api/urls.py
from django.urls import path
from .views import get_entries  # Ensure this view exists in api/views.py

urlpatterns = [
    path('entries/', get_entries, name='entries'),
    path('api/', include('pong.urls')),
]

