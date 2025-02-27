from django.db import models

from django.utils import timezone

class Player(models.Model):
    name = models.CharField(max_length=16, unique=True)
    wins = models.IntegerField(default=0)
    games_played = models.IntegerField(default=0)
    
    # Calculate win ratio dynamically
    @property
    def win_ratio(self):
        return (self.wins / self.games_played * 100) if self.games_played > 0 else 0
    
    # Rank calculation property
    @property
    def rank_class(self):
        if self.games_played < 5:
            return 'unranked'
        elif self.win_ratio >= 70:
            return 'gold'
        elif self.win_ratio >= 50:
            return 'silver'
        else:
            return 'bronze'
    
    def __str__(self):
        return f"{self.name} (Wins: {self.wins}, Games: {self.games_played})"