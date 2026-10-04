namespace WaterPolo.Simulation
{
    public sealed class TeamMatchStats
    {
        public int Goals;
        public int Shots;
        public int ShotsOnTarget;
        public int Passes;
        public int PassesCompleted;
        public int Saves;
        public int Interceptions;
        public int Steals;
        public int Blocks;
        public int Fouls;
        public int CenterFeeds;
        public float PossessionTime;

        public float PassAccuracy => Passes > 0 ? (float)PassesCompleted / Passes : 0f;
        public float ShotEfficiency => Shots > 0 ? (float)Goals / Shots : 0f;
    }

    public sealed class PlayerMatchStats
    {
        public int Goals;
        public int Assists;
        public int Shots;
        public int Passes;
        public int PassesCompleted;
        public int Saves;
        public int Interceptions;
        public int Steals;
        public int Fouls;
        public float DistanceSwum;
    }

    public sealed class MatchStats
    {
        public readonly TeamMatchStats[] Teams = { new TeamMatchStats(), new TeamMatchStats() };
        public readonly PlayerMatchStats[] Players;

        public MatchStats(int playerCount)
        {
            Players = new PlayerMatchStats[playerCount];
            for (int i = 0; i < playerCount; i++) Players[i] = new PlayerMatchStats();
        }

        public float PossessionShare(int team)
        {
            float total = Teams[0].PossessionTime + Teams[1].PossessionTime;
            return total > 0f ? Teams[team].PossessionTime / total : 0.5f;
        }
    }
}
