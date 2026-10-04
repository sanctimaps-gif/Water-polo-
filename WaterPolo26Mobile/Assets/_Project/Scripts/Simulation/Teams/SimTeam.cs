using System.Collections.Generic;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>Runtime team in a match.</summary>
    public sealed class SimTeam
    {
        public int Index;
        public TeamDefinition Definition;
        public readonly List<SimPlayer> Players = new List<SimPlayer>();
        public readonly List<SimPlayer> FieldPlayers = new List<SimPlayer>();
        public SimPlayer Goalkeeper;
        public int Score;
        public TacticStyle Tactic { get; private set; }
        public TacticParams TacticParams { get; private set; }

        public void SetTactic(TacticStyle style)
        {
            Tactic = style;
            TacticParams = TacticParams.For(style);
        }

        /// <summary>Fine-tuning hook (balancing tools, tests): keeps the style label, replaces the numbers.</summary>
        public void OverrideTacticParams(TacticParams parameters)
        {
            TacticParams = parameters;
        }

        public SimPlayer FieldPlayerInSlot(int slot)
        {
            foreach (var p in FieldPlayers)
                if (p.Slot == slot) return p;
            return null;
        }
    }

    /// <summary>
    /// Attacking shape (classic 6-on-6 "arc" + centre-forward), expressed relative to the
    /// goal being attacked. Slot 0/4 = wings at 2 m, 1/3 = flats at 5 m, 2 = point, 5 = centre (hole).
    /// </summary>
    public static class Formation
    {
        // distance from the target goal line, lateral offset
        private static readonly float[] AttackDistance = { 2.6f, 5.2f, 7.0f, 5.2f, 2.6f, 2.0f };
        private static readonly float[] AttackLateral = { -4.6f, -3.0f, 0f, 3.0f, 4.6f, 0f };

        public static Vec3 AttackSpot(MatchConfig cfg, int team, int slot, TacticParams tactic)
        {
            slot = System.Math.Max(0, System.Math.Min(5, slot));
            float sign = cfg.AttackSign(team);
            float goalX = cfg.TargetGoalCenter(team).X;
            float d = AttackDistance[slot] / System.Math.Max(0.5f, tactic.AttackDepth);
            float z = AttackLateral[slot] * tactic.Width;
            z = FMath.Clamp(z, -cfg.HalfWidth + 1f, cfg.HalfWidth - 1f);
            return new Vec3(goalX - sign * d, 0f, z);
        }

        /// <summary>Spot behind which a safety player waits when the team attacks.</summary>
        public static Vec3 SafetySpot(MatchConfig cfg, int team)
        {
            return new Vec3(cfg.AttackSign(team) * -1.5f, 0f, 0f);
        }

        /// <summary>Starting spot on the own goal line for a swim-off.</summary>
        public static Vec3 SwimOffSpot(MatchConfig cfg, int team, int slot)
        {
            float x = cfg.OwnGoalCenter(team).X + cfg.AttackSign(team) * 0.6f;
            float z = slot < 0 ? 0f : -5f + slot * 2f;
            return new Vec3(x, 0f, z);
        }

        /// <summary>Spot in the own half used for restarts after a goal.</summary>
        public static Vec3 RestartSpot(MatchConfig cfg, int team, int slot)
        {
            float sign = cfg.AttackSign(team);
            if (slot < 0) return cfg.OwnGoalCenter(team) + new Vec3(sign * 1f, 0f, 0f);
            float[] lateral = { -6f, -3.5f, 0f, 3.5f, 6f, 0f };
            float[] depth = { 3f, 4f, 6f, 4f, 3f, 2f };
            return new Vec3(-sign * depth[slot], 0f, lateral[slot]);
        }
    }
}
