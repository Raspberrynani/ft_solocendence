from django.shortcuts import render

# backend/api/views.py
from django.http import JsonResponse

def test_view(request):
    return JsonResponse({"message": "Hello from Django API"})
