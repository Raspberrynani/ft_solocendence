"""
Update your backend/api/views.py file with these changes
"""

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Player

@require_http_methods(["GET"])
def get_entries(request):
    """
    Get all player entries sorted by wins
    """
    players = Player.objects.all().order_by('-wins')
    data = [{"name": p.name, "wins": p.wins} for p in players]
    return JsonResponse({"entries": data})

@csrf_exempt
@require_http_methods(["POST"])
def end_game(request):
    """
    Record a win for a player
    """
    try:
        data = json.loads(request.body)
        nickname = data.get("nickname")
        token = data.get("token")
        score = data.get("score")
        
        # Validate that a token is provided and score is a number.
        if not token or not isinstance(score, (int, float)):
            return JsonResponse({"error": "Invalid token or score"}, status=400)
        
        player, created = Player.objects.get_or_create(name=nickname)
        # (In production, validate the token against one generated at game start)
        player.wins += 1
        player.save()
        
        return JsonResponse({"message": "Win recorded"}, status=200)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)