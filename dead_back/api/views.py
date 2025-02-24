from django.shortcuts import render

# backend/api/views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import TestEntry

def test_view(request):
    return JsonResponse({"message": "Hello from Django API"})


# Fetch leaderboard (sorted by most recent players)
def get_entries(request):
    entries = list(TestEntry.objects.order_by("-created_at").values()[:10])  # Get last 10 players
    return JsonResponse({"entries": entries})

# Add a nickname entry
@csrf_exempt
def add_entry(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            new_entry = TestEntry.objects.create(name=data["name"])
            return JsonResponse({"message": "Entry added", "id": new_entry.id}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"error": "Invalid request"}, status=400)