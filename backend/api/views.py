from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.middleware.csrf import get_token
from .models import Player
import json
import hashlib
import time
import re
import logging

# Configure logging
logger = logging.getLogger(__name__)

@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Endpoint to get a CSRF token with proper headers.
    Ensures the CSRF cookie is set.
    """
    token = get_token(request)
    response = JsonResponse({'csrfToken': token})
    
    # Don't use wildcard with credentials - this is the key fix
    # response['Access-Control-Allow-Origin'] = '*'
    
    # Instead, specify the exact origin from the request
    origin = request.headers.get('Origin', '')
    if origin:
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
    else:
        # Fallback for same-origin requests
        response['Access-Control-Allow-Origin'] = request.build_absolute_uri('/').rstrip('/')
        response['Access-Control-Allow-Credentials'] = 'true'
    
    # Make sure we're sending the CSRF token with proper headers
    response['X-CSRFToken'] = token
    
    # Set the cookie explicitly with secure settings
    response.set_cookie(
        'csrftoken',
        token,
        max_age=60 * 60 * 24 * 7 * 52,  # 1 year
        path='/',
        secure=False,  # Set to True in production with HTTPS
        httponly=False,
        samesite='Lax'
    )
    
    return response

@csrf_protect
@require_http_methods(["GET"])
def get_player_stats(request, player_name):
    """
    Get detailed statistics for a specific player
    """
    try:
        player = Player.objects.get(name=player_name)
        
        # Calculate win ratio with proper rounding
        win_ratio = 0
        if player.games_played > 0:
            win_ratio = round((player.wins / player.games_played) * 100, 2)
        
        # Determine rank class
        rank_class = "unranked"
        if player.games_played >= 5:
            if win_ratio >= 70:
                rank_class = "gold"
            elif win_ratio >= 50:
                rank_class = "silver"
            else:
                rank_class = "bronze"
        
        return JsonResponse({
            "name": player.name,
            "wins": player.wins,
            "games_played": player.games_played,
            "win_ratio": win_ratio,
            "rank": rank_class
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
    data = []
    
    for p in players:
        # Calculate win ratio with proper error handling
        win_ratio = 0
        if p.games_played > 0:
            win_ratio = round((p.wins / p.games_played) * 100, 2)
        
        # Determine rank based on games played and win ratio
        rank = "unranked"
        if p.games_played >= 5:
            if win_ratio >= 70:
                rank = "gold"
            elif win_ratio >= 50:
                rank = "silver"
            else:
                rank = "bronze"
        
        # Add player data to result
        data.append({
            "name": p.name, 
            "wins": p.wins, 
            "games_played": p.games_played,
            "win_ratio": win_ratio,
            "rank": rank
        })
    
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
        score = data.get("score", 0)
        total_rounds = data.get("totalRounds", 3)  # Default to 3 if not specified
        
        # Input validation
        if not nickname or not token:
            return JsonResponse({"error": "Missing required fields"}, status=400)
        
        if not isinstance(score, (int, float)) or not isinstance(total_rounds, (int, float)):
            return JsonResponse({"error": "Score and totalRounds must be numbers"}, status=400)
        
        # A player wins if they reach the target rounds first
        # This is more reliable than comparing against total_rounds
        is_winner = score >= total_rounds / 2  # Using half of total rounds as threshold
        
        # Log for debugging
        logger.info(f"Game ended for {nickname}: Score={score}, Total Rounds={total_rounds}, Winner={is_winner}")
        
        # Get or create player, tracking total games and wins
        player, created = Player.objects.get_or_create(name=nickname)
        
        # Increment games played
        player.games_played += 1
        
        # Increment wins if player won
        if is_winner:
            player.wins += 1
            logger.info(f"Player {nickname} won - new win count: {player.wins}")
        
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
        logger.error(f"Error in end_game: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)
    
# GDPR functions

def generate_verification_hash(nickname):
    """
    Generate a secure verification hash based on nickname and current hour
    This ensures the hash changes every hour for security
    """
    # Get current hour as timestamp (changes every hour)
    current_hour = int(time.time()) // 3600
    
    # Create verification string with nickname and hour
    verification_string = f"{nickname}-{current_hour}-pong-gdpr"
    
    # Generate hash
    hash_object = hashlib.sha256(verification_string.encode())
    return hash_object.hexdigest()

@csrf_protect
@require_http_methods(["POST"])
def check_player_exists(request):
    """
    Check if a player exists without revealing too much information
    """
    try:
        data = json.loads(request.body)
        nickname = data.get("nickname")
        
        if not nickname:
            return JsonResponse({"exists": False, "message": "Nickname is required"}, status=400)
        
        # Verify nickname format
        if not re.match(r'^[A-Za-z0-9_-]{1,16}$', nickname):
            return JsonResponse({"exists": False, "message": "Invalid nickname format"})
        
        # Check if player exists
        player_exists = Player.objects.filter(name=nickname).exists()
        
        if player_exists:
            # Generate verification hash
            verification_hash = generate_verification_hash(nickname)
            
            # For security, only send prefix
            verification_prefix = verification_hash[:6]
            
            # Log for debugging
            logger.info(f"Generated verification for {nickname}: prefix={verification_prefix}")
            
            # Return only the prefix
            return JsonResponse({
                "exists": True, 
                "message": "Player found",
                "verification_prefix": verification_prefix,
                "timestamp": int(time.time()) // 3600  # Current hour for frontend to use in hash generation
            })
        else:
            return JsonResponse({"exists": False, "message": "Player not found"})
    
    except json.JSONDecodeError:
        return JsonResponse({"exists": False, "message": "Invalid request"}, status=400)

@csrf_protect
@require_http_methods(["POST"])
def delete_player_data(request):
    """
    Delete a player's data after secure verification
    """
    try:
        data = json.loads(request.body)
        nickname = data.get("nickname")
        user_input = data.get("user_input")
        frontend_hash = data.get("frontend_hash")
        
        logger.info(f"Delete request for {nickname} with input: {user_input}, hash: {frontend_hash}")
        
        if not nickname or not user_input or not frontend_hash:
            return JsonResponse({"success": False, "message": "Missing required fields"}, status=400)
        
        # Verify nickname format
        if not re.match(r'^[A-Za-z0-9_-]{1,16}$', nickname):
            return JsonResponse({"success": False, "message": "Invalid nickname"}, status=400)
        
        # Verify the nickname exists
        try:
            player = Player.objects.get(name=nickname)
        except Player.DoesNotExist:
            return JsonResponse({"success": False, "message": "Player not found"}, status=404)
        
        # Generate the backend verification hash
        backend_hash = generate_verification_hash(nickname)
        expected_prefix = backend_hash[:6]
        
        logger.info(f"Backend verification: expected_prefix={expected_prefix}, full_hash={backend_hash}")
        
        # Double verification:
        # 1. User must have entered the correct prefix shown in the UI
        # 2. Frontend must have generated the correct full hash
        
        if user_input != expected_prefix:
            logger.warning(f"User input verification failed: {user_input} != {expected_prefix}")
            return JsonResponse({
                "success": False, 
                "message": "Verification code doesn't match. Please try again."
            }, status=400)
        
        # Now verify the frontend hash
        if frontend_hash != backend_hash:
            logger.warning(f"Hash verification failed: {frontend_hash} != {backend_hash}")
            return JsonResponse({
                "success": False, 
                "message": "Security verification failed. Please try again with a fresh code."
            }, status=400)
        
        # If both verifications pass, delete the player data
        player.delete()
        logger.info(f"Player {nickname} data deleted successfully")
        
        return JsonResponse({
            "success": True,
            "message": "Player data has been permanently deleted."
        })
    
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid request"}, status=400)
    except Exception as e:
        logger.error(f"Error deleting player data: {str(e)}")
        return JsonResponse({"success": False, "message": str(e)}, status=500)
    