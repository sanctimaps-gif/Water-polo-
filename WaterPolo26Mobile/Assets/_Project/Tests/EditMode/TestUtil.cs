using System.Collections.Generic;
using WaterPolo.Core;
using WaterPolo.Simulation;

namespace WaterPolo.Tests
{
    internal static class TestUtil
    {
        public static MatchSimulation NewSim(int seed = 1, int humanTeam = -1, TeamDefinition home = null, TeamDefinition away = null,
            System.Action<MatchConfig> configure = null)
        {
            var cfg = new MatchConfig { Seed = seed, HumanTeam = humanTeam };
            configure?.Invoke(cfg);
            var sim = new MatchSimulation(cfg, home ?? DemoTeams.Home(), away ?? DemoTeams.Away());
            sim.StartMatch();
            return sim;
        }

        public static SimPlayer MakePlayer(int stat = 70, PlayerRole role = PlayerRole.AllRounder)
        {
            return new SimPlayer { Stats = PlayerStats.Uniform(stat), Role = role, Profile = PersonalityProfile.For(Personality.Calm) };
        }

        public static TeamDefinition TeamWithRating(int rating, int seed, TacticStyle tactic = TacticStyle.Balanced)
        {
            var t = DemoTeams.Create("t" + seed, "Team " + seed, "T" + seed, 0x888888, 0xFFFFFF, rating, seed);
            t.Tactic = tactic;
            return t;
        }

        /// <summary>Moves every player far away from the point (both teams parked along their own goal lines).</summary>
        public static void ParkEveryone(MatchSimulation sim)
        {
            foreach (var p in sim.Players)
            {
                float x = sim.Config.OwnGoalCenter(p.TeamIndex).X * 0.95f;
                p.Position = new Vec3(x, 0f, -9f + p.Id * 0.4f);
                p.Velocity = Vec3.Zero;
            }
        }

        public static List<MatchEvent> RunToEnd(MatchSimulation sim, int maxTicks = 200000)
        {
            var events = new List<MatchEvent>();
            int guard = 0;
            while (!sim.IsFinished && guard++ < maxTicks)
            {
                sim.Step();
                sim.DrainEvents(events);
            }
            return events;
        }

        public static List<MatchEvent> RunSeconds(MatchSimulation sim, float seconds)
        {
            var events = new List<MatchEvent>();
            int ticks = (int)(seconds / sim.Config.FixedDeltaTime);
            for (int i = 0; i < ticks && !sim.IsFinished; i++)
            {
                sim.Step();
                sim.DrainEvents(events);
            }
            return events;
        }

        public static int Count(List<MatchEvent> events, MatchEventType type)
        {
            int n = 0;
            foreach (var e in events) if (e.Type == type) n++;
            return n;
        }
    }
}
