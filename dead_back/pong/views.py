import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Player

@csrf_exempt
def end_game(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            nickname = data.get("nickname")
            token = data.get("token")
            score = data.get("score")
            # Implement your token validation logic here.
            # For demo, we simply check that token exists and score is a number.
            if not token or not isinstance(score, (int, float)):
                return JsonResponse({"error": "Invalid token or score"}, status=400)
            player, created = Player.objects.get_or_create(name=nickname)
            # Here, you would also check that the token matches one issued during game start.
            # For now, we assume the token is valid.
            player.wins += 1
            player.save()
            return JsonResponse({"message": "Win recorded"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"error": "Invalid method"}, status=405)
