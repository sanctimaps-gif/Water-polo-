using System;
using System.Collections.Generic;

namespace WaterPolo.Simulation
{
    [Serializable]
    public sealed class PlayerDefinition
    {
        public string Name;
        public int Number;
        public PlayerRole Role;
        public Personality Personality;
        public PlayerStats Stats;
        /// <summary>Formation slot 0..5, -1 for the goalkeeper.</summary>
        public int Slot;
    }

    [Serializable]
    public sealed class TeamDefinition
    {
        public string Id;
        public string Name;
        public string ShortName;
        /// <summary>Cap / kit colours as 0xRRGGBB.</summary>
        public int PrimaryColor;
        public int SecondaryColor;
        public TacticStyle Tactic = TacticStyle.Balanced;
        /// <summary>Exactly one goalkeeper (Slot -1) and six field players (Slots 0..5).</summary>
        public List<PlayerDefinition> Players = new List<PlayerDefinition>();
    }

    /// <summary>
    /// Fictional prototype teams (no real clubs, no licensed names).
    /// PROTOTYPE: content will move to data assets in Phase 5.
    /// </summary>
    public static class DemoTeams
    {
        public static TeamDefinition Create(string id, string name, string shortName, int primary, int secondary, int baseRating, int seed)
        {
            var rng = new WaterPolo.Core.DeterministicRandom(seed);
            var team = new TeamDefinition { Id = id, Name = name, ShortName = shortName, PrimaryColor = primary, SecondaryColor = secondary };

            team.Players.Add(MakePlayer(rng, $"{shortName} GK", 1, PlayerRole.Goalkeeper, Personality.Calm, -1, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} RW", 2, PlayerRole.Winger, Personality.RiskTaker, 0, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} RF", 3, PlayerRole.Finisher, Personality.Aggressive, 1, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} PT", 4, PlayerRole.Playmaker, Personality.Leader, 2, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} LF", 5, PlayerRole.Defender, Personality.Tactical, 3, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} LW", 6, PlayerRole.Winger, Personality.Creative, 4, baseRating));
            team.Players.Add(MakePlayer(rng, $"{shortName} CF", 7, PlayerRole.Center, Personality.TeamPlayer, 5, baseRating));
            return team;
        }

        public static TeamDefinition Home() => Create("riviera", "Riviera Dolphins", "RIV", 0x1E5BD8, 0xFFFFFF, 72, 101);
        public static TeamDefinition Away() => Create("northshore", "Northshore Orcas", "NOR", 0xD8321E, 0x111111, 70, 202);

        private static PlayerDefinition MakePlayer(WaterPolo.Core.DeterministicRandom rng, string name, int number,
            PlayerRole role, Personality personality, int slot, int rating)
        {
            int R(int bias) => Math.Max(20, Math.Min(99, rating + bias + rng.Range(-6, 7)));

            var s = PlayerStats.Uniform(rating);
            s.Speed = R(0); s.Acceleration = R(0); s.Stamina = R(0); s.Passing = R(0); s.Shooting = R(0);
            s.Power = R(0); s.Accuracy = R(0); s.Defense = R(0); s.Reaction = R(0); s.Positioning = R(0);
            s.Technique = R(0); s.Intelligence = R(0); s.Physical = R(0); s.Goalkeeping = R(-45);

            switch (role)
            {
                case PlayerRole.Goalkeeper:
                    s.Goalkeeping = R(8); s.Reaction = R(6); s.Positioning = R(5); s.Shooting = R(-30); s.Speed = R(-10);
                    break;
                case PlayerRole.Center:
                    s.Physical = R(12); s.Power = R(6); s.Speed = R(-6); s.Technique = R(4);
                    break;
                case PlayerRole.Defender:
                    s.Defense = R(10); s.Physical = R(6); s.Positioning = R(5); s.Shooting = R(-6);
                    break;
                case PlayerRole.Winger:
                    s.Speed = R(8); s.Acceleration = R(8); s.Accuracy = R(4);
                    break;
                case PlayerRole.Playmaker:
                    s.Passing = R(10); s.Intelligence = R(10); s.Technique = R(5);
                    break;
                case PlayerRole.Finisher:
                    s.Shooting = R(10); s.Power = R(8); s.Accuracy = R(6);
                    break;
            }

            return new PlayerDefinition { Name = name, Number = number, Role = role, Personality = personality, Stats = s, Slot = slot };
        }
    }
}
