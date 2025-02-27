from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.middleware.csrf import get_token
from .models import Player
import json
import hashlib
import time


@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Endpoint to get a CSRF token with proper headers.
    Ensures the CSRF cookie is set.
    """
    token = get_token(request)
    response = JsonResponse({'csrfToken': token})
    # Make sure we're sending the CSRF token with proper headers
    response['X-CSRFToken'] = token
    return response

@csrf_protect
@require_http_methods(["GET"])
def get_player_stats(request, player_name):
    """
    Get detailed statistics for a specific player
    """
    try:
        player = Player.objects.get(name=player_name)
        
        return JsonResponse({
            "name": player.name,
            "wins": player.wins,
            "games_played": player.games_played,
            "win_ratio": round(player.win_ratio, 2),
            "rank": player.rank_class
        })
    except Player.DoesNotExist:
        return JsonResponse({"error": "Player not found"}, status=404)

@csrf_protect
@require_http_methods(["GET"])
def get_entries(request):
    """
    Get all player entries sorted by wins
    """
    players = Player.objects.all().order_by('-wins')
    data = [
        {
            "name": p.name, 
            "wins": p.wins, 
            "games_played": p.games_played,
            "win_ratio": round(p.wins / p.games_played * 100, 2) if p.games_played > 0 else 0,
            "rank": "gold" if p.games_played > 5 and p.wins / p.games_played >= 0.7 else 
                    "silver" if p.games_played > 5 and p.wins / p.games_played >= 0.5 else 
                    "bronze"
        } for p in players
    ]
    return JsonResponse({"entries": data})


@csrf_protect
@require_http_methods(["POST"])
def end_game(request):
    """
    Record a game for a player
    """
    try:
        data = json.loads(request.body)
        nickname = data.get("nickname")
        token = data.get("token")
        score = data.get("score")
        total_rounds = data.get("totalRounds", 3)  # Default to 3 if not specified
        
        # Validate that a token is provided and score is a number.
        if not token or not isinstance(score, (int, float)):
            return JsonResponse({"error": "Invalid token or score"}, status=400)
        
        # Determine if the player won based on reaching target rounds
        is_winner = score >= total_rounds
        
        # Get or create player, tracking total games and wins
        player, created = Player.objects.get_or_create(name=nickname)
        
        # Increment games played
        player.games_played += 1
        
        # Increment wins if player won
        if is_winner:
            player.wins += 1
        
        player.save()
        
        return JsonResponse({
            "message": "Game recorded", 
            "winner": is_winner,
            "total_games": player.games_played,
            "total_wins": player.wins
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
    
# Add these imports to api/views.py

def generate_verification_hash(nickname):
    """
    Generate a verification hash based on nickname and current hour
    This ensures the hash changes every hour for security
    """
    # Get current hour as timestamp (changes every hour)
    current_hour = int(time.time()) // 3600
    
    # Create verification string with nickname and hour
    verification_string = f"{nickname}-{current_hour}-pong-gdpr"
    
    # Generate hash
    hash_object = hashlib.sha256(verification_string.encode())
    return hash_object.hexdigest()[:12]  # First 12 chars for simplicity

@csrf_protect
@require_http_methods(["POST"])
def delete_player_data(request):
    """
    Delete a player's data after verification
    """
    try:
        data = json.loads(request.body)
        nickname = data.get("nickname")
        verification_code = data.get("verification_code")
        
        # Verify the nickname exists
        try:
            player = Player.objects.get(name=nickname)
        except Player.DoesNotExist:
            # We return success even if player doesn't exist for security
            return JsonResponse({"success": True, "message": "If this player exists, their data has been deleted."})
        
        # Generate the expected verification hash
        expected_hash = generate_verification_hash(nickname)
        
        # Check if verification matches
        if verification_code != expected_hash:
            return JsonResponse({"success": False, "message": "Verification failed."}, status=400)
        
        # Delete player data
        player.delete()
        
        return JsonResponse({
            "success": True,
            "message": "Player data has been permanently deleted."
        })
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON."}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=500)